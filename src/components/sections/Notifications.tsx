import { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Connect to Flask Socket.IO
    const flaskUrl = import.meta.env.VITE_FLASK_SOCKET_URL || 'http://localhost:5002';
    const socket = io(flaskUrl);

    // Listen for notification events
    socket.on('notification', (notification: Notification) => {
      setToasts(prev => [notification, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const markAsRead = async (id: string) => {
    try {
      await fetch(`http://localhost:5174/api/notifications/${id}/read`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
    dismissToast(id);
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
  );
}
