import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'node:fs';
import path from 'node:path';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { apiClient } from '@/shared/api/http';
import { WelcomeProcurexPage } from './WelcomeProcurexPage';

vi.mock('@/shared/api/http', () => ({
  apiClient: {
    get: vi.fn()
  }
}));

const apiGet = vi.mocked(apiClient.get);
const rawPrototypeDemoPath = '/procurex-ui/index.html?page=sign-in';

function renderWelcome() {
  return render(
    <MemoryRouter>
      <WelcomeProcurexPage />
    </MemoryRouter>
  );
}

describe('WelcomeProcurexPage', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('en');
    apiGet.mockReset();
  });

  it('renders the ProcureX landing page, CTAs, and API-backed featured tender data', async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        stats: {
          participantCount: 2450,
          participantLabel: 'Used by 2,000+ participants',
          openTenderCount: 18,
          verifiedProfileCompletionRate: 99.6,
          activeWorkspaceLabel: 'Live public workspace'
        },
        featuredTenders: [
          {
            id: 'tender-1',
            reference: 'PX-WRK-2026-001',
            title: 'Construction of community water wells',
            buyerName: 'Medical Stores Department',
            type: 'WORKS',
            status: 'OPEN',
            budget: '480000000',
            currency: 'TZS',
            location: 'Dodoma',
            closingDate: '2026-08-30T00:00:00.000Z',
            categories: ['Works']
          }
        ]
      }
    });

    renderWelcome();

    expect(screen.getByRole('heading', { name: 'Buy. Supply. Connect. Grow.' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Get Started' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Browse Open Tenders' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Browse Open Tenders' })[0]).toHaveAttribute('href', '/guest-marketplace');
    expect(document.querySelector('.welcome-nav-actions-v2')).not.toHaveTextContent('View demo');
    expect(screen.getAllByRole('link', { name: 'View demo' })).toHaveLength(2);
    screen.getAllByRole('link', { name: 'View demo' }).forEach((link) => {
      expect(link).toHaveAttribute('href', rawPrototypeDemoPath);
    });

    expect(await screen.findByText('PX-WRK-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Construction of community water wells')).toBeInTheDocument();
    expect(screen.getByText('18 open tenders visible now.')).toBeInTheDocument();
    expect(screen.getByText('99.6% Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('Live public workspace')).toBeInTheDocument();
  });

  it('falls back to stable ProcureX content if the welcome API fails', async () => {
    apiGet.mockRejectedValueOnce(new Error('network unavailable'));

    renderWelcome();

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/procurement/public/welcome'));
    expect(screen.getByText('PX-OPEN-2026')).toBeInTheDocument();
    expect(screen.getByText('12 open tenders visible now.')).toBeInTheDocument();
    expect(screen.getByText('98.4% Completion Rate')).toBeInTheDocument();
  });

  it('serves the raw ProcureX UI prototype from the public demo path', () => {
    const prototypeIndex = path.resolve(process.cwd(), 'public/procurex-ui/index.html');
    const prototypeSignIn = path.resolve(process.cwd(), 'public/procurex-ui/pages/sign-in.js');

    expect(fs.existsSync(prototypeIndex)).toBe(true);
    expect(fs.existsSync(prototypeSignIn)).toBe(true);
    expect(fs.readFileSync(prototypeSignIn, 'utf8')).toContain('demo@procurex.tz');
  });

  it('opens and closes the mobile navigation with accessible links', async () => {
    const user = userEvent.setup();
    apiGet.mockRejectedValueOnce(new Error('network unavailable'));

    renderWelcome();

    const menuButton = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link', { name: 'Help Center' })[0]).toHaveAttribute('href', '/help');

    await user.keyboard('{Escape}');
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('lets public visitors switch the welcome page to Swahili', async () => {
    const user = userEvent.setup();
    apiGet.mockRejectedValueOnce(new Error('network unavailable'));

    renderWelcome();

    expect(document.querySelector('.procurex-language-inline--welcome')).toContainElement(screen.getByRole('combobox', { name: 'Language' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'sw');

    expect(await screen.findByRole('heading', { name: 'Nunua. Toa Huduma. Unganika. Kua.' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Anza Sasa' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Lugha' })).toBeInTheDocument();
  });
});
