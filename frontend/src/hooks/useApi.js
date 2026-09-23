import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Generic data fetching hook
export const useApi = (fetchFn, deps = [], options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { skip = false, onSuccess, onError } = options;

  const fetchData = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      setData(result);
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setError(err.message || 'An error occurred');
      if (onError) onError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, skip, onSuccess, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);

  return { data, loading, error, refetch: fetchData };
};

// Dashboard data hook
export const useDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryRes, cashFlowRes, expensesRes] = await Promise.all([
        api.dashboard.summary(),
        api.dashboard.cashFlow(),
        api.analytics.expenseBreakdown(),
      ]);

      setSummary(summaryRes);
      setCashFlow(cashFlowRes);
      setExpenses(expensesRes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { summary, cashFlow, expenses, loading, error, refetch: fetchData };
};

// Transactions hook with filters
export const useTransactions = (filters = {}) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 50 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.transactions.list({
        skip: (pagination.page - 1) * pagination.limit,
        limit: pagination.limit,
        ...filters,
      });
      setTransactions(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setPage = (page) => setPagination(prev => ({ ...prev, page }));
  const setFilters = () => fetchData();

  return { transactions, loading, error, pagination, setPage, refetch: fetchData };
};

// Modal state hook
export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState(null);

  const open = (initialData = null) => {
    setData(initialData);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setData(null);
  };

  return { isOpen, data, open, close };
};

// Toast/notification hook
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return { toasts, addToast, removeToast };
};
