// Supabase Edge Functions API client
// Replace your existing api.ts with this

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://slrtkzgnwaovzvkjmfwz.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

const getToken = () => localStorage.getItem('token');

const request = async (endpoint, options = {}) => {
  const token = getToken();
  
  const res = await fetch(`${FUNCTIONS_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
};

export const api = {
  // Auth
  auth: {
    login: (email, password) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    register: (data) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    guest: (device_id) => request('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ device_id }),
    }),
    me: () => request('/auth/me'),
    supabaseExchange: (email, supabase_id) => request('/auth/supabase-exchange', {
      method: 'POST',
      body: JSON.stringify({ email, supabase_id }),
    }),
  },

  // Accounts
  accounts: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/accounts${query ? `?${query}` : ''}`);
    },
    get: (id) => request(`/accounts?id=${id}`),
    create: (data) => request('/accounts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/accounts?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/accounts?id=${id}`, {
      method: 'DELETE',
    }),
    balance: () => request('/accounts/balance'),
  },

  // Categories
  categories: {
    list: (type) => {
      const query = type ? `?type=${type}` : '';
      return request(`/categories${query}`);
    },
    create: (data) => request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/categories?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/categories?id=${id}`, {
      method: 'DELETE',
    }),
    seed: () => request('/categories/seed', { method: 'POST' }),
  },

  // Transactions
  transactions: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/transactions${query ? `?${query}` : ''}`);
    },
    get: (id) => request(`/transactions?id=${id}`),
    create: (data) => request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/transactions?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/transactions?id=${id}`, {
      method: 'DELETE',
    }),
  },

  // Transfers
  transfers: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/transfers${query ? `?${query}` : ''}`);
    },
    create: (data) => request('/transfers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/transfers?id=${id}`, {
      method: 'DELETE',
    }),
  },

  // Budgets
  budgets: {
    list: () => request('/budgets'),
    get: (id) => request(`/budgets?id=${id}`),
    create: (data) => request('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/budgets?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/budgets?id=${id}`, {
      method: 'DELETE',
    }),
  },

  // Recurring
  recurring: {
    list: () => request('/recurring'),
    get: (id) => request(`/recurring?id=${id}`),
    create: (data) => request('/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/recurring?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/recurring?id=${id}`, {
      method: 'DELETE',
    }),
  },

  // Goals
  goals: {
    list: () => request('/goals'),
    get: (id) => request(`/goals?id=${id}`),
    create: (data) => request('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/goals?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/goals?id=${id}`, {
      method: 'DELETE',
    }),
    contribute: (data) => request('/goals/contribute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Debts
  debts: {
    list: () => request('/debts'),
    get: (id) => request(`/debts?id=${id}`),
    create: (data) => request('/debts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => request(`/debts?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => request(`/debts?id=${id}`, {
      method: 'DELETE',
    }),
    payment: (data) => request('/debts/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Dashboard
  dashboard: {
    summary: () => request('/dashboard/summary'),
    cashFlow: (months = 6) => request(`/dashboard/cash-flow?months=${months}`),
    recent: () => request('/dashboard/recent'),
  },

  // Analytics
  analytics: {
    expenseBreakdown: (months = 1) => request(`/analytics/expense-breakdown?months=${months}`),
    incomeBreakdown: (months = 1) => request(`/analytics/income-breakdown?months=${months}`),
    trends: (months = 6) => request(`/analytics/trends?months=${months}`),
    insights: () => request('/analytics/insights'),
  },

  // Data
  data: {
    export: () => request('/data/export'),
    summary: () => request('/data/summary'),
  },

  // Calculators (no auth needed)
  calculators: {
    compoundInterest: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/calculators/compound-interest?${query}`);
    },
    loanCalculator: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/calculators/loan-calculator?${query}`);
    },
    savingsGoal: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/calculators/savings-goal?${query}`);
    },
    currencyConvert: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/calculators/currency-convert?${query}`);
    },
  },

  // Generic request
  request,
};

export default api;
