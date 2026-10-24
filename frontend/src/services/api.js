// VPS backend - self-hosted production
// VITE_API_URL already includes /api (e.g. https://my-financial-manager.online/api)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://my-financial-manager.online/api';

import { sanitizePayload } from '../utils/sanitize';

// Support both backend JWT (token) and Supabase (sb_token)
const TOKEN_KEYS = ['token', 'sb_token'];

export const getToken = () => {
  for (const key of TOKEN_KEYS) {
    const token = localStorage.getItem(key);
    if (token) return token;
  }
  return null;
};

// Set token
export const setToken = (token) => {
  localStorage.setItem('token', token);
};

// Clear token
export const clearToken = () => {
  localStorage.removeItem('token');
};

// Check if authenticated
export const isAuthenticated = () => !!getToken();

// Don't auto-redirect - let components handle 401 gracefully
const handleAuthError = (response) => {
  if (response.status === 401) {
    console.warn('401 Unauthorized');
    // Clear expired/invalid tokens
    clearToken();
    // Don't auto-redirect - throw error instead
    throw new Error('Session expired. Please login again.');
  }
};

// Base fetch with interceptor - handles auth and error formatting
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

  const response = await fetch(url, config);
  
  // Handle 401 Unauthorized
  if (response.status === 401) {
    handleAuthError(response);
  }
  
  // Handle 204 No Content (DELETE success) - return Response object with status
  if (response.status === 204) {
    return response; // Return Response object, not parsed result
  }
  
  // Handle other error responses
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: `HTTP ${response.status}` };
    }
    
    // Format error message from backend validation errors
    let errorMsg = 'Request failed';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        errorMsg = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        // FastAPI validation errors: [{loc: [...], msg: "...", type: "..."}]
        errorMsg = errorData.detail.map(e => e.msg || JSON.stringify(e)).join(', ');
      } else if (typeof errorData.detail === 'object') {
        errorMsg = JSON.stringify(errorData.detail);
      }
    }
    throw new Error(errorMsg);
  }
  
  return response;
};

