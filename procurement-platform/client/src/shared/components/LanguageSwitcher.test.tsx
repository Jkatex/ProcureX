/* Exercises shared behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '@/i18n';
import { store } from '@/app/store';
import { procurexTheme } from '@/styles/mui-theme';
import { ThemeProvider } from '@mui/material';
import { LanguageSwitcher } from './LanguageSwitcher';

function renderSwitcher() {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter>
          <LanguageSwitcher />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('LanguageSwitcher', () => {
  it('persists the selected Swahili locale', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.selectOptions(screen.getByRole('combobox'), screen.getByRole('option', { name: /swahili|kiswahili/i }));

    expect(window.localStorage.getItem('procurex.language')).toBe('sw');
    expect(document.documentElement.lang).toBe('sw');
  });
});
