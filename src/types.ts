export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Account {
  id: string;
  name: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string; // Only for 'transfer' type
  qty?: number;
  unit?: string;
  price?: number;
}

export interface MonthlySummary {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}
