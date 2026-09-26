import { Bell, X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useState, useEffect } from 'react';

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-green-50 border-green-500 text-green-800',
  error: 'bg-red-50 border-red-500 text-red-800',
  warning: 'bg-yellow-50 border-yellow-500 text-yellow-800',
  info: 'bg-blue-50 border-blue-500 text-blue-800',
};

export const NotificationToast = () => {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
      {notifications.map((notification) => {
        const Icon = iconMap[notification.type] || Info;
        return (
          <div
            key={notification.id}
            className={`flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg animate-slideIn ${colorMap[notification.type]}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {notification.title && (
                <p className="font-semibold text-sm">{notification.title}</p>
              )}
              <p className="text-sm">{notification.message}</p>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 hover:opacity-70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

// Notification Bell in Navigation
export const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load notifications from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('notifications');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  }, []);

  // Listen for custom events
  useEffect(() => {
    const handleNotification = (event) => {
      const newNotif = {
        id: Date.now(),
        ...event.detail,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      setNotifications(prev => {
        const updated = [newNotif, ...prev].slice(0, 50);
        localStorage.setItem('notifications', JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      localStorage.setItem('notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem('notifications');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border z-50">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <button 
                    onClick={markAllRead}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    Mark all read
                  </button>
                )}
                <button 
                  onClick={clearAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div 
                    key={notif.id}
                    className={`p-4 border-b last:border-0 ${notif.read ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {notif.type && (
                        <span className={`w-2 h-2 rounded-full mt-2 ${
                          notif.type === 'success' ? 'bg-green-500' :
                          notif.type === 'error' ? 'bg-red-500' :
                          notif.type === 'warning' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{notif.title || notif.message}</p>
                        {notif.description && (
                          <p className="text-xs text-gray-500 mt-1">{notif.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notif.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper to show notifications from anywhere
export const showNotification = (notification) => {
  window.dispatchEvent(new CustomEvent('app-notification', { detail: notification }));
};

export default NotificationBell;
