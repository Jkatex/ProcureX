import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useEffect, useState } from 'react';
import type { NotificationTone, UserNotification } from '@/shared/types/notifications';

type NotificationCardProps = {
  notification: Pick<UserNotification, 'tone' | 'title' | 'message' | 'reason' | 'action' | 'details' | 'dismissible' | 'autoDismissMs'>;
  onDismiss?: () => void;
  compact?: boolean;
};

function ToneIcon({ tone }: { tone: NotificationTone }) {
  if (tone === 'success') return <CheckCircleRoundedIcon fontSize="small" aria-hidden="true" />;
  if (tone === 'warning') return <WarningAmberRoundedIcon fontSize="small" aria-hidden="true" />;
  if (tone === 'error') return <ErrorOutlineRoundedIcon fontSize="small" aria-hidden="true" />;
  return <InfoRoundedIcon fontSize="small" aria-hidden="true" />;
}

export function NotificationCard({ notification, onDismiss, compact = false }: NotificationCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const role = notification.tone === 'success' || notification.tone === 'info' ? 'status' : 'alert';
  const ariaLive = notification.tone === 'success' || notification.tone === 'info' ? 'polite' : 'assertive';

  useEffect(() => {
    const duration = notification.autoDismissMs === undefined ? 6000 : notification.autoDismissMs;
    if (!duration || duration <= 0) return undefined;
    const timer = window.setTimeout(dismiss, duration);
    return () => window.clearTimeout(timer);
  }, [notification.autoDismissMs, onDismiss]);

  if (dismissed) return null;

  function dismiss() {
    onDismiss?.();
    if (!onDismiss) setDismissed(true);
  }

  return (
    <article className={`procurex-notification-card tone-${notification.tone} ${compact ? 'is-compact' : ''}`} role={role} aria-live={ariaLive}>
      <span className="procurex-notification-icon">
        <ToneIcon tone={notification.tone} />
      </span>
      <div className="procurex-notification-copy">
        <strong>{notification.title}</strong>
        <p>{notification.message}</p>
        {notification.reason ? <small>{notification.reason}</small> : null}
        {notification.details ? <code>{notification.details}</code> : null}
      </div>
      <button className="procurex-notification-dismiss" type="button" aria-label="Dismiss notification" onClick={dismiss}>
        <CloseRoundedIcon fontSize="small" aria-hidden="true" />
      </button>
    </article>
  );
}
