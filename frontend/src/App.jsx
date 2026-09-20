import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
  Analytics 
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          <Route path="settings" element={<Settings />} />
          <Route path="more" element={<MorePage />} />
        </Route>
        
        {/* Full screen pages */}
        <Route path="/add" element={<AddTransactionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

// Settings placeholder
const Settings = () => (
  <div className="min-h-screen bg-gray-50 pb-24">
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <p className="text-gray-500">Settings page coming soon...</p>
      </div>
    </div>
  </div>
);

export default App;
