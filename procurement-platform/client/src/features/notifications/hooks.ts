/* Exposes notifications hooks that keep component state access and side effects consistent across screens. */
import { useCallback } from 'react';
import { useAppDispatch } from '@/app/store';
import { notificationFromApiError, type ApiErrorNotificationContext } from '@/shared/api/errors';
import type { CreateNotificationInput, NotificationTone } from '@/shared/types/notifications';
import { clearNotifications, dismissNotification, enqueueNotification } from './slice';

type NotifyOptions = Partial<Omit<CreateNotificationInput, 'tone' | 'title' | 'message'>>;

export function useNotifications() {
  const dispatch = useAppDispatch();

  const notify = useCallback(
    (input: CreateNotificationInput) => {
      dispatch(enqueueNotification(input));
    },
    [dispatch]
  );

  const notifyTone = useCallback(
    (tone: NotificationTone, title: string, message: string, options?: NotifyOptions) => {
      dispatch(enqueueNotification({ tone, title, message, dismissible: true, ...options }));
    },
    [dispatch]
  );

  return {
    notify,
    notifySuccess: (title: string, message: string, options?: NotifyOptions) => notifyTone('success', title, message, options),
    notifyInfo: (title: string, message: string, options?: NotifyOptions) => notifyTone('info', title, message, options),
    notifyWarning: (title: string, message: string, options?: NotifyOptions) => notifyTone('warning', title, message, options),
    notifyError: (title: string, message: string, options?: NotifyOptions) => notifyTone('error', title, message, options),
    notifyApiError: (error: unknown, context?: ApiErrorNotificationContext) => dispatch(enqueueNotification(notificationFromApiError(error, context))),
    dismissNotification: (id: string) => dispatch(dismissNotification(id)),
    clearNotifications: () => dispatch(clearNotifications())
  };
}
