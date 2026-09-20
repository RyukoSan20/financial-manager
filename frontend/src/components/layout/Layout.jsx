import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileHeader, BottomNav } from './Navigation';

// Get page title from route
const getPageTitle = (pathname) => {
  const titles = {
    '/': 'Dashboard',
    '/transactions': 'Transactions',
    '/accounts': 'Accounts',
    '/budgets': 'Budgets',
    '/goals': 'Goals',
    '/debts': 'Debts',
    '/recurring': 'Recurring',
    '/calculators': 'Calculators',
    '/analytics': 'Analytics',
    '/settings': 'Settings',
    '/add': 'Add Transaction',
    '/more': 'More',
  };
  return titles[pathname] || 'FinManager';
};

export const Layout = () => {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  // Full screen pages (no nav)
  const fullScreenPages = ['/add'];
  const isFullScreen = fullScreenPages.includes(location.pathname);

  if (isFullScreen) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Header */}
      <MobileHeader title={title} />
      
      {/* Main Content */}
      <main className="lg:pl-64 pt-16 pb-24 lg:pb-8 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile Bottom Nav */}
      <BottomNav />
    </div>
  );
};

export default Layout;
