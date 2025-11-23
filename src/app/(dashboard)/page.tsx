import { BudgetChart } from '@/components/charts/budget-chart';
import { db } from '@/db';
import { categories, householdMembers, transactions } from '@/db/schema';
import { createClient } from '@/lib/supabase/server';
import { calculateMonthlyAverage } from '@/modules/finance/calculations';
import { centsToEuro } from '@/modules/import/utils';
import { eq, sql } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const memberRecord = await db.query.householdMembers.findFirst({
        where: eq(householdMembers.userId, user.id),
    });

    if (!memberRecord) {
        return <div>Je bent nog geen lid van een huishouden.</div>;
    }

    const householdId = memberRecord.householdId;

    // Fetch all transactions (for MVP, we calculate average over all time or last 12 months)
    // Ideally we filter by date range selected in UI (URL params)
    const allTxns = await db.select().from(transactions).where(eq(transactions.householdId, householdId));
    const allCats = await db.select().from(categories).where(
        sql`(${categories.householdId} = ${householdId} OR ${categories.householdId} IS NULL)`
    );

    // Map transactions to include category info (since we selected raw)
    // We need to join manually or map in memory. Memory is fine for MVP size.
    const enrichedTxns = allTxns.map(t => ({
        amountCents: t.amountCents,
        categoryId: t.categoryId
    }));

    const mappedCats = allCats.map(c => ({
        ...c,
        isFixed: c.isFixed ?? false,
        isAllowance: c.isAllowance ?? false
    }));

    // Calculate Summary
    const summary = calculateMonthlyAverage(enrichedTxns, mappedCats, 12); // Assuming 12 months average

    const chartData = [
        { name: 'Vaste Lasten', value: summary.totalFixedExpenses },
        { name: 'Toeslagen', value: summary.totalAllowances },
        { name: 'Inkomen', value: summary.totalIncomeSalaries },
    ];

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Overzicht</h1>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Netto Te Dekken</h3>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{centsToEuro(summary.netNeeded)}</p>
                    <p className="text-xs text-gray-400 mt-1">Per maand (gemiddeld)</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Vaste Lasten</h3>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">{centsToEuro(summary.totalFixedExpenses)}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-sm font-medium text-gray-500">Toeslagen</h3>
                    <p className="text-2xl font-semibold text-green-600 mt-2">{centsToEuro(summary.totalAllowances)}</p>
                </div>
            </div>

            {/* Charts & Advice */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">Verdeling</h3>
                    <BudgetChart data={chartData} />
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="text-lg font-semibold mb-4">AI Advies</h3>
                    <div className="p-4 bg-blue-50 rounded text-blue-800 text-sm">
                        {/* Placeholder for AI component */}
                        <p>AI analyse wordt hier geladen...</p>
                        {/* We will implement the AI component next */}
                    </div>
                </div>
            </div>
        </div>
    );
}