export const api = {
  // Base request wrapper
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    try {
      // The forms keep their state as strings, so an empty optional date
      // arrives as "". The backend cannot parse that as a date, and the
      // whole request fails with a 422. Cleaning the payload here means
      // every page is covered, not just the one that was reported.
      const finalOptions = { ...options };
      if (
        finalOptions.body &&
        finalOptions.method &&
        finalOptions.method !== 'GET'
      ) {
        try {
          // The body is sometimes a plain object and sometimes a JSON
          // string. Both have to be cleaned, because an empty optional
          // date is the bug this guards against.
          const parsed =
            typeof finalOptions.body === 'string'
              ? JSON.parse(finalOptions.body)
              : finalOptions.body;
          finalOptions.body = JSON.stringify(sanitizePayload(parsed));
        } catch {
          // The body was not JSON. Send it as it is.
        }
      }

      const response = await fetchWithInterceptor(url, finalOptions);
      
      // Handle 204 No Content - return success object
      if (response.status === 204) {
        return { success: true };
      }
      
      // Parse JSON response
      return response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  },

  // Auth
  auth: {
    login: (email, password) => api.request('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
    register: (data) => api.request('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    me: () => api.request('/me'),
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
    // The type is a query parameter. Putting it in the path made the
    // server read "expense" as a category id and answer with 422.
    list: (type) => api.request(`/categories/${type ? `?type=${encodeURIComponent(type)}` : ''}`),
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
  // The lines inside a financial record.
  // A transaction, a budget, a recurring rule, a goal and a debt can all
  // carry them.
  breakdown: {
    read: (parentType, parentId) =>
      api.request(`/breakdown/${parentType}/${parentId}`),
    write: (parentType, parentId, lines, replace = true) =>
      api.request(`/breakdown/${parentType}/${parentId}`, {
        method: 'PUT',
        body: { lines, replace },
      }),
    addLine: (parentType, parentId, line) =>
      api.request(`/breakdown/${parentType}/${parentId}/lines`, {
        method: 'POST',
        body: line,
      }),
    removeLine: (parentType, parentId, lineId) =>
      api.request(`/breakdown/${parentType}/${parentId}/lines/${lineId}`, {
        method: 'DELETE',
      }),
    previewGoal: (payload) =>
      api.request('/breakdown/goal/preview', {
        method: 'POST',
        body: payload,
      }),
  },

  // Which way does the money go?
  // The backend owns this decision, so the quick entry box, the voice
  // parser and the AI agent all give the same answer for the same
  // sentence.
  direction: {
    classify: (text, merchant = null) =>
      api.request('/parser/direction', {
        method: 'POST',
        body: JSON.stringify({ text, merchant }),
      }),
    // A correction the user made. The backend remembers it so the same
    // wording is classified the same way next time.
    feedback: (text, direction, merchant = null) =>
      api.request('/parser/direction/feedback', {
        method: 'POST',
        body: JSON.stringify({ text, merchant, direction }),
      }),
  },

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

  // AI Advisor
  ai: {
    advice: () => api.request('/ai/advice'),
    summary: () => api.request('/ai/summary'),
    // The chat endpoint answers a question. It takes the conversation
    // with it, so a follow up can refer to what was said before.
    chat: (payload) => api.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
    execute: (message) => api.request('/ai/execute', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
    // The real agent: it reads the intent first, so a number means "record
    // this" while a question about a budget only reports information.
    agent: (message, planOnly = false, history = []) => api.request('/ai/agent', {
      method: 'POST',
      body: JSON.stringify({ message, plan_only: planOnly, history }),
    }),
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
    exportCsv: () => api.request('/data/export/csv'),
    deleteAll: () => api.request('/data/delete-all', { method: 'DELETE' }),
  },

  // Background Scan Jobs
  scanJobs: {
    upload: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/scan-jobs/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail || 'Upload failed');
      }
      
      return response.json();
    },
    
    status: (jobId) => api.request(`/scan-jobs/${jobId}`),
    
    chunks: (jobId) => api.request(`/scan-jobs/${jobId}/chunks`),
    
    list: (params = {}) => {
      const searchParams = new URLSearchParams(params).toString();
      return api.request(`/scan-jobs/${searchParams ? `?${searchParams}` : ''}`);
    },
    
    cancel: (jobId) => api.request(`/scan-jobs/${jobId}`, { method: 'DELETE' }),
  },

  // Feed & Review API
  feed: {
    scanReceipt: async (imageBase64, accountId = null) => {
      return api.request('/feed/scan-receipt', {
        method: 'POST',
        body: JSON.stringify({ 
          image: imageBase64,
          account_id: accountId,
          auto_approve: false,
          source: 'camera_scan'
        }),
      });
    },
    pending: (limit = 50) => api.request(`/feed/pending?limit=${limit}`),
    all: (status = null, limit = 50) => {
      const params = new URLSearchParams({ limit });
      if (status) params.append('status', status);
      return api.request(`/feed/all?${params.toString()}`);
    },
    stats: () => api.request('/feed/stats'),
    approve: (transactionId) => api.request(`/feed/approve/${transactionId}`, { method: 'POST' }),
    reject: (transactionId, note = null) => api.request(`/feed/reject/${transactionId}`, { 
      method: 'POST',
      body: note ? JSON.stringify({ note }) : undefined,
    }),
  },

  // Health check
  health: () => api.request('/health'),
  info: () => api.request('/info'),

  // Advanced Pipeline APIs
  healthCoach: {
    score: () => api.request('/health-coach/score'),
    audit: () => api.request('/health-coach/audit'),
    recommendations: () => api.request('/health-coach/recommendations'),
  },

  location: {
    stats: (period = 'current') => api.request(`/location/stats?period=${period}`),
    heatmap: () => api.request('/location/heatmap'),
    topLocations: (limit = 10) => api.request(`/location/top-locations?limit=${limit}`),
  },

  shopping: {
    items: (transactionId = null, limit = 50) => {
      const params = new URLSearchParams({ limit });
      if (transactionId) params.append('transaction_id', transactionId);
      return api.request(`/shopping/items?${params.toString()}`);
    },
    priceHistory: (itemName) => api.request(`/shopping/price-history/${encodeURIComponent(itemName)}`),
    priceComparison: (itemName) => api.request(`/shopping/price-comparison?item_name=${encodeURIComponent(itemName)}`),
    wishlist: () => api.request('/shopping/wishlist'),
    addWishlist: (data) => api.request('/shopping/wishlist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    updateWishlist: (id, data) => api.request(`/shopping/wishlist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    deleteWishlist: (id) => api.request(`/shopping/wishlist/${id}`, { method: 'DELETE' }),
  },

  gmail: {
    connect: () => api.request('/integrations/gmail/connect'),
    callback: (code, state) => api.request(`/integrations/gmail/callback?code=${code}&state=${state}`),
    status: () => api.request('/integrations/gmail/status'),
    disconnect: () => api.request('/integrations/gmail/disconnect', { method: 'POST' }),
    sync: () => api.request('/integrations/gmail/sync', { method: 'POST' }),
  },

  errors: {
    report: (errorData) => api.request('/errors/client', {
      method: 'POST',
      body: JSON.stringify(errorData),
    }),
  },
  
  // Generic GET for custom endpoints
  get: (path) => api.request(path),
  
  // Exchange rates
  exchange: {
    rates: (base = 'USD') => api.request(`/exchange/rates?base=${base}`),
    convert: (amount, from, to) => api.request('/exchange/convert', {
      method: 'POST',
      body: JSON.stringify({ amount, from_currency: from, to_currency: to }),
    }),
    symbols: () => api.request('/exchange/symbols'),
  },
};

export default api;
// Build: Wed Oct 14 21:26:53 WIB 2026
