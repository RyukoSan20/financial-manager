import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { NotificationToast } from './components/notifications/NotificationBell';
import { Layout } from './components/layout/Layout';
import { AddTransactionPage, MorePage } from './components/layout/Navigation';
import { 
  Dashboard, 
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
  AIAdvisor
} from './pages';
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
    <AuthProvider>
      <NotificationProvider>
        <NotificationToast />
        <BrowserRouter>
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
            <Route path="accounts" element={<Accounts />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="goals" element={<Goals />} />
            <Route path="debts" element={<Debts />} />
            <Route path="recurring" element={<Recurring />} />
            <Route path="calculators" element={<Calculators />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="map" element={<MerchantMap />} />
            <Route path="advisor" element={<AIAdvisor />} />
            <Route path="settings" element={<Settings />} />
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
      </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
