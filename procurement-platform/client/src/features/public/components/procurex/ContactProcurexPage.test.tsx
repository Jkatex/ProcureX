import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { apiClient } from '@/shared/api/http';
import { ContactProcurexPage } from './ContactProcurexPage';

vi.mock('@/shared/api/http', () => ({
  apiClient: {
    post: vi.fn()
  }
}));

const apiPost = vi.mocked(apiClient.post);

function renderContactPage() {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ContactProcurexPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('ContactProcurexPage', () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

  it('sends public contact requests to ProcureX support', async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValueOnce({ data: { status: 'sent' } });

    renderContactPage();

    expect(screen.getAllByText('procurexsupport@gmail.com').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Full name'), 'Public User');
    await user.type(screen.getByLabelText('Email address'), 'public@example.test');
    await user.type(screen.getByLabelText('Phone number'), '+255700000001');
    await user.type(screen.getByLabelText('Organization name'), 'Public Org');
    await user.selectOptions(screen.getByLabelText('Request type'), 'Tender issue');
    await user.type(screen.getByLabelText('Message'), 'I need help before creating an account.');
    await user.click(screen.getByLabelText(/I confirm ProcureX may use these details/));
    await user.click(screen.getByRole('button', { name: 'Submit Request' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/api/support/contact', {
        fullName: 'Public User',
        email: 'public@example.test',
        phone: '+255700000001',
        organization: 'Public Org',
        requestType: 'Tender issue',
        message: 'I need help before creating an account.'
      })
    );
    expect(await screen.findByText('Request sent to procurexsupport@gmail.com.')).toBeInTheDocument();
  });
});
