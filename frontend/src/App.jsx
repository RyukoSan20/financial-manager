import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { AddTransactionPage, MorePage } from './components/layout/Navigation';
import { ProtectedRoute } from './components/common/ProtectedRoute';
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Main app routes */}
          <Route path="/" element={<Layout />}>
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
          
          {/* Full screen pages */}
          <Route path="/add" element={<AddTransactionPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
