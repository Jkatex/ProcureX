/* Exposes shared hooks that keep component state access and side effects consistent across screens. */
import { useTranslation } from 'react-i18next';
import type { SupportedLanguage } from '@/i18n';
import { formatDate, formatMoney } from '@/shared/utils/format';

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const language = (i18n.language === 'sw' ? 'sw' : 'en') as SupportedLanguage;

  return {
    language,
    money: (value: number, currency = 'TZS') => formatMoney(value, currency, language),
    date: (value: string) => formatDate(value, language)
  };
}
