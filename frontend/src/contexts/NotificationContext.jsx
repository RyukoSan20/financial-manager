import { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // A counter that is only ever increased, so that two notifications
  // never share a number.
  const nextId = useRef(0);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const addNotification = useCallback((notification) => {
    // The number of the clock is not enough on its own: two
    // notifications that arrive in the same millisecond would share a
    // number, and the first one would then never be taken away.
    const id = `${Date.now()}-${nextId.current++}`;
    const newNotification = {
      id,
      type: 'info',
      duration: 5000,
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto remove after duration
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [removeNotification]);

  const success = (message) => addNotification({ type: 'success', message });
  const error = (message) => addNotification({ type: 'error', message });
  const warning = (message) => addNotification({ type: 'warning', message });
  const info = (message) => addNotification({ type: 'info', message });

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification, success, error, warning, info }}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
