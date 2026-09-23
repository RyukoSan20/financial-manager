import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Receipt, 
  Wallet, 
  PiggyBank,
  Repeat,
  Target,
  CreditCard,
  Calculator,
  BarChart3,
  Settings,
  TrendingUp,
  Menu,
  X,
  Plus,
  ChevronRight,
  LogOut,
  User,
  Bell,
  Moon,
  HelpCircle,
  PlusCircle,
  Map,
  Sparkles
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Accounts', href: '/accounts', icon: Wallet },
  { name: 'Budgets', href: '/budgets', icon: PiggyBank },
  { name: 'Recurring', href: '/recurring', icon: Repeat },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Debts', href: '/debts', icon: CreditCard },
  { name: 'Calculators', href: '/calculators', icon: Calculator },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Spending Map', href: '/map', icon: Map },
  { name: 'AI Advisor', href: '/advisor', icon: Sparkles },
];

const bottomNavItems = [
  { name: 'Home', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Add', href: '/add', icon: Plus, isFAB: true },
  { name: 'Budgets', href: '/budgets', icon: PiggyBank },
  { name: 'More', href: '/more', icon: Menu },
];

import api from '../../services/api';

// Desktop Sidebar
export const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-100">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">FinManager</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Menu</p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-600 font-medium shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{item.name}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-gray-100 space-y-1">
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            location.pathname === '/settings'
              ? 'bg-primary-50 text-primary-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm">Settings</span>
        </Link>
      </div>
    </aside>
  );
};

// Mobile Header
export const MobileHeader = ({ title, showBack = false, onBack }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-gray-100 z-40 safe-area-top">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button 
                onClick={onBack}
                className="p-2 -ml-2 text-gray-600 active:bg-gray-100 rounded-lg touch-manipulation"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
              </Link>
            )}
            <h1 className="font-semibold text-lg text-gray-900">{title}</h1>
          </div>
          
          {/* Right */}
          <div className="flex items-center gap-1">
            <button className="p-2.5 text-gray-600 active:bg-gray-100 rounded-lg touch-manipulation">
              <Bell className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 text-gray-600 active:bg-gray-100 rounded-lg touch-manipulation"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50" 
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute top-0 right-0 bottom-0 w-72 bg-white shadow-xl animate-slideInRight">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="h-16 flex items-center justify-between px-5 border-b border-gray-100">
                <span className="font-semibold text-lg">Menu</span>
                <button 
                  onClick={() => setMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Profile */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">User</p>
                    <p className="text-sm text-gray-500">user@example.com</p>
                  </div>
                </div>
              </div>
              
              {/* Menu Items */}
              <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                      <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
                    </Link>
                  );
                })}
              </nav>
              
              {/* Bottom */}
              <div className="p-3 border-t border-gray-100 space-y-1">
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Settings</span>
                </Link>
                <button 
                  onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-50">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Bottom Navigation (Mobile)
export const BottomNav = () => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();

  const navItems = [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: Receipt },
    { name: 'Add', href: '/add', icon: Plus, isFAB: true },
    { name: 'Budgets', href: '/budgets', icon: PiggyBank },
    { name: 'More', href: '/more', icon: Menu, isMore: true },
  ];

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-full px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            
            if (item.isFAB) {
              return (
                <Link
                  key={item.name}
                  to="/add"
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 active:scale-95 transition-transform">
                    <Plus className="w-7 h-7 text-white" />
                  </div>
                </Link>
              );
            }
            
            if (item.isMore) {
              return (
                <button
                  key={item.name}
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex flex-col items-center justify-center w-16 h-full touch-manipulation ${
                    moreOpen ? 'text-primary-600' : 'text-gray-500'
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                  <span className="text-[10px] mt-1 font-medium">{item.name}</span>
                </button>
              );
            }
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex flex-col items-center justify-center w-16 h-full touch-manipulation transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-500'
                }`}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[10px] mt-1 font-medium">{item.name}</span>
                {isActive && (
                  <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-500" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* More Menu */}
      {moreOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div 
            className="absolute bottom-20 left-4 right-4 bg-white rounded-2xl shadow-xl animate-slideUp overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2 p-3">
              {[
                { icon: Target, label: 'Goals', href: '/goals', color: 'bg-purple-100 text-purple-600' },
                { icon: CreditCard, label: 'Debts', href: '/debts', color: 'bg-orange-100 text-orange-600' },
                { icon: Repeat, label: 'Recurring', href: '/recurring', color: 'bg-blue-100 text-blue-600' },
                { icon: Calculator, label: 'Calculator', href: '/calculators', color: 'bg-green-100 text-green-600' },
                { icon: BarChart3, label: 'Analytics', href: '/analytics', color: 'bg-pink-100 text-pink-600' },
                { icon: Settings, label: 'Settings', href: '/settings', color: 'bg-gray-100 text-gray-600' },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center justify-center p-4 rounded-xl active:bg-gray-50 touch-manipulation"
                >
                  <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-2`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-gray-700">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Add Transaction Page
