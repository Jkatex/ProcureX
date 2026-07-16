import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { apiErrorMessage, apiRawErrorMessage, notificationFromApiError } from '@/shared/api/errors';
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
            reason: 'ProcureX could not complete this request.',
            action: { label: 'Try again' },
            dismissible: true
          }}
          onDismiss={onDismiss}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Action failed');
    expect(screen.getByRole('alert').closest('.procurex-toast-host')).toBeNull();
    expect(screen.getByText('ProcureX could not complete this request.')).toBeInTheDocument();
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

  it('renders bidding workspace notices without the default leading icon and auto-dismisses them', async () => {
    vi.useFakeTimers();
    const store = renderToastStore();

    act(() => {
      store.dispatch(enqueueNotification({ tone: 'warning', presentation: 'bidNotice', title: 'Notice', message: 'Complete all mandatory eligibility requirements before continuing. Incomplete: Required field (Document upload)', dismissible: true, autoDismissMs: 3000 }));
    });

    const notice = screen.getByRole('alert');
    expect(notice).toHaveClass('procurex-notification-card', 'presentation-bidNotice', 'tone-warning');
    expect(notice).toHaveTextContent('Notice');
    expect(notice).toHaveTextContent('Incomplete: Required field (Document upload)');
    expect(notice.querySelector('.procurex-notification-icon')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('deduplicates identical active bidding workspace notices and refreshes their timer', () => {
    vi.useFakeTimers();
    const store = renderToastStore();

    act(() => {
      store.dispatch(enqueueNotification({ tone: 'info', presentation: 'bidNotice', title: 'Notice', message: 'Ready to prepare a new sealed bid.', dismissible: true, autoDismissMs: 3000 }));
      vi.advanceTimersByTime(2000);
      store.dispatch(enqueueNotification({ tone: 'info', presentation: 'bidNotice', title: 'Notice', message: 'Ready to prepare a new sealed bid.', dismissible: true, autoDismissMs: 3000 }));
    });

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Ready to prepare a new sealed bid.');

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('allows different bidding workspace notices to stack', () => {
    const store = renderToastStore();

    act(() => {
      store.dispatch(enqueueNotification({ tone: 'info', presentation: 'bidNotice', title: 'Notice', message: 'Ready to prepare a new sealed bid.', dismissible: true, autoDismissMs: 0 }));
      store.dispatch(enqueueNotification({ tone: 'success', presentation: 'bidNotice', title: 'Notice', message: 'Draft saved to the database.', dismissible: true, autoDismissMs: 0 }));
    });

    const cards = Array.from(document.querySelectorAll('.procurex-notification-card.presentation-bidNotice'));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Draft saved to the database.');
    expect(cards[1]).toHaveTextContent('Ready to prepare a new sealed bid.');
  });

  it('keeps duplicate default notifications stacked', () => {
    const store = renderToastStore();

    act(() => {
      store.dispatch(enqueueNotification({ tone: 'info', title: 'Notice', message: 'Same default message.', dismissible: true, autoDismissMs: 0 }));
      store.dispatch(enqueueNotification({ tone: 'info', title: 'Notice', message: 'Same default message.', dismissible: true, autoDismissMs: 0 }));
    });

    expect(screen.getAllByText('Same default message.')).toHaveLength(2);
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
      message: 'Request failed.',
      reason: 'This action was attempted too many times in a short period.',
      action: undefined
    });
    expect(notificationFromApiError({ response: { status: 401, data: { message: 'Session invalid.' } } })).toMatchObject({
      tone: 'warning',
      message: 'Request failed.',
      reason: 'Your session is no longer valid for this request.',
      action: { label: 'Sign in again', to: '/sign-in' }
    });
    expect(notificationFromApiError({ message: 'Network Error' })).toMatchObject({
      tone: 'error',
      reason: 'ProcureX could not reach the service needed for this action.',
      action: undefined
    });
    expect(notificationFromApiError({ response: { status: 404, data: { code: 'PROCUREMENT_TENDER_NOT_FOUND', userMessage: 'Tender was not found.', reason: 'The requested record could not be found.', fieldErrors: [] } } })).toMatchObject({
      tone: 'warning',
      title: 'Record not found',
      message: 'Tender was not found.',
      reason: 'The requested record could not be found.'
    });
  });

  it('maps keyphrase API errors to clear retry guidance', () => {
    expect(notificationFromApiError({ response: { status: 403, data: { message: 'Invalid keyphrase.' } } })).toMatchObject({
      tone: 'error',
      title: 'Wrong keyphrase',
      message: 'Wrong or mismatched keyphrase. Check the keyphrase and try again.',
      reason: 'The keyphrase entered does not match the signing credential for this account.',
      action: { label: 'Try again' }
    });
    expect(apiErrorMessage({ response: { status: 403, data: { message: 'Key phrase and repeated key phrase do not match.' } } }, 'Fallback.')).toBe(
      'Wrong or mismatched keyphrase. Check the keyphrase and try again.'
    );
    expect(notificationFromApiError({ response: { status: 403, data: { message: 'Access denied.' } } })).toMatchObject({
      tone: 'error',
      title: 'Action blocked',
      message: 'Request failed.',
      reason: 'Your account, permission, or security check does not allow this action right now.'
    });
  });

  it('keeps raw API text behind the explicit helper while keeping notifications generic', () => {
    const error = { response: { status: 400, data: { message: 'Raw backend validation detail.' } } };
    const serverError = { response: { status: 500, data: { message: 'Database secret detail.' } } };

    expect(apiRawErrorMessage(error)).toBe('Raw backend validation detail.');
    expect(apiRawErrorMessage({ response: { status: 409, data: { error: 'The bid submission deadline has passed.' } } })).toBe('The bid submission deadline has passed.');
    expect(apiErrorMessage(error, 'Could not save profile.')).toBe('Could not save profile.');
    expect(apiErrorMessage({ response: { status: 409, data: { error: 'The bid submission deadline has passed.' } } }, 'Bid could not be submitted.')).toBe('Submission is closed for this tender.');
    expect(apiErrorMessage(serverError, 'Bid could not be submitted.')).toBe('Bid could not be submitted.');
    expect(notificationFromApiError(error, { fallback: 'Could not save profile.' })).toMatchObject({
      message: 'Could not save profile.',
      reason: 'Some submitted information is incomplete or invalid.'
    });
  });

  it('uses standard API error contract fields without exposing technical messages', () => {
    const error = {
      response: {
        status: 400,
        data: {
          success: false,
          error: 'request_error',
          code: 'PROCUREMENT_VALIDATION_FAILED',
          message: 'Tender details are incomplete.',
          userMessage: 'Tender details are incomplete.',
          reason: 'Add the missing tender details, then submit again.',
          fieldErrors: [
            { path: 'title', message: 'Tender title must contain at least 5 characters.', code: 'too_small' },
            { path: 'closingDate', message: 'Submission deadline must be in the future.', code: 'custom' },
            { path: 'requirements.budget', message: 'Tender budget is required before publishing.', code: 'custom' },
            { path: 'internal.secret', message: 'Fourth detail is hidden from the notification summary.', code: 'custom' }
          ]
        }
      }
    };

    expect(notificationFromApiError(error)).toMatchObject({
      tone: 'warning',
      title: 'Check the information',
      message: 'Tender details are incomplete.',
      reason: 'Add the missing tender details, then submit again.'
    });
    expect(notificationFromApiError(error).details).toContain('Title: Tender title must contain at least 5 characters.');
    expect(notificationFromApiError(error).details).toContain('Closing Date: Submission deadline must be in the future.');
    expect(notificationFromApiError(error).details).not.toContain('Fourth detail');
    expect(apiRawErrorMessage(error)).toBe('Tender details are incomplete.');
  });
});
