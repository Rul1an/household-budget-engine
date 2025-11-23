import { UploadForm } from '@/components/forms/upload-form';
import { db } from '@/db';
import { transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { centsToEuro } from '@/modules/import/utils';
import { desc, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function TransactionsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch household (MVP: fetch first household where user is member)
    // We need to import householdMembers and households schema
    const { householdMembers } = await import('@/db/schema');

    const memberRecord = await db.query.householdMembers.findFirst({
        where: eq(householdMembers.userId, user.id),
        with: {
            // We can't easily include household name without defining relation in schema properly using `relations`
            // For now, just get the ID
        }
    });

    if (!memberRecord) {
        return (
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">Geen Huishouden</h1>
                <p>Je bent nog geen lid van een huishouden.</p>
                {/* TODO: Create household form */}
            </div>
        );
    }

    const householdId = memberRecord.householdId;

    // Fetch transactions
    const txns = await db.select().from(transactions)
        .where(eq(transactions.householdId, householdId))
        .orderBy(desc(transactions.date))
        .limit(50);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Transacties</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Upload Section */}
                <div className="md:col-span-1">
                    <h2 className="text-lg font-semibold mb-2">Importeer CSV</h2>
                    <UploadForm householdId={householdId} />
                </div>

                {/* List Section */}
                <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Omschrijving</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Bedrag</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {txns.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                                        Geen transacties gevonden. Importeer een bestand.
                                    </td>
                                </tr>
                            ) : (
                                txns.map((t) => (
                                    <tr key={t.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(t.date).toLocaleDateString('nl-NL')}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            <div className="font-medium">{t.counterpartyName || 'Onbekend'}</div>
                                            <div className="text-gray-500 truncate max-w-xs">{t.description}</div>
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.amountCents > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {centsToEuro(t.amountCents)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