export const AddTransactionPage = () => {
  const navigate = useNavigate();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Fetch categories and accounts from API
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const [catRes, accRes] = await Promise.all([
        api.categories.list(),
        api.accounts.list(),
      ]);
      setCategoryList(Array.isArray(catRes) ? catRes : []);
      setAccounts(Array.isArray(accRes) ? accRes : []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };
  
  // Filter categories by type
  const filteredCategories = categoryList.filter(c => {
    if (type === 'income') return c.type === 'income';
    return c.type === 'expense';
  });
  
  const handleSubmit = async () => {
    if (!amount) {
      setError('Please enter amount');
      return;
    }
    if (!account) {
      setError('Please select an account');
      return;
    }
    
    setLoading(true);
    setError('');
    
    // Parse amount - remove commas and convert to number
    const parsedAmount = parseFloat(amount.toString().replace(/,/g, ''));
    
    try {
      await api.transactions.create({
        type: type,
        amount: parsedAmount,
        description: description || (category ? `${category} expense` : `${type} transaction`),
        account_id: parseInt(account),
        category_id: category ? parseInt(category) : null,
        date: date,
      });
      
      // Success - redirect to dashboard
      navigate('/');
    } catch (err) {
      console.error('Failed to save transaction:', err);
      setError('Failed to save: ' + (err.message || 'Unknown error'));
      setLoading(false);
    }
  };
  
  const quickAmounts = ['50000', '100000', '200000', '500000', '1000000'];
  
  const formatDisplayAmount = (val) => {
    if (!val) return '';
    return parseInt(val).toLocaleString('id-ID');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-6 rounded-b-3xl shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/" className="p-2 -ml-2 text-gray-600">
            <X className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">Add Transaction</h1>
        </div>

        {/* Type Toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setType('expense')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              type === 'expense' 
                ? 'bg-white text-danger-600 shadow-sm' 
                : 'text-gray-600'
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => setType('income')}
            className={`flex-1 py-3 rounded-lg font-medium transition-all ${
              type === 'income' 
                ? 'bg-white text-success-600 shadow-sm' 
                : 'text-gray-600'
            }`}
          >
            Income
          </button>
        </div>

        {/* Amount Input */}
        <div className="mt-6">
          <div className="flex items-baseline gap-1">
            <span className={`text-5xl font-bold ${type === 'income' ? 'text-success-600' : 'text-gray-900'}`}>
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={formatDisplayAmount(amount)}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              className={`text-5xl font-bold bg-transparent outline-none w-full ${
                type === 'income' ? 'text-success-600' : 'text-gray-900'
              }`}
            />
          </div>
        </div>

        {/* Quick Amounts */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 -mx-4 px-4">
          {quickAmounts.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              className="px-4 py-2 bg-gray-100 rounded-full text-sm font-medium text-gray-600 whitespace-nowrap active:bg-gray-200 touch-manipulation"
            >
              {parseInt(q).toLocaleString('id-ID')}
            </button>
          ))}
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="px-4 py-4 space-y-3">
        {/* Description */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-gray-900 outline-none"
          />
        </div>

        {/* Category */}
        <button
          onClick={() => setShowCategorySheet(true)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:bg-gray-50 touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${
              type === 'income' ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'
            } flex items-center justify-center`}>
              {category ? (
                <span className="text-lg">{categoryList.find(c => c.id === parseInt(category))?.name?.[0] || 'C'}</span>
              ) : (
                <PlusCircle className="w-5 h-5" />
              )}
            </div>
            <span className={category ? 'text-gray-900 font-medium' : 'text-gray-400'}>
              {category ? (categoryList.find(c => c.id === parseInt(category))?.name || 'Category') : 'Select Category'}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Account */}
        <button
          onClick={() => setShowAccountSheet(true)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:bg-gray-50 touch-manipulation"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className={account ? 'text-gray-900 font-medium' : 'text-gray-400'}>
              {account ? (accounts.find(a => a.id === parseInt(account))?.name || 'Account') : 'Select Account'}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Date */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 text-gray-900 outline-none"
          />
        </div>
      </div>

      {/* Bottom Submit */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent lg:hidden">
        <button
          onClick={handleSubmit}
          disabled={!amount || loading}
          className={`w-full py-4 rounded-2xl font-semibold text-lg shadow-lg transition-all ${
            amount && !loading
              ? type === 'income'
                ? 'bg-success-500 text-white active:bg-success-600'
                : 'bg-primary-500 text-white active:bg-primary-600'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {loading ? 'Saving...' : `Save ${type === 'income' ? 'Income' : 'Expense'}`}
        </button>
      </div>

      {/* Category Sheet */}
      {showCategorySheet && (
        <BottomSheet 
          title="Select Category" 
          onClose={() => setShowCategorySheet(false)}
        >
          <div className="grid grid-cols-3 gap-3 p-4">
            {filteredCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setCategory(cat.id.toString());
                  setShowCategorySheet(false);
                }}
                className={`p-4 rounded-xl border-2 transition-colors ${
                  category === cat.id.toString()
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-100 bg-gray-50 active:bg-gray-100'
                }`}
              >
                <span className="text-sm font-medium text-gray-700">{cat.name}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Account Sheet */}
      {showAccountSheet && (
        <BottomSheet 
          title="Select Account" 
          onClose={() => setShowAccountSheet(false)}
        >
          <div className="p-4 space-y-2">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  setAccount(acc.id.toString());
                  setShowAccountSheet(false);
                }}
                className={`w-full p-4 rounded-xl flex items-center gap-3 transition-colors ${
                  account === acc.id.toString()
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : 'bg-gray-50 border-2 border-transparent active:bg-gray-100'
                }`}
              >
                <Wallet className="w-5 h-5 text-gray-600" />
                <div className="text-left">
                  <span className="font-medium text-gray-900 block">{acc.name}</span>
                  <span className="text-sm text-gray-500">{acc.account_type}</span>
                </div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

// Bottom Sheet Component
export const BottomSheet = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div 
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-xl animate-slideUp max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        
        {/* Header */}
        {title && (
          <div className="px-5 pb-3 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
        )}
        
        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {children}
        </div>
      </div>
    </div>
  );
};

// More Page
export const MorePage = () => {
  const menuItems = [
    { icon: Target, label: 'Goals', href: '/goals', color: 'bg-purple-100 text-purple-600', desc: 'Track your savings goals' },
    { icon: CreditCard, label: 'Debts', href: '/debts', color: 'bg-orange-100 text-orange-600', desc: 'Manage loans & credits' },
    { icon: Repeat, label: 'Recurring', href: '/recurring', color: 'bg-blue-100 text-blue-600', desc: 'Automated transactions' },
    { icon: Calculator, label: 'Calculators', href: '/calculators', color: 'bg-green-100 text-green-600', desc: 'Financial calculators' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics', color: 'bg-pink-100 text-pink-600', desc: 'Insights & trends' },
    { icon: Map, label: 'Spending Map', href: '/map', color: 'bg-red-100 text-red-600', desc: 'Merchant locations & patterns' },
    { icon: Sparkles, label: 'AI Advisor', href: '/advisor', color: 'bg-cyan-100 text-cyan-600', desc: 'AI-powered financial advice' },
    { icon: User, label: 'Profile', href: '/profile', color: 'bg-indigo-100 text-indigo-600', desc: 'Account settings' },
    { icon: Bell, label: 'Notifications', href: '/notifications', color: 'bg-yellow-100 text-yellow-600', desc: 'Alerts & reminders' },
    { icon: Settings, label: 'Settings', href: '/settings', color: 'bg-gray-100 text-gray-600', desc: 'App configuration' },
    { icon: HelpCircle, label: 'Help & Support', href: '/help', color: 'bg-teal-100 text-teal-600', desc: 'FAQs & contact' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="p-4 space-y-3">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className="block bg-white rounded-2xl p-4 shadow-sm active:bg-gray-50 touch-manipulation"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center`}>
                <item.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{item.label}</p>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default { Sidebar, MobileHeader, BottomNav, BottomSheet, AddTransactionPage, MorePage };
