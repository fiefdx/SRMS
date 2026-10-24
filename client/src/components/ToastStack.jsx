import { useEffect } from 'react';
import { useApp } from '../hooks/useApp';

const AUTO_DISMISS_MS = 4500;

/**
 * Toast notifications: one timer per toast, cleaned up on unmount so we never leak timeouts.
 */
function Toast({ notification, onDismiss }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(notification.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [notification.id, onDismiss]);

  return (
    <div className={`toast ${notification.tone}`} role="status">
      <span>{notification.message}</span>
      <button onClick={() => onDismiss(notification.id)} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}

export default function ToastStack() {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="toast-stack">
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} onDismiss={dismissNotification} />
      ))}
    </div>
  );
}
