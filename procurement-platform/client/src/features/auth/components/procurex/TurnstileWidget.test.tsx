import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { TurnstileWidget } from './TurnstileWidget';

describe('TurnstileWidget', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    window.localStorage.clear();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the missing configuration warning in the active language', async () => {
    await i18n.changeLanguage('sw');

    render(<TurnstileWidget action="sign_in" resetKey={0} onVerify={vi.fn()} onExpire={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Ukaguzi wa usalama haujasanidiwa.');
  });
});
