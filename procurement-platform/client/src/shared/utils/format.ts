/* Supports the shared client workflow with reusable logic kept close to the screens that consume it. */
import { localeForLanguage, type SupportedLanguage } from '@procurex/shared';

export function formatMoney(value: number, currency = 'TZS', language: SupportedLanguage = 'en') {
  return new Intl.NumberFormat(localeForLanguage(language), {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatDate(value: string, language: SupportedLanguage = 'en') {
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export function statusTone(value: string): 'success' | 'warning' | 'error' | 'info' {
  const lower = value.toLowerCase();
  if (['approved', 'verified', 'complete', 'awarded', 'open', 'submitted', 'published'].some((word) => lower.includes(word))) {
    return 'success';
  }
  if (['pending', 'draft', 'review', 'evaluation', 'current', 'urgent'].some((word) => lower.includes(word))) {
    return 'warning';
  }
  if (['rejected', 'blocked', 'lost', 'closed', 'expired'].some((word) => lower.includes(word))) {
    return 'error';
  }
  return 'info';
}
