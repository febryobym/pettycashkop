import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Download, 
  Tag, 
  ClipboardList,
  LayoutDashboard,
  Settings,
  Trash2,
  Calendar,
  X,
  Edit,
  ArrowRightLeft,
  Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { cn, formatCurrency } from './lib/utils';
import { Transaction, Category, TransactionType, MonthlySummary, Account } from './types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie
} from 'recharts';

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Makanan & Minuman', color: '#3b82f6' },
  { id: '2', name: 'Transportasi', color: '#10b981' },
  { id: '3', name: 'Belanja', color: '#f59e0b' },
  { id: '4', name: 'Kesehatan', color: '#ef4444' },
  { id: '5', name: 'Lain-lain', color: '#6b7280' },
  { id: '6', name: 'ATK', color: '#6366f1' },
  { id: '7', name: 'Belanja Dapur', color: '#f97316' },
  { id: '8', name: 'Operasional', color: '#06b6d4' },
  { id: 'transfer_cat', name: 'Pemindahan Kas', color: '#6366f1' },
];

const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'acc_1', name: 'Petty Cash Koperasi', description: 'Kas operasional harian' },
  { id: 'acc_2', name: 'Transfer dari Mas Aris', description: 'Dana masuk dari Mas Aris' },
];

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [activeAccountId, setActiveAccountId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'categories' | 'reports'>('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  
  // Local Storage
  useEffect(() => {
    const savedTransactions = localStorage.getItem('pettycash_transactions');
    const savedCategories = localStorage.getItem('pettycash_categories');
    const savedAccounts = localStorage.getItem('pettycash_accounts');
    if (savedTransactions) setTransactions(JSON.parse(savedTransactions));
    if (savedCategories) {
      const parsed = JSON.parse(savedCategories);
      if (!parsed.some((c: Category) => c.id === 'transfer_cat')) {
        parsed.push({ id: 'transfer_cat', name: 'Pemindahan Kas', color: '#6366f1' });
      }
      setCategories(parsed);
    } else {
      setCategories(DEFAULT_CATEGORIES);
    }
    if (savedAccounts) {
      const parsed = JSON.parse(savedAccounts);
      const updated = parsed.map((acc: Account) => {
        if (acc.id === 'acc_1' && (acc.name === 'Petty Cash Utama' || acc.name === 'Pettycash +' || acc.name === 'Petty Cash +')) {
          return { ...acc, name: 'Petty Cash Koperasi' };
        }
        if (acc.id === 'acc_2' && acc.name === 'Kas Cadangan') {
          return { ...acc, name: 'Transfer dari Mas Aris', description: 'Dana masuk dari Mas Aris' };
        }
        return acc;
      });
      setAccounts(updated);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pettycash_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('pettycash_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('pettycash_accounts', JSON.stringify(accounts));
  }, [accounts]);

  // Calculations
  const getAccountBalance = (accId: string) => {
    return transactions.reduce((acc, t) => {
      const isFromCurrent = 
        t.accountId === accId || 
        (accId === 'acc_1' && (t.accountId === '1' || !t.accountId)) ||
        (accId === 'acc_2' && t.accountId === '2');

      const isToCurrent = 
        t.toAccountId === accId ||
        (accId === 'acc_1' && t.toAccountId === '1') ||
        (accId === 'acc_2' && t.toAccountId === '2');

      if (isFromCurrent) {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense') return acc - t.amount;
        if (t.type === 'transfer') return acc - t.amount; // Transfer FROM
      }
      if (t.type === 'transfer' && isToCurrent) {
        return acc + t.amount; // Transfer TO
      }
      return acc;
    }, 0);
  };

  const totalBalance = activeAccountId === 'all'
    ? transactions.reduce((acc, t) => {
        if (t.type === 'income') return acc + t.amount;
        if (t.type === 'expense') return acc - t.amount;
        return acc;
      }, 0)
    : getAccountBalance(activeAccountId);
  
  const years = React.useMemo(() => {
    const yearsSet = new Set<number>([new Date().getFullYear()]);
    transactions.forEach(t => yearsSet.add(parseISO(t.date).getFullYear()));
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => {
    const date = parseISO(t.date);
    const dateMatch = date.getMonth() === filterMonth && date.getFullYear() === filterYear;
    
    let accountMatch = false;
    if (activeAccountId === 'all') {
      accountMatch = true;
    } else {
      const isFromCurrent = 
        t.accountId === activeAccountId || 
        (activeAccountId === 'acc_1' && (t.accountId === '1' || !t.accountId)) ||
        (activeAccountId === 'acc_2' && t.accountId === '2');

      const isToCurrent = 
        t.toAccountId === activeAccountId ||
        (activeAccountId === 'acc_1' && t.toAccountId === '1') ||
        (activeAccountId === 'acc_2' && t.toAccountId === '2');

      // "pemasukkan saja, untuk pengeluaran tidak masuk"
      accountMatch = 
        (t.type === 'income' && isFromCurrent) ||
        (t.type === 'transfer' && isToCurrent);
    }
    
    return dateMatch && accountMatch;
  });

  const monthTransactions = transactions.filter(t => {
    const date = parseISO(t.date);
    return date.getMonth() === filterMonth && date.getFullYear() === filterYear;
  });

  const monthIncome = monthTransactions.reduce((acc, t) => {
    const isFromCurrent = 
      activeAccountId === 'all' ||
      t.accountId === activeAccountId || 
      (activeAccountId === 'acc_1' && (t.accountId === '1' || !t.accountId)) ||
      (activeAccountId === 'acc_2' && t.accountId === '2');

    const isToCurrent = 
      activeAccountId === 'all' ||
      t.toAccountId === activeAccountId ||
      (activeAccountId === 'acc_1' && t.toAccountId === '1') ||
      (activeAccountId === 'acc_2' && t.toAccountId === '2');

    if (t.type === 'income' && isFromCurrent) return acc + t.amount;
    if (t.type === 'transfer' && isToCurrent && activeAccountId !== 'all') return acc + t.amount;
    return acc;
  }, 0);

  const monthExpense = monthTransactions.reduce((acc, t) => {
    const isFromCurrent = 
      activeAccountId === 'all' ||
      t.accountId === activeAccountId || 
      (activeAccountId === 'acc_1' && (t.accountId === '1' || !t.accountId)) ||
      (activeAccountId === 'acc_2' && t.accountId === '2');

    if (t.type === 'expense' && isFromCurrent) return acc + t.amount;
    if (t.type === 'transfer' && isFromCurrent && activeAccountId !== 'all') return acc + t.amount;
    return acc;
  }, 0);

  const monthTransactionsCount = filteredTransactions.length;

  // Excel Export
  const exportToExcel = () => {
    const data = transactions.map(t => ({
      Tanggal: t.date,
      Deskripsi: t.description,
      Qty: t.qty || 0,
      Satuan: t.unit || '',
      Harga: t.price || 0,
      Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Kategori: categories.find(c => c.id === t.categoryId)?.name || 'N/A',
      Total: t.amount,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `PettyCash_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const newTransaction = { ...t, id: crypto.randomUUID() };
    setTransactions([newTransaction, ...transactions]);
    setIsFormOpen(false);
  };

  const updateTransaction = (id: string, updatedT: Omit<Transaction, 'id'>) => {
    setTransactions(transactions.map(t => t.id === id ? { ...updatedT, id } : t));
    setIsFormOpen(false);
    setEditingTransaction(null);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const addCategory = (name: string) => {
    const newCategory: Category = {
      id: crypto.randomUUID(),
      name,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };
    setCategories([...categories, newCategory]);
  };

  const deleteCategory = (id: string) => {
    setCategories(categories.filter(c => c.id !== id));
  };

  return (
    <div className="min-h-screen flex text-slate-900 bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6">
          <div className="flex items-center gap-3 text-indigo-600 mb-1">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-indigo-900">Petty Cash Koperasi</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === 'transactions'} 
            onClick={() => setActiveTab('transactions')}
            icon={<ClipboardList className="w-5 h-5" />}
            label="Transaksi"
          />
          <NavItem 
            active={activeTab === 'categories'} 
            onClick={() => setActiveTab('categories')}
            icon={<Tag className="w-5 h-5" />}
            label="Kategori"
          />
          <NavItem 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')}
            icon={<Calendar className="w-5 h-5" />}
            label="Laporan"
          />
        </nav>

        <div className="p-4 border-t border-slate-200 mt-auto">
          <button 
            onClick={exportToExcel}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-sm hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              {activeTab === 'dashboard' ? "Dashboard Petty Cash" : activeTab}
            </h1>
            
            {activeTab === 'dashboard' && (
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveAccountId('all')}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-md transition-all",
                    activeAccountId === 'all' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Semua
                </button>
                {accounts.map(acc => (
                  <button 
                    key={acc.id}
                    onClick={() => setActiveAccountId(acc.id)}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-md transition-all ml-1",
                      activeAccountId === acc.id ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'dashboard' && (
              <div className="flex items-center gap-2 mr-4 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <select 
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                  className="bg-transparent text-sm font-semibold text-slate-600 outline-none px-2 py-1 cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMMM')}</option>
                  ))}
                </select>
                <select 
                  value={filterYear}
                  onChange={(e) => setFilterYear(parseInt(e.target.value))}
                  className="bg-transparent text-sm font-semibold text-slate-600 outline-none px-2 py-1 cursor-pointer"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
            <button 
              onClick={() => {
                setEditingTransaction(null);
                setIsFormOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Input Transaksi</span>
            </button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto space-y-8">
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard 
                  label="Pemasukan" 
                  value={monthIncome} 
                  icon={<ArrowUpRight className="w-5 h-5" />}
                  color="emerald"
                />
                <StatCard 
                  label="Pengeluaran" 
                  value={monthExpense} 
                  icon={<ArrowDownLeft className="w-5 h-5" />}
                  color="rose"
                />
                <StatCard 
                  label="Total Transaksi" 
                  value={monthTransactionsCount} 
                  icon={<ClipboardList className="w-5 h-5" />}
                  color="blue"
                  isCount
                />
              </div>

              {/* Quick Transactions & Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">
                      Transaksi {format(new Date(filterYear, filterMonth), 'MMMM yyyy')}
                    </h3>
                    <button 
                      onClick={() => setActiveTab('transactions')}
                      className="text-xs text-indigo-600 font-bold uppercase tracking-widest hover:underline"
                    >
                      Lihat Semua
                    </button>
                  </div>
                  <div className="flex-1">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Tanggal</th>
                          <th className="px-4 py-3 font-semibold">Keterangan</th>
                          <th className="px-4 py-3 font-semibold">Kategori</th>
                          <th className="px-4 py-3 font-semibold text-right">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTransactions.slice(0, 10).map(t => (
                          <TransactionRow 
                            key={t.id} 
                            transaction={t} 
                            category={categories.find(c => c.id === t.categoryId)} 
                            accounts={accounts}
                            activeAccountId={activeAccountId}
                            onDelete={deleteTransaction}
                            onEdit={(t) => {
                              setEditingTransaction(t);
                              setIsFormOpen(true);
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                    {filteredTransactions.length === 0 && (
                      <div className="text-center py-10 text-gray-400 text-sm">Belum ada transaksi di bulan ini</div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4 flex flex-col gap-6">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 text-sm">Alokasi Kategori</h3>
                    <div className="h-64">
                      <ExpenseChart transactions={filteredTransactions} categories={categories} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold text-slate-800 text-sm">Saldo Account</h3>
                    {accounts.map(acc => (
                      <div key={acc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <Wallet className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">{acc.name}</p>
                            <p className="text-sm font-bold text-slate-900">{formatCurrency(getAccountBalance(acc.id))}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="bg-indigo-900 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden mt-2">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                      <p className="text-xs text-indigo-300 uppercase tracking-widest font-bold mb-1 z-10 relative">Saldo Saat Ini</p>
                      <p className="text-3xl font-bold z-10 relative italic">{formatCurrency(totalBalance)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Semua Transaksi</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 font-semibold text-right">Jumlah</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(t => (
                    <TransactionRow 
                      key={t.id} 
                      transaction={t} 
                      category={categories.find(c => c.id === t.categoryId)}
                      accounts={accounts}
                      onDelete={deleteTransaction}
                      onEdit={(t) => {
                        setEditingTransaction(t);
                        setIsFormOpen(true);
                      }}
                      showActions
                    />
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <p>Mulai dengan menambahkan transaksi pertama Anda!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'categories' && (
            <CategoryManager 
              categories={categories} 
              onAdd={addCategory} 
              onDelete={deleteCategory} 
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView transactions={transactions} categories={categories} />
          )}
        </div>
      </main>

      <AnimatePresence>
        {isFormOpen && (
          <TransactionModal 
            categories={categories} 
            accounts={accounts}
            initialData={editingTransaction || undefined}
            onClose={() => {
              setIsFormOpen(false);
              setEditingTransaction(null);
            }} 
            onSubmit={editingTransaction ? (t) => updateTransaction(editingTransaction.id, t) : addTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all font-medium",
        active 
          ? "bg-indigo-50 text-indigo-700 shadow-sm" 
          : "text-slate-600 hover:bg-slate-50 transition-colors"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, color, isCount }: { label: string, value: number, icon: React.ReactNode, color: 'emerald' | 'rose' | 'blue', isCount?: boolean }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn(
          "p-2 rounded-lg",
          color === 'emerald' ? "bg-emerald-100 text-emerald-700" :
          color === 'rose' ? "bg-rose-100 text-rose-700" :
          "bg-blue-100 text-blue-700"
        )}>
          {icon}
        </div>
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">
        {isCount ? (
          <>{value} <span className="text-sm font-normal text-slate-400">item</span></>
        ) : (
          formatCurrency(value)
        )}
      </div>
    </div>
  );
}

function TransactionRow({ 
  transaction, 
  category, 
  accounts, 
  activeAccountId = 'all', 
  onDelete, 
  onEdit, 
  showActions 
}: { 
  transaction: Transaction, 
  category?: Category, 
  accounts: Account[], 
  activeAccountId?: string, 
  onDelete: (id: string) => void, 
  onEdit?: (t: Transaction) => void, 
  showActions?: boolean, 
  key?: any 
}) {
  const fromAcc = accounts.find(a => a.id === transaction.accountId);
  const toAcc = accounts.find(a => a.id === transaction.toAccountId);

  const isTransfer = transaction.type === 'transfer';
  let amountSign = '';
  let amountColor = '';

  if (transaction.type === 'income') {
    amountSign = '+';
    amountColor = 'text-emerald-600';
  } else if (transaction.type === 'expense') {
    amountSign = '-';
    amountColor = 'text-rose-600';
  } else if (isTransfer) {
    if (activeAccountId === 'all') {
      amountSign = '⇄';
      amountColor = 'text-indigo-600';
    } else if (transaction.toAccountId === activeAccountId) {
      amountSign = '+';
      amountColor = 'text-emerald-600';
    } else if (transaction.accountId === activeAccountId) {
      amountSign = '-';
      amountColor = 'text-rose-600';
    } else {
      amountSign = '⇄';
      amountColor = 'text-indigo-600';
    }
  }

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{format(parseISO(transaction.date), 'dd MMM yyyy')}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800">{transaction.description}</span>
          {isTransfer && (
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
              Transfer: {fromAcc?.name} → {toAcc?.name}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span 
          className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ backgroundColor: `${category?.color}20`, color: category?.color }}
        >
          {category?.name || 'Lain-lain'}
        </span>
      </td>
      <td className={cn("px-4 py-3 text-right font-bold", amountColor)}>
        {amountSign} {formatCurrency(transaction.amount)}
      </td>
      {showActions && (
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <button 
              onClick={() => onEdit?.(transaction)}
              className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onDelete(transaction.id)}
              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      )}
      {!showActions && (
        <td className="px-4 py-3 text-right">
          <button 
            onClick={() => onEdit?.(transaction)}
            className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <Edit className="w-4 h-4" />
          </button>
        </td>
      )}
    </tr>
  );
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.03) return null;

  return (
    <text 
      x={x} 
      y={y} 
      fill="#ffffff" 
      textAnchor="middle" 
      dominantBaseline="central"
      className="text-[11px] font-black tracking-tighter"
      style={{
        textShadow: '0 1px 2px rgba(0,0,0,0.4)'
      }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

function ExpenseChart({ transactions, categories }: { transactions: Transaction[], categories: Category[] }) {
  const expenseData = categories.map(cat => {
    const total = transactions
      .filter(t => t.type === 'expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return { name: cat.name, value: total, color: cat.color };
  }).filter(d => d.value > 0);

  if (expenseData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
        Belum ada data pengeluaran
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={expenseData}
          cx="50%"
          cy="45%"
          innerRadius={30}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          labelLine={false}
          label={renderCustomizedLabel}
        >
          {expenseData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={1} stroke="#fff" />
          ))}
        </Pie>
        <Tooltip 
          contentStyle={{ 
            borderRadius: '12px', 
            border: 'none', 
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
            fontSize: '12px',
            fontWeight: '600'
          }}
          formatter={(value: number) => [formatCurrency(value), '']}
        />
        <Legend 
          layout="horizontal" 
          verticalAlign="bottom" 
          align="center"
          iconType="circle"
          wrapperStyle={{ 
            fontSize: '11px', 
            paddingTop: '20px',
            fontWeight: '500'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CategoryManager({ categories, onAdd, onDelete }: { categories: Category[], onAdd: (name: string) => void, onDelete: (id: string) => void }) {
  const [newName, setNewName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onAdd(newName.trim());
      setNewName('');
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
      <h3 className="text-xl font-bold mb-6 text-slate-800">Manajemen Kategori</h3>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-8">
        <input 
          type="text" 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nama kategori baru..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
        />
        <button className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-indigo-100">
          <Plus className="w-4 h-4" />
          <span>Tambah</span>
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="font-semibold text-slate-700">{c.name}</span>
            </div>
            <button 
              onClick={() => onDelete(c.id)}
              className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TransactionModal({ categories, accounts, onClose, onSubmit, initialData }: { categories: Category[], accounts: Account[], onClose: () => void, onSubmit: (t: Omit<Transaction, 'id'>) => void, initialData?: Transaction }) {
  const [formData, setFormData] = useState({
    date: initialData?.date || format(new Date(), 'yyyy-MM-dd'),
    description: initialData?.description || '',
    amount: initialData?.amount.toString() || '',
    qty: initialData?.qty?.toString() || '1',
    unit: initialData?.unit || '',
    price: initialData?.price?.toString() || '',
    type: initialData?.type || 'expense' as TransactionType,
    categoryId: initialData?.categoryId || categories[0]?.id || '',
    accountId: initialData?.accountId || accounts[0]?.id || '',
    toAccountId: initialData?.toAccountId || accounts[1]?.id || ''
  });

  // Auto-calculate Total Amount when Qty or Price changes
  useEffect(() => {
    const q = parseFloat(formData.qty) || 0;
    const p = parseFloat(formData.price) || 0;
    const total = q * p;
    if (total > 0) {
      setFormData(prev => ({ ...prev, amount: total.toString() }));
    }
  }, [formData.qty, formData.price]);

  // Ensure toAccountId is not matching accountId during a transfer
  useEffect(() => {
    if (formData.type === 'transfer' && formData.accountId === formData.toAccountId) {
      const otherAccount = accounts.find(a => a.id !== formData.accountId);
      if (otherAccount) {
        setFormData(prev => ({ ...prev, toAccountId: otherAccount.id }));
      }
    }
  }, [formData.accountId, formData.type, accounts, formData.toAccountId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;
    const finalCategoryId = formData.type === 'transfer' ? 'transfer_cat' : formData.categoryId;
    onSubmit({
      ...formData,
      categoryId: finalCategoryId,
      amount: parseFloat(formData.amount),
      qty: parseFloat(formData.qty) || undefined,
      price: parseFloat(formData.price) || undefined,
      unit: formData.unit || undefined
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-xl font-bold">{initialData ? 'Ubah Transaksi' : 'Catat Transaksi'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4">
            <button 
              type="button"
              onClick={() => setFormData({...formData, type: 'expense'})}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                formData.type === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Pengeluaran
            </button>
            <button 
              type="button"
              onClick={() => setFormData({...formData, type: 'income'})}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                formData.type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Pemasukan
            </button>
            <button 
              type="button"
              onClick={() => setFormData({...formData, type: 'transfer'})}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                formData.type === 'transfer' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Transfer
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {formData.type === 'transfer' ? 'Dari Akun' : 'Akun'}
              </label>
              <select 
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none bg-white"
                value={formData.accountId}
                onChange={e => setFormData({...formData, accountId: e.target.value})}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {formData.type === 'transfer' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ke Akun</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none bg-white"
                  value={formData.toAccountId}
                  onChange={e => setFormData({...formData, toAccountId: e.target.value})}
                >
                  {accounts.filter(a => a.id !== formData.accountId).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kategori</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none appearance-none bg-white"
                  value={formData.categoryId}
                  onChange={e => setFormData({...formData, categoryId: e.target.value})}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</label>
            <input 
              type="date" 
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none"
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deskripsi</label>
            <input 
              type="text" 
              required
              placeholder="Bayar makan siang..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Qty</label>
              <input 
                type="number" 
                placeholder="1"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                value={formData.qty}
                onChange={e => setFormData({...formData, qty: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Satuan</label>
              <input 
                type="text" 
                placeholder="Pcs/Lbr"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Harga (Rp)</label>
              <input 
                type="number" 
                placeholder="0"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 outline-none"
                value={formData.price}
                onChange={e => setFormData({...formData, price: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1.5 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Jumlah (Rp)</label>
            <input 
              type="number" 
              required
              readOnly
              placeholder="0"
              className="w-full px-4 py-2 bg-transparent outline-none font-bold text-xl text-slate-900 cursor-default"
              value={formData.amount}
            />
            <p className="text-[10px] text-slate-400 italic font-medium">* Otomatis: Qty × Harga</p>
          </div>

          <button className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold mt-4 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 leading-none">
            {initialData ? 'Simpan Perubahan' : 'Simpan Transaksi'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function ReportsView({ transactions, categories }: { transactions: Transaction[], categories: Category[] }) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // AI Insights call
  const generateInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, categories })
      });
      const data = await response.json();
      setInsights(data.insights);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  // Group by month
  const monthlyData = React.useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    
    transactions.forEach(t => {
      const monthKey = format(parseISO(t.date), 'yyyy-MM');
      if (!summary[monthKey]) summary[monthKey] = { income: 0, expense: 0 };
      if (t.type === 'income') summary[monthKey].income += t.amount;
      else if (t.type === 'expense') summary[monthKey].expense += t.amount;
    });

    return Object.entries(summary)
      .map(([month, data]) => ({
        month: format(parseISO(`${month}-01`), 'MMM yyyy'),
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions]);

  return (
    <div className="space-y-8">
      {/* AI Insights Card */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 rounded-2xl text-white shadow-xl shadow-slate-200 flex flex-col md:flex-row items-center gap-8 border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="bg-white/10 p-5 rounded-2xl backdrop-blur-xl border border-white/10 z-10">
          <BarChart3 className="w-10 h-10 text-white" />
        </div>
        <div className="flex-1 text-center md:text-left z-10">
          <h3 className="text-2xl font-bold mb-2 tracking-tight">AI Financial Insights</h3>
          <p className="text-indigo-200 mb-6 max-w-lg leading-relaxed">Gunakan kekuatan AI untuk menganalisis pola pengeluaran Anda dan dapatkan saran cerdas untuk menghemat lebih banyak.</p>
          <button 
            onClick={generateInsights}
            disabled={isLoadingInsights || transactions.length === 0}
            className="bg-white text-indigo-900 px-8 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-95 text-sm"
          >
            {isLoadingInsights ? 'Menganalisis...' : 'Dapatkan Insight Sekarang'}
          </button>
        </div>
      </div>

      {insights && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border-l-4 border-l-indigo-600 shadow-sm border border-slate-200"
        >
          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600" />
            Rekomendasi AI Untuk Anda
          </h4>
          <div className="text-slate-600 leading-relaxed whitespace-pre-line text-sm">
            {insights}
          </div>
        </motion.div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold mb-6 text-slate-800">Analisis Bulanan</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData.slice(0, 6).reverse()}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: '#64748b' }} tickFormatter={(v) => `${v/1000}k`} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" />
              <Bar dataKey="income" name="Pemasukan" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Bulan</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pemasukan</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pengeluaran</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Netto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {monthlyData.map(row => (
              <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-700">{row.month}</td>
                <td className="px-6 py-4 text-emerald-600 font-medium">{formatCurrency(row.income)}</td>
                <td className="px-6 py-4 text-rose-600 font-medium">{formatCurrency(row.expense)}</td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
