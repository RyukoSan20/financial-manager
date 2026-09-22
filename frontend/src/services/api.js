// API Configuration with JWT Interceptor
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const TOKEN_KEY = 'token';

// Get token from localStorage
const getToken = () => localStorage.getItem(TOKEN_KEY);

// Set token
export const setToken = (token) => {
  localStorage.setItem(TOKEN_KEY, token);
};

// Clear token
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// Check if authenticated
export const isAuthenticated = () => !!getToken();

// Redirect to login
const redirectToLogin = () => {
  clearToken();
  window.location.href = '/login';
};

// Base fetch with interceptor
const fetchWithInterceptor = async (url, options = {}) => {
  const token = getToken();
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.warn('401 Unauthorized - clearing token and redirecting');
      redirectToLogin();
      throw new Error('Session expired. Please login again.');
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    
    return response;
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
};

export const api = {
  // Base request wrapper
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      const response = await fetchWithInterceptor(url, options);
      return response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Auth
  auth: {
    login: (email, password) => api.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    register: (data) => api.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    me: () => api.request('/auth/me'),
  },

  // Accounts
  accounts: {
    list: () => api.request('/accounts/'),
    get: (id) => api.request(`/accounts/${id}`),
    create: (data) => api.request('/accounts/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/accounts/${id}`, { method: 'DELETE' }),
    balance: () => api.request('/accounts/summary/total-balance'),
  },

  // Categories
  categories: {
    list: (type) => api.request(`/categories/${type ? `?type=${type}` : ''}`),
    get: (id) => api.request(`/categories/${id}`),
    create: (data) => api.request('/categories/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/categories/${id}`, { method: 'DELETE' }),
    seed: () => api.request('/categories/seed-defaults', { method: 'POST' }),
  },

  // Transactions
  transactions: {
    list: (params = {}) => {
      const searchParams = new URLSearchParams(params).toString();
      return api.request(`/transactions/${searchParams ? `?${searchParams}` : ''}`);
    },
    get: (id) => api.request(`/transactions/${id}`),
    create: (data) => api.request('/transactions/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/transactions/${id}`, { method: 'DELETE' }),
    summary: (startDate, endDate) => api.request(`/transactions/summary/by-period?start_date=${startDate}&end_date=${endDate}`),
  },

  // Transfers
  transfers: {
    list: (params = {}) => {
      const searchParams = new URLSearchParams(params).toString();
      return api.request(`/transfers/${searchParams ? `?${searchParams}` : ''}`);
    },
    create: (data) => api.request('/transfers/', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/transfers/${id}`, { method: 'DELETE' }),
  },

  // Budgets
  budgets: {
    list: () => api.request('/budgets/'),
    get: (id) => api.request(`/budgets/${id}`),
    create: (data) => api.request('/budgets/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/budgets/${id}`, { method: 'DELETE' }),
    progress: (id) => api.request(`/budgets/${id}/progress`),
  },

  // Recurring
  recurring: {
    list: () => api.request('/recurring/'),
    get: (id) => api.request(`/recurring/${id}`),
    create: (data) => api.request('/recurring/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/recurring/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/recurring/${id}`, { method: 'DELETE' }),
    generate: (id) => api.request(`/recurring/${id}/generate`, { method: 'POST' }),
    upcoming: (days = 7) => api.request(`/recurring/upcoming?days=${days}`),
  },

  // Goals
  goals: {
    list: () => api.request('/goals/'),
    get: (id) => api.request(`/goals/${id}`),
    create: (data) => api.request('/goals/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/goals/${id}`, { method: 'DELETE' }),
    contribute: (id, data) => api.request(`/goals/${id}/contribute`, { method: 'POST', body: JSON.stringify(data) }),
    summary: () => api.request('/goals/summary'),
  },

  // Debts
  debts: {
    list: () => api.request('/debts/'),
    get: (id) => api.request(`/debts/${id}`),
    create: (data) => api.request('/debts/', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => api.request(`/debts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => api.request(`/debts/${id}`, { method: 'DELETE' }),
    payment: (id, data) => api.request(`/debts/${id}/payment`, { method: 'POST', body: JSON.stringify(data) }),
    schedule: (id) => api.request(`/debts/${id}/schedule`),
    summary: () => api.request('/debts/summary/all'),
  },

  // Dashboard
  dashboard: {
    summary: (startDate, endDate) => {
      let url = '/dashboard/summary';
      const params = [];
      if (startDate) params.push(`start_date=${startDate}`);
      if (endDate) params.push(`end_date=${endDate}`);
      if (params.length) url += `?${params.join('&')}`;
      return api.request(url);
    },
    cashFlow: (months = 6) => api.request(`/dashboard/cash-flow?months=${months}`),
    categoryBreakdown: (type) => api.request(`/dashboard/category-breakdown?type=${type}`),
  },

  // Analytics
  analytics: {
    cashFlowTrend: (months = 6) => api.request(`/analytics/cash-flow-trend?months=${months}`),
    expenseBreakdown: (params = {}) => {
      const searchParams = new URLSearchParams(params).toString();
      return api.request(`/analytics/expense-breakdown${searchParams ? `?${searchParams}` : ''}`);
    },
    topExpenses: (limit = 10) => api.request(`/analytics/top-expenses?limit=${limit}`),
    recurringExpenses: () => api.request('/analytics/recurring-expenses'),
    incomeBreakdown: (params = {}) => {
      const searchParams = new URLSearchParams(params).toString();
      return api.request(`/analytics/income-breakdown${searchParams ? `?${searchParams}` : ''}`);
    },
    budgetVsActual: () => api.request('/analytics/budget-vs-actual'),
    spendingPatterns: () => api.request('/analytics/spending-patterns'),
    netWorthHistory: (months = 12) => api.request(`/analytics/net-worth-history?months=${months}`),
    snapshot: () => api.request('/analytics/net-worth-snapshot', { method: 'POST' }),
    monthlyComparison: (months = 3) => api.request(`/analytics/monthly-comparison?months=${months}`),
    financialHealth: () => api.request('/analytics/financial-health'),
  },

  // Calculators
  calculators: {
    discount: (data) => api.request('/calculators/discount', { method: 'POST', body: JSON.stringify(data) }),
    tax: (data) => api.request('/calculators/tax', { method: 'POST', body: JSON.stringify(data) }),
    tip: (data) => api.request('/calculators/tip', { method: 'POST', body: JSON.stringify(data) }),
    splitBill: (data) => api.request('/calculators/split-bill', { method: 'POST', body: JSON.stringify(data) }),
    loanPayment: (data) => api.request('/calculators/loan-payment', { method: 'POST', body: JSON.stringify(data) }),
    compoundInterest: (data) => api.request('/calculators/compound-interest', { method: 'POST', body: JSON.stringify(data) }),
    budgetAllocation: (data) => api.request('/calculators/budget-allocation', { method: 'POST', body: JSON.stringify(data) }),
    affordability: (data) => api.request('/calculators/affordability', { method: 'POST', body: JSON.stringify(data) }),
  },

  // Data Export
  data: {
    export: () => api.request('/data/export'),
  },

  // Health check
  health: () => api.request('/health'),
  info: () => api.request('/info'),
};

export default api;
