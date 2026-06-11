import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { CookieConsentBanner, HelpCenterProcurexPage, NotFoundProcurexPage, SystemStatusProcurexPage } from './SupportPages';

vi.mock('@/shared/api/http', () => ({
  apiClient: {
    get: vi.fn()
  }
}));

const apiGet = vi.mocked(apiClient.get);

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe('support pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
    apiGet.mockReset();
  });

  it('renders curated help content and support links', () => {
    renderWithRouter(<HelpCenterProcurexPage />);

    expect(screen.getByRole('heading', { name: 'Help for registration, verification, tenders, and bids.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/status');
    expect(screen.getByText('How do I get verified on ProcureX?')).toBeInTheDocument();
  });

  it('uses the public health endpoint on the status page', async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        status: 'ok',
        service: 'procurex-server',
        modules: [{ key: 'identity', basePath: '/api/identity' }]
      }
    });

    renderWithRouter(<SystemStatusProcurexPage />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/health'));
    expect(await screen.findByRole('heading', { name: 'Operational' })).toBeInTheDocument();
    expect(screen.getByText('identity')).toBeInTheDocument();
  });

  it('renders a real not-found page instead of silently redirecting home', () => {
    renderWithRouter(<NotFoundProcurexPage />);

    expect(screen.getByRole('heading', { name: 'That ProcureX page was not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open help' })).toHaveAttribute('href', '/help');
  });

  it('persists cookie consent in localStorage', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CookieConsentBanner />);

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(window.localStorage.getItem('procurex.cookieConsent.v1')).toBe('accepted');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });
});
