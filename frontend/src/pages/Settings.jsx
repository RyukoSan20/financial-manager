import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Select } from '../components/ui';
import { User, Lock, Bell, Globe, Download, Trash2, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export const Settings = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'preferences', label: 'Preferences', icon: Globe },
    { id: 'data', label: 'Data', icon: Download },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your account settings</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={() => {
            localStorage.clear();
            logout();
          }}
          className="flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Tabs */}
        <div className="lg:w-64">
          <Card className="p-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'preferences' && <PreferencesTab user={user} />}
          {activeTab === 'data' && <DataTab logout={logout} />}
        </div>
      </div>
    </div>
  );
};

const ProfileTab = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    email: user?.email || '',
    username: user?.username || '',
    full_name: user?.full_name || '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const response = await api.request('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: form.full_name,
          username: form.username,
        }),
      });
      
      if (response) {
        setMessage('Profile updated successfully!');
        // Update localStorage with new user data
        const updatedUser = { ...user, ...form };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
      }
    } catch (error) {
      setMessage('Failed to update profile: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Profile Information</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          disabled
        />
        <Input
          label="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Changes
        </Button>
      </form>
    </Card>
  );
};

const SecurityTab = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (form.new_password !== form.confirm_password) {
      setMessage('Passwords do not match');
      return;
    }
    
    if (form.new_password.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await api.get('/auth/change-password', {
        old_password: form.current_password,
        new_password: form.new_password,
      });
      
      if (response) {
        setMessage('Password changed successfully!');
        setForm({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (error) {
      setMessage('Failed to change password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Change Password</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Current Password"
          type="password"
          value={form.current_password}
          onChange={(e) => setForm({ ...form, current_password: e.target.value })}
          required
        />
        <Input
          label="New Password"
          type="password"
          value={form.new_password}
          onChange={(e) => setForm({ ...form, new_password: e.target.value })}
          required
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={form.confirm_password}
          onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
          required
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Update Password
        </Button>
      </form>
    </Card>
  );
};

const PreferencesTab = ({ user }) => {
  const [currency, setCurrency] = useState(user?.default_currency || 'IDR');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Save to localStorage for now (backend update pending)
    const updatedUser = { ...user, default_currency: currency };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Preferences</h2>
      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700">
          Preferences saved!
        </div>
      )}
      <div className="space-y-4">
        <Select
          label="Default Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={[
            { value: 'IDR', label: 'Indonesian Rupiah (IDR)' },
            { value: 'USD', label: 'US Dollar (USD)' },
            { value: 'EUR', label: 'Euro (EUR)' },
            { value: 'SGD', label: 'Singapore Dollar (SGD)' },
            { value: 'MYR', label: 'Malaysian Ringgit (MYR)' },
          ]}
        />
        <Button onClick={handleSave}>Save Preferences</Button>
      </div>
    </Card>
  );
};

const DataTab = ({ logout }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleExportJSON = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.request('/data/export');
      
      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finmanager_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage('Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      setMessage('Export failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setLoading(true);
    setMessage('');

    try {
      const data = await api.request('/data/export/csv');
      
      // Create downloadable CSV file
      const blob = new Blob([data.content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage('Transactions exported successfully!');
    } catch (error) {
      console.error('CSV export error:', error);
      setMessage('Export failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete ALL your data? This action cannot be undone!')) {
      return;
    }
    
    if (!confirm('This will permanently delete all your accounts, transactions, budgets, goals, and debts. Continue?')) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await api.request('/data/delete-all', { method: 'DELETE' });
      setMessage('All data deleted successfully!');
      
      // Clear local storage
      localStorage.clear();
      
      // Logout and redirect
      setTimeout(() => {
        logout();
        window.location.href = '/login';
      }, 2000);
    } catch (error) {
      console.error('Delete error:', error);
      setMessage('Deletion failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Data Management</h2>
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-2">Export Data</h3>
          <p className="text-sm text-gray-500 mb-3">
            Download all your financial data for backup
          </p>
          <div className="flex gap-3">
            <Button onClick={handleExportJSON} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Export JSON (Full Backup)
            </Button>
            <Button variant="secondary" onClick={handleExportCSV} disabled={loading}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV (Transactions)
            </Button>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-medium mb-2 text-danger-600">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-3">
            Delete all your account data. This action cannot be undone.
          </p>
          <Button variant="danger" onClick={handleDelete} disabled={loading}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All Data
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default Settings;
