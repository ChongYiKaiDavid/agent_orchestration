import { useEffect, useRef, useState } from 'react';
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

type Toast = Notification & {
  // internal UI state
  visible: boolean;
  // timeout bookkeeping
  dismissTimerId?: number;
};

const AUTO_DISMISS_MS = 3000;

function getNotificationIcon(type: string) {
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
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'task_created':
      return 'nc-toast--blue';
    case 'task_started':
      return 'nc-toast--yellow';
    case 'task_completed':
      return 'nc-toast--green';
    case 'task_failed':
      return 'nc-toast--red';
    case 'pr_created':
      return 'nc-toast--purple';
    default:
      return 'nc-toast--gray';
  }
}

export default function NotificationsCenter() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Map toastId -> timeout id to avoid stale closures
  const dismissTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const flaskUrl = import.meta.env.VITE_FLASK_SOCKET_URL || import.meta.env.VITE_SOCKET_URL || import.meta.env.FLASK_SOCKET_URL || 'http://localhost:5002';
    console.log('[NotificationsCenter] connecting to', flaskUrl);

    const socket = io(flaskUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: false,
    });

    socket.on('notification', (notification: Notification) => {
      console.log('[NotificationsCenter] notification received', notification);
      setAllNotifications((prev) => [notification, ...prev]);

      // Add toast
      setToasts((prev) => {
        const toast: Toast = { ...notification, visible: true };
        return [toast, ...prev];
      });

      if (notification.read === 0) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    return () => {
      socket.disconnect();
      dismissTimersRef.current.forEach((t) => window.clearTimeout(t));
      dismissTimersRef.current.clear();
    };
  }, []);

  // When a new toast arrives, schedule auto-dismiss.
  useEffect(() => {
    toasts.forEach((toast) => {
      if (!toast.visible) return;
      if (dismissTimersRef.current.has(toast.id)) return;

      const timerId = window.setTimeout(() => {
        // fade out
        setToasts((prev) => prev.map((t) => (t.id === toast.id ? { ...t, visible: false } : t)));
        // remove from state after transition
        const removeTimer = window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          dismissTimersRef.current.delete(toast.id);
        }, 220);

        // Ensure remove timer is not GC'd
        void removeTimer;
      }, AUTO_DISMISS_MS);

      dismissTimersRef.current.set(toast.id, timerId);
    });
  }, [toasts]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowPanel(false);
      }
    };

    if (showPanel) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPanel]);

  const dismissToast = (id: string) => {
    // Cancel scheduled removal
    const timerId = dismissTimersRef.current.get(id);
    if (timerId) window.clearTimeout(timerId);
    dismissTimersRef.current.delete(id);

    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchNotifications = async () => {
    try {
      // The backend uses `userId` query param to filter.
      // Existing code creates notifications with user_id=NULL, so passing nothing fetches those.
      const resp = await fetch('/api/notifications');
      if (!resp.ok) throw new Error(await resp.text());
      const notifications: Notification[] = await resp.json();
      setAllNotifications(notifications);

      const unread = notifications.reduce((acc, n) => acc + (n.read === 0 ? 1 : 0), 0);
      setUnreadCount(unread);

      // Reconcile toast banners with latest read state.
      setToasts((prevToasts) => {
        const byId = new Map(notifications.map((n) => [n.id, n] as const));
        return prevToasts
          .filter((t) => byId.has(t.id) && (byId.get(t.id)!.read !== 1));
      });
    } catch (e) {
      console.error('[NotificationsCenter] failed to fetch notifications', e);
    }
  };

  const markAsRead = async (id: string) => {
    // Optimistic update
    setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: 1 } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    dismissToast(id);

    try {
      const resp = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(await resp.text());
      await fetchNotifications();
    } catch (e) {
      console.error('[NotificationsCenter] markAsRead failed', e);
      // Re-fetch to correct optimistic state
      await fetchNotifications();
    }
  };

  // Mark all as read (used by the notifications panel footer)
  const markAllAsRead = async () => {
    // Optimistic update
    setAllNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    // Remove toast banners too
    setToasts((prev) => prev.filter((t) => t.read !== 1));
    dismissTimersRef.current.forEach((timerId, id) => {
      window.clearTimeout(timerId);
      dismissTimersRef.current.delete(id);
    });
    setUnreadCount(0);

    try {
      const resp = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(await resp.text());
      await fetchNotifications();
    } catch (e) {
      console.error('[NotificationsCenter] markAllAsRead failed', e);
      await fetchNotifications();
    }
  };

  const openPanel = () => setShowPanel(true);
  const onToastPrimaryClick = (n: Notification) => {
    // macOS style: click to open list and mark it read
    markAsRead(n.id);
    setShowPanel(true);
  };

  return (
    <div className="notifications-center" aria-live="polite">
      {/* Bell */}
      <button
        ref={buttonRef}
        type="button"
        className="nc-bell"
        onClick={() => setShowPanel((v) => !v)}
        title="Notifications"
        aria-haspopup="dialog"
        aria-expanded={showPanel}
      >
        🔔
        {unreadCount > 0 && (
          <span className="nc-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Panel */}
      {showPanel && (
        <div ref={panelRef} className="nc-panel" role="dialog" aria-label="All notifications">
          <div className="nc-panel-header">
            <h3 className="nc-panel-title">Notifications</h3>
          </div>

          <div className="nc-panel-body">
            {allNotifications.length === 0 ? (
              <div className="nc-empty">No notifications</div>
            ) : (
              allNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`nc-item ${notification.read === 0 ? 'nc-item--unread' : ''}`}
                >
                  <div className="nc-item-row">
                    <span className="nc-item-icon" aria-hidden>
                      {getNotificationIcon(notification.type)}
                    </span>

                    <div className="nc-item-content">
                      <div className="nc-item-top">
                        <h4 className="nc-item-title">{notification.title}</h4>
                        {notification.read === 0 && <span className="nc-dot" aria-hidden />}
                      </div>

                      {notification.message && (
                        <p className="nc-item-message">{notification.message}</p>
                      )}

                      <div className="nc-item-time">
                        {new Date(notification.created_at).toLocaleString()}
                      </div>

                      {notification.read === 0 && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="nc-mark"
                          type="button"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="nc-panel-footer">
            <button
              onClick={markAllAsRead}
              className="nc-mark-all"
              type="button"
              disabled={unreadCount === 0}
              aria-disabled={unreadCount === 0}
            >
              Mark all as read
            </button>
          </div>

          {/* Clicking outside will close via effect */}
        </div>
      )}

      {/* Toasts (top-right banner) */}

      <div className="nc-toasts" aria-hidden={toasts.length === 0}>

        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`nc-toast ${toast.visible ? 'nc-toast--visible' : 'nc-toast--hidden'} ${
              getNotificationColor(toast.type)
            }`}
            role="status"
          >
            <div className="nc-toast-content">
              <button
                type="button"
                className="nc-toast-primary"
                onClick={() => onToastPrimaryClick(toast)}
              >
                <span className="nc-toast-icon" aria-hidden>
                  {getNotificationIcon(toast.type)}
                </span>
                <div className="nc-toast-text">
                  <div className="nc-toast-title">{toast.title}</div>
                  {toast.message && <div className="nc-toast-message">{toast.message}</div>}
                </div>
              </button>

              <button
                type="button"
                className="nc-toast-close"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ensure panel click does not bubble */}
      {showPanel ? <div onClick={openPanel} style={{ display: 'none' }} /> : null}
    </div>
  );
}
