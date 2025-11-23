'use server';

import { db } from '@/db';
import { categories, transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { retry } from '@/lib/utils';
import { categorizeTransaction } from '@/modules/ai/categorize';
import { parseBankExport } from '@/modules/import/parser';
import { parsePdfBankExport } from '@/modules/import/pdf-parser';
import { revalidatePath } from 'next/cache';
import pLimit from 'p-limit';

export async function validateFileSignature(file: File): Promise<boolean> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF Signature: %PDF (25 50 44 46)
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        if (buffer.length < 4) return false;
        return buffer.toString('utf8', 0, 4) === '%PDF';
    }

    // CSV Validation (Heuristic: mostly printable ASCII/UTF-8, no binary control chars)
    // We check the first 1024 bytes for null bytes or other binary indicators
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const sample = buffer.subarray(0, 1024);
        for (const byte of sample) {
            // Allow: printable (32-126), whitespace (9, 10, 13), and extended ASCII/UTF-8 start bytes (>127)
            if ((byte < 32 && ![9, 10, 13].includes(byte))) {
                return false;
            }
        }
        return true;
    }

    return false;
}

import { errorResponse, successResponse, type ActionResponse } from '@/lib/error-handling';

export async function uploadCsvAction(formData: FormData): Promise<ActionResponse<{ count: number; errors: string[] }>> {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return errorResponse('UNAUTHORIZED', 'Je bent niet ingelogd.');
        }

        const householdId = formData.get('householdId') as string;
        if (!householdId) {
            return errorResponse('MISSING_HOUSEHOLD', 'Huishouden ID ontbreekt.');
        }

        const file = formData.get('file') as File;
        if (!file) return errorResponse('NO_FILE', 'Geen bestand geselecteerd.');

        const isValid = await validateFileSignature(file);
        if (!isValid) {
            return errorResponse('INVALID_FILE', 'Ongeldig bestandstype of corrupt bestand. Upload een geldige PDF of CSV.');
        }

        type ParsedTransaction = {
            date: Date;
            amountCents: number;
            description: string;
            counterpartyName?: string | null;
            importHash: string;
            aiCategory?: string;
        };
        let parsedTxns: ParsedTransaction[] = [];
        let errors: string[] = [];
        let adapterUsed = 'UNKNOWN';

        try {
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
        } catch (parseError) {
            console.error('Parse error:', parseError);
            return errorResponse('PARSE_ERROR', 'Fout bij het lezen van het bestand.', { originalError: parseError });
        }

        if (parsedTxns.length === 0) {
            return errorResponse('NO_TRANSACTIONS', 'Geen transacties gevonden in dit bestand.', { errors });
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
        const limit = pLimit(5); // Limit concurrent AI calls

        for (let i = 0; i < parsedTxns.length; i += CHUNK_SIZE) {
            const chunk = parsedTxns.slice(i, i + CHUNK_SIZE);

            // 1. Categorize in parallel with concurrency limit and retry
            const categorizedChunk = await Promise.all(chunk.map((t: ParsedTransaction) => limit(() => retry(async () => {
                try {
                    const aiResult = await categorizeTransaction(t.description, t.amountCents / 100, t.counterpartyName || undefined);
                    return { ...t, aiCategory: aiResult?.category };
                } catch (e) {
                    console.warn(`AI Categorization failed for "${t.description}":`, e);
                    return { ...t, aiCategory: undefined };
                }
            }, 3, 1000))));

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
        return successResponse({ count: parsedTxns.length, errors }, `Succesvol ${parsedTxns.length} transacties geïmporteerd.`);

    } catch (error) {
        console.error('Upload error:', error);
        return errorResponse('INTERNAL_ERROR', `Onverwachte fout: ${error instanceof Error ? error.message : 'Onbekend'}`, { error });
    }
}
