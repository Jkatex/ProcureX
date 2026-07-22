/* Defines shared TypeScript contracts that keep API payloads, state, and UI props aligned. */
export type NotificationTone = 'success' | 'info' | 'warning' | 'error';

export type NotificationAction = {
  label: string;
  to?: string;
  onAction?: () => void;
};

export type UserNotification = {
  id: string;
  tone: NotificationTone;
  presentation?: 'default' | 'bidNotice';
  title: string;
  message: string;
  reason?: string;
  action?: NotificationAction;
  details?: string;
  dismissible: boolean;
  createdAt: string;
  autoDismissMs?: number | null;
};

export type CreateNotificationInput = Omit<UserNotification, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};
