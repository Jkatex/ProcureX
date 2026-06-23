import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { notificationFromApiError } from '@/shared/api/errors';
import notificationsReducer, { enqueueNotification } from './slice';
import { NotificationToastHost } from './NotificationToastHost';

function renderToastStore() {
  const store = configureStore({
    reducer: {
      notifications: notificationsReducer
    }
  });

  render(
    <Provider store={store}>
      <MemoryRouter>
        <NotificationToastHost />
      </MemoryRouter>
    </Provider>
  );

  return store;
}

describe('ProcureX notification cards', () => {
  it('renders reason, close control, and alert role for errors without action buttons', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(
      <MemoryRouter>
        <NotificationCard
          notification={{
            tone: 'error',
            title: 'Action failed',
            message: 'Could not save profile.',
            reason: 'The server could not complete the request.',
            action: { label: 'Try again' },
            dismissible: true
          }}
          onDismiss={onDismiss}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Action failed');
    expect(screen.getByRole('alert').closest('.procurex-toast-host')).toBeNull();
    expect(screen.getByText('The server could not complete the request.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders queued notifications as a top-right floating stack with newest first', async () => {
    const store = renderToastStore();

    act(() => {
      store.dispatch(enqueueNotification({ tone: 'info', title: 'First notice', message: 'Original message.', dismissible: true, autoDismissMs: 0 }));
      store.dispatch(enqueueNotification({ tone: 'success', title: 'Second notice', message: 'Newest message.', dismissible: true, autoDismissMs: 0 }));
    });

    const host = document.querySelector('.procurex-toast-host');
    expect(host).toBeInTheDocument();
    expect(host).toHaveAttribute('data-placement', 'top-right');
    await screen.findByText('Second notice');

    const cards = Array.from(host?.querySelectorAll('.procurex-notification-card') ?? []);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Second notice');
    expect(cards[1]).toHaveTextContent('First notice');
  });

  it('auto-dismisses toast notifications and keeps a manual close control', () => {
    vi.useFakeTimers();
    const store = renderToastStore();

    act(() => {
      store.dispatch(
        enqueueNotification({
          tone: 'success',
          title: 'Saved',
          message: 'Draft saved.',
          dismissible: true,
          autoDismissMs: 1000
        })
      );
      store.dispatch(
        enqueueNotification({
          tone: 'error',
          title: 'Blocked',
          message: 'Action blocked.',
          dismissible: false,
          autoDismissMs: 1000
        })
      );
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[1]);
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('maps common API errors to reasons without generic retry actions', () => {
    expect(notificationFromApiError({ response: { status: 429, data: { message: 'Please wait.' } } })).toMatchObject({
      tone: 'warning',
      reason: 'This action was attempted too many times in a short period.',
      action: undefined
    });
    expect(notificationFromApiError({ response: { status: 401, data: { message: 'Session invalid.' } } })).toMatchObject({
      tone: 'warning',
      reason: 'Your session is no longer valid for this request.',
      action: { label: 'Sign in again', to: '/sign-in' }
    });
    expect(notificationFromApiError({ message: 'Network Error' })).toMatchObject({
      tone: 'error',
      reason: 'ProcureX could not reach the service needed for this action.',
      action: undefined
    });
  });
});
