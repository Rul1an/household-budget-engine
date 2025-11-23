'use server';

import { db } from '@/db';
import { categories, transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { categorizeTransaction } from '@/modules/ai/categorize';
import { parseBankExport } from '@/modules/import/parser';
import { parsePdfBankExport } from '@/modules/import/pdf-parser';
import { revalidatePath } from 'next/cache';

export async function uploadCsvAction(formData: FormData) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { success: false, message: 'Unauthorized', errors: [] };
        }

        const householdId = formData.get('householdId') as string;
        if (!householdId) {
            return { success: false, message: 'Household ID required', errors: [] };
        }

        const file = formData.get('file') as File;
        if (!file) return { success: false, message: 'Geen bestand geselecteerd', errors: [] };

        let parsedTxns: any[] = [];
        let errors: string[] = [];
        let adapterUsed = 'UNKNOWN';

        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
            // Handle PDF
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await parsePdfBankExport(buffer);
            parsedTxns = result.transactions;
            errors = result.errors;
            adapterUsed = result.adapterUsed;
        } else {
            // Handle CSV (Default)
            const text = await file.text();
            const result = await parseBankExport(text);
            parsedTxns = result.transactions;
            errors = result.errors;
            adapterUsed = result.adapterUsed;
        }

        if (parsedTxns.length === 0) {
            return { success: false, message: 'Geen transacties gevonden.', errors };
        }

        // Import dependencies
        const { eq } = await import('drizzle-orm');
        const { accounts } = await import('@/db/schema');

        let account = await db.query.accounts.findFirst({
            where: eq(accounts.householdId, householdId)
        });

        if (!account) {
            // Create default account
            const [newAccount] = await db.insert(accounts).values({
                householdId,
                name: 'Hoofdrekening',
                iban: 'UNKNOWN'
            }).returning();
            account = newAccount;
        }

        // Fetch existing categories
        const existingCategories = await db.query.categories.findMany({
            where: (categories, { eq, or, isNull }) => or(
                eq(categories.householdId, householdId),
                isNull(categories.householdId)
            )
        });

        const categoryMap = new Map<string, string>();
        existingCategories.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id));

        const CHUNK_SIZE = 50; // Reduced chunk size for AI processing

        for (let i = 0; i < parsedTxns.length; i += CHUNK_SIZE) {
            const chunk = parsedTxns.slice(i, i + CHUNK_SIZE);

            // 1. Categorize in parallel
            const categorizedChunk = await Promise.all(chunk.map(async (t) => {
                const aiResult = await categorizeTransaction(t.description, t.amountCents / 100, t.counterpartyName);
                return { ...t, aiCategory: aiResult?.category };
            }));

            // 2. Identify and create missing categories
            const categoriesToCreate = new Set<string>();
            categorizedChunk.forEach(t => {
                if (t.aiCategory && !categoryMap.has(t.aiCategory.toLowerCase())) {
                    categoriesToCreate.add(t.aiCategory);
                }
            });

            for (const catName of categoriesToCreate) {
                // Double check if it was added in previous iteration (though we are in same chunk logic, but just to be safe if we parallelize chunks later)
                if (categoryMap.has(catName.toLowerCase())) continue;

                // Infer type based on the first transaction that used this category (heuristic)
                const sampleTxn = categorizedChunk.find(t => t.aiCategory === catName);
                const type = (sampleTxn?.amountCents || 0) > 0 ? 'INCOME' : 'EXPENSE';

                const [newCat] = await db.insert(categories).values({
                    householdId,
                    name: catName,
                    type,
                    isFixed: false,
                    isAllowance: false
                }).returning();

                categoryMap.set(newCat.name.toLowerCase(), newCat.id);
            }

            // 3. Map to DB rows
            const dbRows = categorizedChunk.map(t => ({
                householdId,
                accountId: account!.id,
                date: t.date.toISOString(),
                amountCents: t.amountCents,
                description: t.description,
                counterpartyName: t.counterpartyName,
                importHash: t.importHash,
                categoryId: t.aiCategory ? categoryMap.get(t.aiCategory.toLowerCase()) : null
            }));

            await db.insert(transactions)
                .values(dbRows)
                .onConflictDoNothing({ target: transactions.importHash });
        }

        revalidatePath('/transactions');
        return {
            success: true,
            message: `Succesvol ${parsedTxns.length} transacties geïmporteerd`,
            errors: errors.length > 0 ? errors : []
        };
    } catch (error) {
        console.error('Upload error:', error);
        return {
            success: false,
            message: `Fout tijdens verwerking: ${error instanceof Error ? error.message : 'Onbekende fout'}`,
            errors: []
        };
    }
}
