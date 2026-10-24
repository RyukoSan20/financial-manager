import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationToast } from './components/notifications/NotificationBell';
import { ScanNotification } from './components/parser/ScanNotification';
import { Layout } from './components/layout/Layout';
import { AddTransactionPage, MorePage } from './components/layout/Navigation';
import { I18nProvider } from './i18n';
import {
  Dashboard,
  MarketPage,
  Transactions,
  Accounts,
  Budgets,
  Goals,
  Debts,
  Recurring,
  Calculators,
  Analytics,
  Login,
  Register,
  Settings,
  MerchantMap,
  HealthCoach,
  ShoppingTracker,
  ShoppingBoard,
  GmailIntegration,
  GmailCallback,
  AIAdvisor,
  CategoryExpenses,
  FeedPage,
  MerchantManager,
  ShoppingPage
} from './pages';
import ProfileSettings from './pages/Settings/ProfileSettings';
import NotificationSettings from './pages/Settings/NotificationSettings';
import AppSettings from './pages/Settings/AppSettings';
import Appearance from './pages/Settings/Appearance';
import { CatalogPage } from './pages/CatalogPage';
import HelpSupport from './pages/Settings/HelpSupport';
import ProfileSummary from './pages/ProfileSummary';
import { AuthCallback } from './pages/AuthCallback';

// Auth Guard Component
const RequireAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Redirect if already logged in
const RedirectIfAuth = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationProvider>
            <NotificationToast />
            <BrowserRouter>
          {/* The financial background, behind everything. */}
          <div className="app-background" aria-hidden="true" />
          <Routes>
            {/* Auth routes - redirect if already logged in */}
            <Route 
              path="/login" 
              element={
                <RedirectIfAuth>
                  <Login />
                </RedirectIfAuth>
              } 
            />
            <Route 
              path="/register" 
              element={
                <RedirectIfAuth>
                  <Register />
                </RedirectIfAuth>
              } 
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            
            {/* Protected app routes */}
            <Route path="/" element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="category-expenses" element={<CategoryExpenses />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="goals" element={<Goals />} />
              <Route path="debts" element={<Debts />} />
              <Route path="recurring" element={<Recurring />} />
              <Route path="calculators" element={<Calculators />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="merchant" element={<MerchantManager />} />
              <Route path="map" element={<MerchantMap />} />
              <Route path="advisor" element={<AIAdvisor />} />
              <Route path="health-coach" element={<HealthCoach />} />
              <Route path="shopping" element={<ShoppingTracker />} />
              <Route path="shopping/board" element={<ShoppingBoard />} />
              <Route path="gmail" element={<GmailIntegration />} />
              <Route path="gmail/callback" element={<GmailCallback />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="kanban" element={<ShoppingPage />} />
              <Route path="market" element={<MarketPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="settings/profile" element={<ProfileSettings />} />
              <Route path="profile/summary" element={<ProfileSummary />} />
              <Route path="settings/notifications" element={<NotificationSettings />} />
              <Route path="settings/app" element={<AppSettings />} />
              <Route path="settings/appearance" element={<Appearance />} />
              <Route path="catalog" element={<CatalogPage />} />
              <Route path="help" element={<HelpSupport />} />
              <Route path="more" element={<MorePage />} />
            </Route>
            
            {/* Full screen pages - also protected */}
            <Route 
              path="/add" 
              element={
                <RequireAuth>
                  <AddTransactionPage />
                </RequireAuth>
              } 
            />
            
            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>

          {/* The background scan notification. It sits above everything
              else so a finished scan is visible from any page. */}
          <ScanNotification />
        </BrowserRouter>
        </NotificationProvider>
        </ThemeProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
