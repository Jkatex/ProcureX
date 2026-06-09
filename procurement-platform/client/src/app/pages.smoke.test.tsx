import { ThemeProvider } from '@mui/material';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { WelcomePage } from '@/features/public/pages/PublicPages';
import { MarketplacePage } from '@/features/procurement/pages/ProcurementPages';
import { AdminDashboardPage } from '@/features/admin/pages/AdminPages';
import { store } from './store';
import { procurexTheme } from '@/styles/mui-theme';

function renderPage(page: ReactNode) {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter>{page}</MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('page smoke tests', () => {
  it('renders the public welcome page', () => {
    renderPage(<WelcomePage />);
    expect(screen.getByRole('heading', { name: 'ProcureX' })).toBeInTheDocument();
  });

  it('renders marketplace data', () => {
    renderPage(<MarketplacePage />);
    expect(screen.getByRole('heading', { name: 'Marketplace' })).toBeInTheDocument();
  });

  it('renders the admin dashboard', () => {
    renderPage(<AdminDashboardPage />);
    expect(screen.getByRole('heading', { name: 'No platform activity has been indexed yet.' })).toBeInTheDocument();
  });
});
