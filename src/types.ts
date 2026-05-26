export type TransactionType = 'income' | 'expense';

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
