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
  Briefcase,
  Search,
  CloudUpload,
  AlertCircle,
  Loader2,
  Database,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';
import { cn, formatCurrency } from './lib/utils';
import { Transaction, Category, TransactionType, MonthlySummary, Account } from './types';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
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

const safeParseISO = (dateStr: any): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date() : dateStr;
  
  const str = String(dateStr).trim();
  
  // Try standard parseISO
  try {
    const d = parseISO(str);
    if (!isNaN(d.getTime())) {
      return d;
    }
  } catch (e) {}

  // Try parsing dd-MM-yyyy or dd/MM/yyyy
  try {
    const parts = str.split(/[-/]/);
    if (parts.length === 3) {
      // Check if it's yyyy-MM-dd
      if (parts[0].length === 4) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) return d;
      } else {
        // dd-MM-yyyy or dd/MM/yyyy
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        if (!isNaN(d.getTime())) return d;
      }
    }
  } catch (e) {}

  const fb = new Date(str);
  if (!isNaN(fb.getTime())) {
    return fb;
  }

  return new Date();
};

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const [activeAccountId, setActiveAccountId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'categories' | 'reports'>('dashboard');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [showMigrationBanner, setShowMigrationBanner] = useState(false);

  // Synchronize Firestore categories in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const list: Category[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Category);
      });
      if (list.length > 0) {
        setCategories(list);
      } else {
        // Seed standard default categories if Firestore list is completely fresh
        DEFAULT_CATEGORIES.forEach(async (c) => {
          try {
            await setDoc(doc(db, 'categories', c.id), { name: c.name, color: c.color });
          } catch (e) {
            console.error("Error seeding categories:", e);
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });
    return () => unsub();
  }, []);

  // Synchronize Firestore accounts in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      const list: Account[] = [];
      let hasRekeningLala = false;
      snapshot.forEach((docSnap) => {
        if (docSnap.id === 'acc_3') {
          hasRekeningLala = true;
        } else {
          list.push({ id: docSnap.id, ...docSnap.data() } as Account);
        }
      });

      if (hasRekeningLala) {
        // Automatically delete acc_3 ('Rekening Lala') from Firestore if it exists
        deleteDoc(doc(db, 'accounts', 'acc_3')).catch((err) => {
          console.error("Gagal menghapus 'acc_3' dari Firestore:", err);
        });
      }

      if (list.length > 0) {
        setAccounts(list);
      } else {
        // Seed standard default accounts if Firestore is completely fresh
        DEFAULT_ACCOUNTS.forEach(async (a) => {
          try {
            await setDoc(doc(db, 'accounts', a.id), { name: a.name, description: a.description || '' });
          } catch (e) {
            console.error("Error seeding accounts:", e);
          }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accounts');
    });
    return () => unsub();
  }, []);

  // Synchronize Firestore transactions in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'transactions'), (snapshot) => {
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          date: d.date,
          description: d.description,
          amount: d.amount,
          type: d.type,
          categoryId: d.categoryId,
          accountId: d.accountId,
          toAccountId: d.toAccountId,
          qty: d.qty,
          unit: d.unit,
          price: d.price,
          createdAt: d.createdAt
        } as Transaction);
      });
      // Sort newest dates first. If dates are equal, sort by createdAt descending.
      list.sort((a, b) => {
        const dateDiff = safeParseISO(b.date).getTime() - safeParseISO(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (aCreated !== bCreated) {
          return bCreated - aCreated;
        }
        
        return b.id.localeCompare(a.id);
      });
      setTransactions(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });
    return () => unsub();
  }, []);

  const [localCount, setLocalCount] = useState(0);

  // Detect and flag if there is local unmigrated localStorage data
  useEffect(() => {
    try {
      const localTxRaw = localStorage.getItem('pettycash_transactions');
      const migrated = localStorage.getItem('pettycash_transactions_migrated');
      if (localTxRaw) {
        const txs = JSON.parse(localTxRaw) as Transaction[];
        if (txs.length > 0) {
          setLocalCount(txs.length);
          if (migrated !== 'true') {
            setShowMigrationBanner(true);
          }
        }
      }
    } catch (e) {
      console.error("Local storage storage detection issue:", e);
    }
  }, []);

  const [migrationSucceeded, setMigrationSucceeded] = useState(0);
  const [migrationFailed, setMigrationFailed] = useState(0);
  const [migrationTotal, setMigrationTotal] = useState(0);

  const handleMigration = async () => {
    setMigrationStatus('running');
    setMigrationSucceeded(0);
    setMigrationFailed(0);
    
    try {
      const localTxRaw = localStorage.getItem('pettycash_transactions');
      const localTx: Transaction[] = localTxRaw ? JSON.parse(localTxRaw) : [];
      
      const localCatRaw = localStorage.getItem('pettycash_categories');
      const localCat: Category[] = localCatRaw ? JSON.parse(localCatRaw) : [];

      const localAccRaw = localStorage.getItem('pettycash_accounts');
      const localAcc: Account[] = localAccRaw ? JSON.parse(localAccRaw) : [];

      setMigrationTotal(localTx.length);

      // 1. Migrate custom categories safely
      for (const cat of localCat) {
        try {
          const cleanCat = { name: cat.name, color: cat.color };
          await setDoc(doc(db, 'categories', cat.id), cleanCat);
        } catch (catErr) {
          console.error(`Gagal memindahkan kategori ${cat.name || cat.id}:`, catErr);
        }
      }

      // 2. Migrate custom accounts safely
      for (const acc of localAcc) {
        try {
          const cleanAcc = { name: acc.name, description: acc.description || '' };
          await setDoc(doc(db, 'accounts', acc.id), cleanAcc);
        } catch (accErr) {
          console.error(`Gagal memindahkan rekening/akun ${acc.name || acc.id}:`, accErr);
        }
      }

      // 3. Migrate transactions one-by-one safely
      let successCount = 0;
      let failCount = 0;

      for (const tx of localTx) {
        try {
          // Format date to YYYY-MM-DD safely
          let cleanDate = tx.date;
          try {
            const parsed = safeParseISO(tx.date);
            cleanDate = format(parsed, 'yyyy-MM-dd');
          } catch (dateErr) {
            cleanDate = new Date().toISOString().split('T')[0];
          }

          const cleanTx: Record<string, any> = {
            date: cleanDate || new Date().toISOString().split('T')[0],
            description: tx.description || '',
            amount: Number(tx.amount) || 0,
            type: tx.type || 'expense',
            categoryId: tx.categoryId || '5',
            accountId: tx.accountId || 'acc_1',
          };
          if (tx.toAccountId) cleanTx.toAccountId = tx.toAccountId;
          if (tx.qty !== undefined) cleanTx.qty = Number(tx.qty);
          if (tx.unit) cleanTx.unit = tx.unit;
          if (tx.price !== undefined) cleanTx.price = Number(tx.price);

          await setDoc(doc(db, 'transactions', tx.id), cleanTx);
          successCount++;
          setMigrationSucceeded(successCount);
        } catch (txErr) {
          console.error(`Gagal memindahkan transaksi ID ${tx.id} (${tx.description || ''}):`, txErr);
          failCount++;
          setMigrationFailed(failCount);
        }
      }

      localStorage.setItem('pettycash_transactions_migrated', 'true');
      setMigrationStatus('done');
      setTimeout(() => setShowMigrationBanner(false), 12000);
    } catch (e) {
      console.error("Kesalahan umum saat migrasi:", e);
      setMigrationStatus('error');
    }
  };

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
    transactions.forEach(t => yearsSet.add(safeParseISO(t.date).getFullYear()));
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [transactions]);

  const filteredTransactions = transactions.filter(t => {
    const date = safeParseISO(t.date);
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

      // Menampilkan pemasukan, pengeluaran, transfer masuk, dan transfer keluar dari akun terpilih
      accountMatch = 
        (t.type === 'income' && isFromCurrent) ||
        (t.type === 'expense' && isFromCurrent) ||
        (t.type === 'transfer' && isToCurrent) ||
        (t.type === 'transfer' && isFromCurrent);
    }
    
    return dateMatch && accountMatch;
  });

  const filteredTransactionsTab = React.useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const query = searchQuery.toLowerCase().trim();
    return transactions.filter(t => {
      const category = categories.find(c => c.id === t.categoryId);
      const categoryName = category ? category.name.toLowerCase() : '';
      const account = accounts.find(a => a.id === t.accountId);
      const accountName = account ? account.name.toLowerCase() : '';
      const toAccount = t.toAccountId ? accounts.find(a => a.id === t.toAccountId) : null;
      const toAccountName = toAccount ? toAccount.name.toLowerCase() : '';

      return (
        t.description.toLowerCase().includes(query) ||
        categoryName.includes(query) ||
        accountName.includes(query) ||
        toAccountName.includes(query) ||
        t.amount.toString().includes(query) ||
        (t.price && t.price.toString().includes(query)) ||
        (t.qty && t.qty.toString().includes(query))
      );
    });
  }, [transactions, searchQuery, categories, accounts]);

  const monthTransactions = transactions.filter(t => {
    const date = safeParseISO(t.date);
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

  const addTransaction = async (t: Omit<Transaction, 'id'>) => {
    const id = crypto.randomUUID();
    const cleanTx: Record<string, any> = {
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      type: t.type,
      categoryId: t.categoryId,
      accountId: t.accountId,
      createdAt: new Date().toISOString(),
    };
    if (t.toAccountId) cleanTx.toAccountId = t.toAccountId;
    if (t.qty !== undefined) cleanTx.qty = Number(t.qty);
    if (t.unit) cleanTx.unit = t.unit;
    if (t.price !== undefined) cleanTx.price = Number(t.price);

    try {
      await setDoc(doc(db, 'transactions', id), cleanTx);
      setIsFormOpen(false);
      setToast({ message: 'Transaksi berhasil disimpan langsung ke Google Cloud!', type: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ message: 'Gagal menyimpan transaksi ke Google Cloud. Pastikan koneksi internet stabil.', type: 'error' });
    }
  };

  const updateTransaction = async (id: string, updatedT: Omit<Transaction, 'id'>) => {
    const existingTx = transactions.find(tx => tx.id === id);
    const createdAt = existingTx?.createdAt || new Date().toISOString();
    
    const cleanTx: Record<string, any> = {
      date: updatedT.date,
      description: updatedT.description,
      amount: Number(updatedT.amount),
      type: updatedT.type,
      categoryId: updatedT.categoryId,
      accountId: updatedT.accountId,
      createdAt,
    };
    if (updatedT.toAccountId) cleanTx.toAccountId = updatedT.toAccountId;
    if (updatedT.qty !== undefined) cleanTx.qty = Number(updatedT.qty);
    if (updatedT.unit) cleanTx.unit = updatedT.unit;
    if (updatedT.price !== undefined) cleanTx.price = Number(updatedT.price);

    try {
      await setDoc(doc(db, 'transactions', id), cleanTx);
      setIsFormOpen(false);
      setEditingTransaction(null);
      setToast({ message: 'Perubahan transaksi berhasil disimpan!', type: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ message: 'Gagal menyimpan perubahan. Periksa koneksi internet Anda.', type: 'error' });
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setToast({ message: 'Transaksi berhasil dihapus dari Google Cloud!', type: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ message: 'Gagal menghapus transaksi dari Google Cloud.', type: 'error' });
    }
  };

  const addCategory = async (name: string) => {
    const id = crypto.randomUUID();
    const newCategory = {
      name,
      color: `#${Math.floor(Math.random()*16777215).toString(16)}`
    };
    try {
      await setDoc(doc(db, 'categories', id), newCategory);
      setToast({ message: `Kategori "${name}" berhasil dibuat!`, type: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ message: 'Gagal membuat kategori baru ke Google Cloud.', type: 'error' });
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
      setToast({ message: 'Kategori berhasil dihapus dari Google Cloud!', type: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ message: 'Gagal menghapus kategori.', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex text-slate-900 bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6">
          <div className="flex items-center gap-3 text-indigo-600">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-indigo-900 font-sans">Petty Cash Koperasi</span>
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
                  label="Saldo Saat Ini" 
                  value={totalBalance} 
                  icon={<Wallet className="w-5 h-5" />}
                  color="blue"
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
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'transactions' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="font-bold text-slate-800">Semua Transaksi</h3>
                <div className="relative max-w-sm w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari transaksi (keterangan, kategori, akun)..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-slate-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
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
                  {filteredTransactionsTab.map(t => (
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
              {transactions.length > 0 && filteredTransactionsTab.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                  <p>Tidak ada transaksi yang cocok dengan pencarian Anda.</p>
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

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-bold min-w-[320px] max-w-md",
              toast.type === 'success' 
                ? "bg-emerald-50 border-emerald-100 text-emerald-900" 
                : "bg-rose-50 border-rose-100 text-rose-900"
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div className="flex-1 leading-snug">{toast.message}</div>
            <button 
              onClick={() => setToast(null)}
              className="p-1 hover:bg-black/5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
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
      <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{format(safeParseISO(transaction.date), 'dd MMM yyyy')}</td>
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
          innerRadius={60}
          outerRadius={85}
          paddingAngle={5}
          dataKey="value"
        >
          {expenseData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
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

  // Auto-calculate Total Amount when Qty and Price are valid
  useEffect(() => {
    const q = parseFloat(formData.qty);
    const p = parseFloat(formData.price);
    if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
      const total = q * p;
      setFormData(prev => ({ ...prev, amount: Math.round(total).toString() }));
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
      amount: Math.round(parseFloat(formData.amount)),
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

          <div className="space-y-1.5 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 mb-2">
            <label className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Total Jumlah / Nominal Akhir (Rp) <span className="text-rose-500">*</span></label>
            <div className="relative flex items-center">
              <span className="absolute left-4 font-bold text-slate-400">Rp</span>
              <input 
                type="number" 
                required
                placeholder="Masukkan jumlah langsung..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-indigo-200 rounded-xl outline-none font-extrabold text-xl text-indigo-900 focus:ring-2 focus:ring-indigo-150 focus:border-indigo-400 transition-all shadow-sm"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <p className="text-[10px] text-indigo-800 leading-normal">
              * Ketik nominal langsung di sini, atau isi Qty & Harga di atas agar dihitung otomatis.
            </p>
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
  // Group by month
  const monthlyData = React.useMemo(() => {
    const summary: Record<string, { income: number, expense: number }> = {};
    
    transactions.forEach(t => {
      const monthKey = format(safeParseISO(t.date), 'yyyy-MM');
      if (!summary[monthKey]) summary[monthKey] = { income: 0, expense: 0 };
      if (t.type === 'income') summary[monthKey].income += t.amount;
      else if (t.type === 'expense') summary[monthKey].expense += t.amount;
    });

    return Object.entries(summary)
      .map(([month, data]) => ({
        month: format(safeParseISO(`${month}-01`), 'MMM yyyy'),
        income: data.income,
        expense: data.expense,
        balance: data.income - data.expense
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [transactions]);

  // Group by category for expenses
  const expenseByCategoryData = React.useMemo(() => {
    const sumSummary: Record<string, number> = {};
    
    transactions.forEach(t => {
      if (t.type === 'expense') {
        const category = categories.find(c => c.id === t.categoryId);
        const catName = category ? category.name : 'Lain-lain';
        sumSummary[catName] = (sumSummary[catName] || 0) + t.amount;
      }
    });

    return Object.entries(sumSummary)
      .map(([name, value]) => {
        const category = categories.find(c => c.name === name);
        return {
          name,
          value,
          color: category ? category.color : '#6b7280'
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  const totalExpense = React.useMemo(() => {
    return expenseByCategoryData.reduce((acc, curr) => acc + curr.value, 0);
  }, [expenseByCategoryData]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analisis Bulanan */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
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
        </div>

        {/* Pengeluaran Per Kategori */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold mb-6 text-slate-800">Pengeluaran Per Kategori</h3>
            {expenseByCategoryData.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-slate-400">
                <Tag className="w-12 h-12 mb-2 stroke-1" />
                <p className="text-sm font-medium">Tidak ada data pengeluaran</p>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 h-80">
                <div className="w-full sm:w-1/2 h-full min-h-[180px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseByCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {expenseByCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                        formatter={(v: number) => [formatCurrency(v), 'Pengeluaran']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full sm:w-1/2 space-y-2 overflow-y-auto max-h-[240px] pr-2 scrollbar-thin">
                  {expenseByCategoryData.map((item) => {
                    const percentage = totalExpense > 0 ? ((item.value / totalExpense) * 100).toFixed(1) : '0';
                    return (
                      <div key={item.name} className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 truncate">{item.name}</span>
                        </div>
                        <div className="text-right font-semibold text-slate-900 shrink-0 ml-2">
                          {formatCurrency(item.value)} <span className="text-slate-400 font-normal ml-1">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Bulan</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pemasukan</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Pengeluaran</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Saldo Akhir</th>
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
