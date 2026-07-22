/* Owns notifications client state transitions so components can render workflow state instead of mutating it directly. */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CreateNotificationInput, UserNotification } from '@/shared/types/notifications';

type NotificationsState = {
  items: UserNotification[];
};

const initialState: NotificationsState = {
  items: []
};

function createNotification(input: CreateNotificationInput): UserNotification {
  return {
    ...input,
    id: input.id ?? notificationId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    dismissible: input.dismissible ?? true,
    autoDismissMs: input.autoDismissMs === undefined ? 6000 : input.autoDismissMs
  };
}

function notificationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isDuplicateBidNotice(left: UserNotification, right: UserNotification) {
  return (
    left.presentation === 'bidNotice' &&
    right.presentation === 'bidNotice' &&
    left.tone === right.tone &&
    left.title === right.title &&
    left.message === right.message
  );
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    enqueueNotification: {
      reducer(state, action: PayloadAction<UserNotification>) {
        if (action.payload.presentation === 'bidNotice') {
          state.items = state.items.filter((item) => !isDuplicateBidNotice(item, action.payload));
        }
        state.items.unshift(action.payload);
        state.items = state.items.slice(0, 6);
      },
      prepare(input: CreateNotificationInput) {
        return { payload: createNotification(input) };
      }
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    clearNotifications(state) {
      state.items = [];
    }
  }
});

export const { clearNotifications, dismissNotification, enqueueNotification } = notificationsSlice.actions;
export default notificationsSlice.reducer;
