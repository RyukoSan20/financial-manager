import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

// Generic data fetching hook
//
// The caller says what to fetch and what to wait for. The fetch
// function is held in a ref, so that a function written in the body
// of a component does not make the effect run again for nothing.
export const useApi = (fetchFn, deps = [], options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { skip = false, onSuccess, onError } = options;

  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;
  const callbacksRef = useRef({ onSuccess, onError });
  callbacksRef.current = { onSuccess, onError };

  const fetchData = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchRef.current();
      setData(result);
      if (callbacksRef.current.onSuccess) callbacksRef.current.onSuccess(result);
    } catch (err) {
      setError(err.message || 'An error occurred');
      if (callbacksRef.current.onError) callbacksRef.current.onError(err);
    } finally {
      setLoading(false);
    }
  }, [skip]);

  useEffect(() => {
    fetchData();
    // The dependencies the caller gave are spread here on purpose:
    // they are the caller's own list of things to wait for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // The filters are held in a ref, so that a new object with the same
  // values does not make the callback new, and the list is not
  // fetched again for nothing. The values that are read are the ones
  // from the last render, which is the point of the ref.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.transactions.list({
        skip: (pagination.page - 1) * pagination.limit,
        limit: pagination.limit,
        ...filtersRef.current,
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

  return { transactions, loading, error, pagination, setPage, setFilters, refetch: fetchData };
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
