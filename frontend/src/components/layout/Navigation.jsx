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
  Sun,
  HelpCircle,
  PlusCircle,
  Map,
  Sparkles,
  PieChart,
  BellRing,
  ShoppingBag,
  Heart,
  ShoppingCart,
  Kanban,
  Mail, Package,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { NotificationBell } from '../notifications/NotificationBell';
import { showNotification } from '../notifications/NotificationHelper';
import AddTransactionPage from './AddTransactionPage';
import { UserProfileSection } from './UserProfileSection';
import { CurrencyBadge } from '../common/CurrencyBadge';
import GroupedNav, { buildNavMap, isGroupedNavOn } from './GroupedNav';

// The icons by the name the grouped view uses them under.
const ICONS = {
  LayoutDashboard, Receipt, Wallet, PiggyBank, Repeat, Target, CreditCard,
  Calculator, BarChart3, Settings, Map, Sparkles, Heart, ShoppingCart,
  Kanban, Mail, ShoppingBag, PieChart, BellRing,
};

const navItems = (t) => [
  { name: t('nav.dashboard'), href: '/', icon: LayoutDashboard },
  { name: t('nav.transactions'), href: '/transactions', icon: Receipt },
  { name: t('nav.feed'), href: '/feed', icon: BellRing },
  { name: t('nav.market'), href: '/market', icon: BarChart3 },
  { name: t('nav.accounts'), href: '/accounts', icon: Wallet },
  { name: t('nav.budgets'), href: '/budgets', icon: PiggyBank },
  { name: t('nav.recurring'), href: '/recurring', icon: Repeat },
  { name: t('nav.goals'), href: '/goals', icon: Target },
  { name: t('nav.debts'), href: '/debts', icon: CreditCard },
  { name: t('nav.calculators'), href: '/calculators', icon: Calculator },
  { name: t('nav.analytics'), href: '/analytics', icon: BarChart3 },
  { name: t('nav.advisor'), href: '/advisor', icon: Sparkles },
  { name: t('nav.map'), href: '/map', icon: Map },
  { name: t('nav.healthCoach'), href: '/health-coach', icon: Heart },
  { name: t('nav.shopping'), href: '/shopping', icon: ShoppingCart },
  { name: t('nav.kanban'), href: '/kanban', icon: Kanban },
  { name: t('nav.gmail'), href: '/gmail', icon: Mail },
  { name: t('nav.merchant'), href: '/merchant', icon: ShoppingBag },
  { name: t('nav.categoryExpenses'), href: '/category-expenses', icon: PieChart },
  { name: t('nav.settings'), href: '/settings', icon: Settings },
];

const bottomNavItems = (t) => [
  { name: t('nav.dashboard'), href: '/', icon: LayoutDashboard },
  { name: t('nav.transactions'), href: '/transactions', icon: Receipt },
  { name: t('nav.add'), href: '/add', icon: Plus, isFAB: true },
  { name: t('nav.budgets'), href: '/budgets', icon: PiggyBank },
  { name: t('nav.more'), href: '/more', icon: Menu },
];

import api from '../../services/api';
import { batch3 } from '../../i18n/keys_batch3';

// Desktop Sidebar
const Sidebar = () => {
  const location = useLocation();
  const { t , language } = useTranslation();
  const items = navItems(t);

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed h-full z-30 dark:bg-gray-800 dark:border-gray-700">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-100 dark:border-gray-700">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900 dark:text-white">{t.app_name}</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {isGroupedNavOn() ? (
          <GroupedNav navMap={buildNavMap(t)} icons={ICONS} />
        ) : (
        <>
        <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider dark:text-gray-300">{t('nav.dashboard')}</p>
        {items.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-50 text-primary-600 font-medium shadow-sm dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
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
        </>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-gray-100 space-y-1 dark:border-gray-700">
        {/* Interactive profile section - routes to the Profile Summary page */}
        <div className="mb-1">
          <div className="px-3 pb-3">
            <CurrencyBadge className="w-full justify-between" />
          </div>

          <UserProfileSection variant="sidebar" />
        </div>
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            location.pathname === '/settings'
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
              : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-sm">{t('nav.settings')}</span>
        </Link>
      </div>
    </aside>
  );
};

