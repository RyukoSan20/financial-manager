/**
 * The toast provider.
 *
 * This is the door every page goes through to say something. It
 * exists because the browser's own `alert` was doing this job, and
 * the browser's own `alert` cannot be styled, cannot be translated,
 * and on a phone sits behind the page.
 *
 * The provider is mounted once, near the top of the application, and
 * the toast stack lives in the corner of the window.
 *
 * There is also `useToast()` for the pages that live inside the
 * provider.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import MoeToast from '../components/common/MoeToast';

const ToastContext = createContext(null);

/**
 * The toast provider.
 */
export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((item) => {
    // A number that is only ever increased, so two messages that
    // arrive in the same millisecond do not share a number and one of
    // them is never taken away.
    const id = item.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = {
      id,
      type: 'info',
      duration: 4000,
      ...item,
    };
    setItems((current) => [...current, next]);
    return id;
  }, []);

  const success = useCallback((message, extra = {}) => push({ ...extra, type: 'success', message }), [push]);
  const error = useCallback((message, extra = {}) => push({ ...extra, type: 'error', message }), [push]);
  const warning = useCallback((message, extra = {}) => push({ ...extra, type: 'warning', message }), [push]);
  const info = useCallback((message, extra = {}) => push({ ...extra, type: 'info', message }), [push]);

  // The provider hears the event itself, so a page that is not inside
  // it can still say something. The listener is the provider's, not
  // the hook's, because the hook would have to be mounted in every
  // page that wants to speak.
  useEffect(() => {
    const onToast = (event) => {
      const detail = event.detail;
      if (!detail) return;
      push(detail);
    };
    window.addEventListener('app-toast', onToast);
    return () => window.removeEventListener('app-toast', onToast);
  }, [push]);

  const value = useMemo(
    () => ({ items, push, dismiss, success, error, warning, info }),
    [items, push, dismiss, success, error, warning, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <MoeToast items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

/**
 * The toast, from inside the provider.
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

/**
 * The toast, from anywhere.
 *
 * A page that is not inside the provider can still say something: it
 * fires an event, and the provider hears it. This is what lets a
 * component deep in the tree say something without every page having
 * to thread a context through to it.
 */
export const toast = {
  push: (detail) => {
    if (typeof window === 'undefined') return null;
    window.dispatchEvent(new CustomEvent('app-toast', { detail }));
    return detail?.id || null;
  },
  success: (message, extra = {}) => toast.push({ ...extra, type: 'success', message }),
  error: (message, extra = {}) => toast.push({ ...extra, type: 'error', message }),
  warning: (message, extra = {}) => toast.push({ ...extra, type: 'warning', message }),
  info: (message, extra = {}) => toast.push({ ...extra, type: 'info', message }),
};

export default ToastProvider;
