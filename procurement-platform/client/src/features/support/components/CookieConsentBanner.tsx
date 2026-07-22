/* Renders the support Cookie Consent Banner UI while keeping page-specific presentation near its workflow data. */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/i18n';

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const storageKey = 'procurex.cookieConsent.v1';
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(storageKey) !== 'accepted';
  });

  if (!visible) return null;

  return (
    <section className="cookie-consent" aria-label={t('support.cookie.ariaLabel')}>
      <p>{t('support.cookie.shortMessage')}</p>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => {
          window.localStorage.setItem(storageKey, 'accepted');
          setVisible(false);
        }}
      >
        {t('support.cookie.accept')}
      </button>
    </section>
  );
}
