import { useTranslation } from 'react-i18next';
import { store } from '@/app/store';
import { accountApi } from '@/features/account/api';
import { hydrateAuthSession } from '@/features/auth/slice';
import { persistLanguage, type SupportedLanguage } from '@/i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const language = i18n.language === 'sw' ? 'sw' : 'en';

  async function handleChange(nextLanguage: SupportedLanguage) {
    persistLanguage(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
    if (!store.getState().auth.isAuthenticated) return;
    try {
      await accountApi.updatePreferences({ preferredLanguage: nextLanguage });
      void store.dispatch(hydrateAuthSession());
    } catch {
      // Local storage remains the fallback when the session cannot be refreshed.
    }
  }

  return (
    <select
      className="procurex-language-select"
      aria-label={t('language')}
      value={language}
      onChange={(event) => void handleChange(event.target.value as SupportedLanguage)}
    >
      <option value="en">{t('english')}</option>
      <option value="sw">{t('swahili')}</option>
    </select>
  );
}
