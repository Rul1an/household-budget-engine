export type CategoryType = 'INCOME' | 'EXPENSE';
export type CategoryTag = 'SALARY' | 'ALLOWANCE' | 'FIXED_COST' | 'VARIABLE' | 'SAVINGS' | 'CREDITCARD';

export interface Category {
    id: string;
    name: string;
    type: CategoryType;
    isFixed: boolean;
    isAllowance: boolean;
}

export interface Transaction {
    amountCents: number;
    categoryId: string | null;
}

export interface MonthlySummary {
    totalIncomeSalaries: number;
    totalAllowances: number;
    totalFixedExpenses: number;
    netNeeded: number;
}

export interface PartnerShare {
    partnerId: string;
    name: string;
    incomeCents: number;
    sharePercentage: number;
    shareAmountCents: number;
}
