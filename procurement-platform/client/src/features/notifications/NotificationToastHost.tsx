import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { NotificationCard } from '@/shared/components/NotificationCard';
import type { CreateNotificationInput } from '@/shared/types/notifications';
import { dismissNotification, enqueueNotification } from './slice';

export function NotificationToastHost() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notifications.items);

  useEffect(() => {
    function handleBrowserNotification(event: Event) {
      const detail = (event as CustomEvent<CreateNotificationInput>).detail;
      if (!detail?.title || !detail.message || !detail.tone) return;
      dispatch(enqueueNotification({ ...detail, dismissible: detail.dismissible ?? true }));
    }

    window.addEventListener('procurex:notify', handleBrowserNotification);
    return () => window.removeEventListener('procurex:notify', handleBrowserNotification);
  }, [dispatch]);

  useEffect(() => {
    const timers = notifications
      .filter((notification) => notification.autoDismissMs && notification.autoDismissMs > 0)
      .map((notification) =>
        window.setTimeout(() => {
          dispatch(dismissNotification(notification.id));
        }, notification.autoDismissMs ?? 0)
      );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dispatch, notifications]);

  if (!notifications.length) return null;

  return (
    <section className="procurex-toast-host" aria-label="Notifications">
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={{ ...notification, dismissible: true }} compact onDismiss={() => dispatch(dismissNotification(notification.id))} />
      ))}
    </section>
  );
}
