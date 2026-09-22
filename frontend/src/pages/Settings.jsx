import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, Select } from '../components/ui';
import { User, Lock, Bell, Globe, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings</p>
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
  const [form, setForm] = useState({
    email: user?.email || '',
    username: user?.username || '',
    fullName: user?.full_name || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement profile update
    alert('Profile update coming soon!');
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Profile Information</h2>
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
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
        />
        <Button type="submit">Save Changes</Button>
      </form>
    </Card>
  );
};

const SecurityTab = () => {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // TODO: Implement password change
    alert('Password change coming soon!');
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Change Password</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Current Password"
          type="password"
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
        />
        <Input
          label="New Password"
          type="password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        />
        <Button type="submit">Update Password</Button>
      </form>
    </Card>
  );
};

const PreferencesTab = ({ user }) => {
  const [currency, setCurrency] = useState(user?.default_currency || 'IDR');

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Preferences</h2>
      <div className="space-y-4">
        <Select
          label="Default Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          options={[
            { value: 'IDR', label: 'Indonesian Rupiah (IDR)' },
            { value: 'USD', label: 'US Dollar (USD)' },
            { value: 'EUR', label: 'Euro (EUR)' },
          ]}
        />
        <Button onClick={() => alert('Preferences saved!')}>Save Preferences</Button>
      </div>
    </Card>
  );
};

const DataTab = ({ logout }) => {
  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export feature coming soon!');
  };

  const handleDelete = () => {
    if (confirm('Are you sure? This will delete all your data permanently!')) {
      // TODO: Implement data deletion
      alert('Data deletion coming soon!');
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold mb-6">Data Management</h2>
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-2">Export Data</h3>
          <p className="text-sm text-gray-500 mb-3">
            Download all your financial data as CSV
          </p>
          <Button onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export to CSV
          </Button>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-medium mb-2 text-danger-600">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-3">
            Delete all your account data. This action cannot be undone.
          </p>
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete All Data
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default Settings;
