/* Exercises public behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { apiClient } from '@/shared/api/http';
import { AboutProcurexPage } from './AboutProcurexPage';
import { PrivacyPolicyProcurexPage } from './PrivacyPolicyProcurexPage';
import { TermsAndConditionsProcurexPage } from './TermsAndConditionsProcurexPage';

vi.mock('@/shared/api/http', () => ({
  apiClient: {
    get: vi.fn()
  }
}));

const apiGet = vi.mocked(apiClient.get);

function publicPageResponse(pageKey: 'about-procurex' | 'privacy-policy' | 'terms-and-conditions', html: string, version = '2026.06.06') {
  return {
    data: {
      id: `${pageKey}-${version}`,
      pageKey,
      version,
      status: 'PUBLISHED',
      title: pageKey,
      summary: null,
      content: { html },
      contentHash: 'test-hash',
      effectiveAt: '2026-06-06T00:00:00.000Z',
      publishedAt: '2026-06-06T00:00:00.000Z',
      lastUpdated: '2026-06-06T00:00:00.000Z'
    }
  };
}

function renderPublicPage(page: ReactNode) {
  return render(
    <Provider store={store}>
      <MemoryRouter>{page}</MemoryRouter>
    </Provider>
  );
}

describe('PublicContentProcurexPage', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('hydrates the About page from API-backed content', async () => {
    apiGet.mockResolvedValueOnce(
      publicPageResponse(
        'about-procurex',
        '<div class="about-page"><header></header><main><h1>API About ProcureX</h1><section id="about-final-cta">API CTA</section></main></div>'
      )
    );

    renderPublicPage(<AboutProcurexPage />);

    expect(screen.getByRole('heading', { name: /Building a Smarter/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'API About ProcureX' })).toBeInTheDocument();
    expect(screen.getByText('API CTA')).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/api/public/pages/about-procurex');
  });

  it('keeps the Privacy page usable with fallback metadata if the API fails', async () => {
    apiGet.mockRejectedValueOnce(new Error('offline'));

    renderPublicPage(<PrivacyPolicyProcurexPage />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/public/pages/privacy-policy'));
    expect(screen.getByRole('heading', { name: 'Your Privacy Matters at ProcureX' })).toBeInTheDocument();
    expect(screen.getByText('2026.06.06')).toBeInTheDocument();
    expect(screen.getByText('Account Registration Information')).toBeInTheDocument();
  });

  it('renders Terms version metadata from the API', async () => {
    apiGet.mockResolvedValueOnce(
      publicPageResponse(
        'terms-and-conditions',
        '<div class="terms-page"><header></header><main><h1>API Terms</h1><section><details open><summary>API Acceptance</summary><p>Required acceptance content</p></details></section></main></div>',
        '2030.01.01'
      )
    );

    renderPublicPage(<TermsAndConditionsProcurexPage />);

    expect(await screen.findByRole('heading', { name: 'API Terms' })).toBeInTheDocument();
    expect(screen.getByText('2030.01.01')).toBeInTheDocument();
    expect(screen.getByText('API Acceptance')).toBeInTheDocument();
    expect(screen.getByText('Required acceptance content')).toBeInTheDocument();
  });
});
