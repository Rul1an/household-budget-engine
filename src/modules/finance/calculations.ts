import { Category, MonthlySummary, PartnerShare, Transaction } from './types';

export function calculateMonthlyAverage(
    transactions: Transaction[],
    categories: Category[],
    monthsCount: number
): MonthlySummary {
    // 1. Group by Category and Sum
    const categoryTotals = new Map<string, number>();

    transactions.forEach(t => {
        if (!t.categoryId) return;
        const current = categoryTotals.get(t.categoryId) || 0;
        categoryTotals.set(t.categoryId, current + t.amountCents);
    });

    // 2. Calculate Averages per Category
    const categoryAverages = new Map<string, number>();
    categoryTotals.forEach((total, catId) => {
        categoryAverages.set(catId, Math.round(total / monthsCount));
    });

    // 3. Aggregate Groups
    let totalFixedExpenses = 0;
    let totalAllowances = 0;
    let totalIncomeSalaries = 0;

    categories.forEach(cat => {
        const avgAmount = categoryAverages.get(cat.id) || 0;

        if (cat.isFixed && cat.type === 'EXPENSE') {
            // Expenses are usually stored as negative, we want absolute value for "Expenses" sum
            totalFixedExpenses += Math.abs(avgAmount);
        }

        if (cat.isAllowance) {
            // Allowances are income (positive)
            totalAllowances += avgAmount;
        }

        // Assuming we have a way to identify salaries (e.g. by name or a specific flag not yet in schema)
        // For now, let's assume all non-allowance income is salary/other income
        if (cat.type === 'INCOME' && !cat.isAllowance) {
            totalIncomeSalaries += avgAmount;
        }
    });

    // 4. Calculate Net Needed
    // Netto Te Dekken = Vaste Lasten - Toeslagen
    const netNeeded = totalFixedExpenses - totalAllowances;

    return {
        totalFixedExpenses,
        totalAllowances,
        totalIncomeSalaries,
        netNeeded
    };
}

export function calculatePartnerShares(
    netNeeded: number,
    partners: { id: string; name: string; incomeCents: number }[]
): PartnerShare[] {
    const totalIncome = partners.reduce((sum, p) => sum + p.incomeCents, 0);

    if (totalIncome === 0) {
        // Avoid division by zero, split equally
        const equalShare = Math.round(netNeeded / partners.length);
        return partners.map(p => ({
            partnerId: p.id,
            name: p.name,
            incomeCents: p.incomeCents,
            sharePercentage: 1 / partners.length,
            shareAmountCents: equalShare
        }));
    }

    return partners.map(p => {
        const shareFactor = p.incomeCents / totalIncome;
        return {
            partnerId: p.id,
            name: p.name,
            incomeCents: p.incomeCents,
            sharePercentage: shareFactor,
            shareAmountCents: Math.round(netNeeded * shareFactor)
        };
    });
}