// Mobile Header
const MobileHeader = ({ title, showBack = false, onBack }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { t , language } = useTranslation();
  const K = batch3[language]?.navigation;
  const items = navItems(t);

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 z-40 safe-area-top">
        <div className="flex items-center justify-between h-full px-4">
          {/* Left */}
          <div className="flex items-center gap-3">
            {showBack ? (
              <button 
                onClick={onBack}
                className="p-2 -ml-2 text-gray-600 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-800 rounded-lg touch-manipulation"
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
            <h1 className="font-semibold text-lg text-gray-900 dark:text-white">{title}</h1>
          </div>
          
          {/* Right */}
          <div className="flex items-center gap-1">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              data-testid="theme-toggle"
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-2.5 text-gray-600 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-800 rounded-lg"
              title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <NotificationBell />
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 text-gray-600 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-800 rounded-lg touch-manipulation"
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
                <span className="font-semibold text-lg">{K.menu}</span>
                <button 
                  onClick={() => setMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Profile - interactive section that routes to Profile Summary */}
              <div className="p-4 border-b border-gray-100">
                <UserProfileSection
                  variant="menu"
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
              
              {/* Menu Items */}
              <nav className="flex-1 py-2 px-3 space-y-1 overflow-y-auto">
                {isGroupedNavOn() ? (
                  <GroupedNav navMap={buildNavMap(t)} icons={ICONS} />
                ) : (
                <>
                {items.map((item) => {
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
                </>
                )}
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
                  <span className="font-medium">{K.sign_out}</span>
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
const BottomNav = ({ pendingScanResult }) => {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const [showScanBadge, setShowScanBadge] = useState(false);
  const { t } = useTranslation();

  // Listen for scan completed events
  useEffect(() => {
    const handleScanComplete = (event) => {
      console.log('Scan completed event received:', event.detail);
      setShowScanBadge(true);
    };
    
    window.addEventListener('scanCompleted', handleScanComplete);
    return () => window.removeEventListener('scanCompleted', handleScanComplete);
  }, []);

  // Auto-hide badge after 10 seconds
  useEffect(() => {
    if (showScanBadge) {
      const timer = setTimeout(() => setShowScanBadge(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showScanBadge]);

  const items = bottomNavItems(t);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 safe-area-bottom dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-around h-full px-2">
          {items.map((item) => {
            const isActive = location.pathname === item.href;
            
            if (item.isFAB) {
              return (
                <Link
                  key={item.name}
                  to="/add"
                  className="flex flex-col items-center justify-center -mt-4"
                >
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30 active:scale-95 transition-transform">
                      <Plus className="w-7 h-7 text-white" />
                    </div>
                    {showScanBadge && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] mt-1 font-medium text-primary-600">
                    {showScanBadge ? '✓' : item.name}
                  </span>
                </Link>
              );
            }
            
            if (item.isMore) {
              return (
                <button
                  key={item.name}
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`flex flex-col items-center justify-center w-16 h-full touch-manipulation ${
                    moreOpen ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
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
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
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


// More Page
const MorePage = () => {
  const menuItems = [
    { icon: ShoppingBag, label: 'Toko / Merchant', href: '/merchant', color: 'bg-indigo-100 text-indigo-600', desc: 'POS & Kasir Cepat' },
    { icon: Package, label: 'Katalog', href: '/catalog', color: 'bg-teal-100 text-teal-600', desc: 'Toko & produk yang dipelajari' },
    { icon: PieChart, label: 'Category Expenses', href: '/category-expenses', color: 'bg-teal-100 text-teal-600', desc: 'View spending by category' },
    { icon: Target, label: 'Goals', href: '/goals', color: 'bg-purple-100 text-purple-600', desc: 'Track your savings goals' },
    { icon: CreditCard, label: 'Debts', href: '/debts', color: 'bg-orange-100 text-orange-600', desc: 'Manage loans & credits' },
    { icon: Repeat, label: 'Recurring', href: '/recurring', color: 'bg-blue-100 text-blue-600', desc: 'Automated transactions' },
    { icon: Calculator, label: 'Calculators', href: '/calculators', color: 'bg-green-100 text-green-600', desc: 'Financial calculators' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics', color: 'bg-pink-100 text-pink-600', desc: 'Insights & trends' },
    { icon: Map, label: 'Spending Map', href: '/map', color: 'bg-red-100 text-red-600', desc: 'Merchant locations & patterns' },
    { icon: Heart, label: 'Health Coach', href: '/health-coach', color: 'bg-green-100 text-green-600', desc: 'AI financial health assessment' },
    { icon: ShoppingCart, label: 'Shopping', href: '/shopping', color: 'bg-purple-100 text-purple-600', desc: 'Track prices & wishlist' },
    { icon: Mail, label: 'Gmail Sync', href: '/gmail', color: 'bg-orange-100 text-orange-600', desc: 'Auto-import from email' },
    { icon: Sparkles, label: 'AI Advisor', href: '/advisor', color: 'bg-cyan-100 text-cyan-600', desc: 'AI-powered financial advice' },
    { icon: User, label: 'Profile', href: '/settings/profile', color: 'bg-indigo-100 text-indigo-600', desc: 'Account settings' },
    { icon: Bell, label: 'Notifications', href: '/settings/notifications', color: 'bg-yellow-100 text-yellow-600', desc: 'Alerts & reminders' },
    { icon: Settings, label: 'Settings', href: '/settings/app', color: 'bg-gray-100 text-gray-600', desc: 'App configuration' },
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

export { Sidebar, MobileHeader, BottomNav, AddTransactionPage, MorePage };
