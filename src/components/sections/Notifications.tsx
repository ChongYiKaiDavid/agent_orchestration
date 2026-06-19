import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

interface Notification {
  id: string;
  user_id: string | null;
  task_id: string | null;
  type: string;
  title: string;
  message: string | null;
  data: string | null;
  read: number;
  created_at: string;
}

export default function Notifications() {
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Session-based: don't fetch existing notifications, only show new ones during this session

    // Connect to Flask Socket.IO
    const flaskUrl = import.meta.env.VITE_FLASK_SOCKET_URL || 'http://localhost:5002';
    const socket = io(flaskUrl);

    socket.on('connect', () => {
      console.log('[Notifications] Connected to Socket.IO');
    });

    socket.on('connect_error', (err) => {
      console.error('[Notifications] Socket.IO connection error:', err);
    });

    // Listen for notification events
    socket.on('notification', (notification: Notification) => {
      setToasts(prev => [notification, ...prev]);
      setAllNotifications(prev => [notification, ...prev]);
      if (notification.read === 0) {
        setUnreadCount(prev => prev + 1);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowPanel(false);
      }
    };

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPanel]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const markAsRead = (id: string) => {
    // Session-based: just update local state, no API call
    setAllNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    dismissToast(id);
  };

  const markAllAsRead = () => {
    // Session-based: just update local state, no API call
    setAllNotifications(prev => prev.map(n => ({ ...n, read: 1 })));
    setUnreadCount(0);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_created':
        return '📝';
      case 'task_started':
        return '🚀';
      case 'task_completed':
        return '✅';
      case 'task_failed':
        return '❌';
      case 'pr_created':
        return '🔀';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'task_created':
        return 'border-l-blue-500';
      case 'task_started':
        return 'border-l-yellow-500';
      case 'task_completed':
        return 'border-l-green-500';
      case 'task_failed':
        return 'border-l-red-500';
      case 'pr_created':
        return 'border-l-purple-500';
      default:
        return 'border-l-gray-500';
    }
  };

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={() => {
            setShowPanel(!showPanel);
          }}
          className="relative p-2 text-gray-400 hover:text-white transition-colors"
          title="Notifications"
        >
          🔔
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Panel */}
        {showPanel && (
          <div ref={panelRef} className="fixed right-4 top-16 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {allNotifications.length === 0 ? (
                <div className="p-4 text-center text-gray-400">No notifications</div>
              ) : (
                allNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                      notification.read === 0 ? 'bg-gray-800/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-medium text-white text-sm">{notification.title}</h4>
                          {notification.read === 0 && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        {notification.message && (
                          <p className="text-sm text-gray-300 mt-1 line-clamp-2">{notification.message}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-2">
                          {new Date(notification.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {notification.read === 0 && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-80 bg-gray-900/95 backdrop-blur border border-gray-700 rounded-lg shadow-2xl overflow-hidden transform transition-all duration-300 ${getNotificationColor(toast.type)} border-l-4`}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-xl">{getNotificationIcon(toast.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-medium text-white text-sm">{toast.title}</h4>
                    <button
                      onClick={() => dismissToast(toast.id)}
                      className="text-gray-400 hover:text-white text-xs flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                  {toast.message && (
                    <p className="text-sm text-gray-300 mt-1 line-clamp-2">{toast.message}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => markAsRead(toast.id)}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300"
              >
                Mark as read
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
