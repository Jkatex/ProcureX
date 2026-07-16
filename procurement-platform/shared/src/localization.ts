export const supportedLanguages = ['en', 'sw'] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

const languageAliases: Record<string, SupportedLanguage> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',
  'en-tz': 'en',
  sw: 'sw',
  'sw-tz': 'sw',
  kiswahili: 'sw',
  swahili: 'sw'
};

export function resolveSupportedLanguage(value: unknown, fallback: SupportedLanguage = 'en'): SupportedLanguage {
  if (typeof value !== 'string') return fallback;
  const candidates = value
    .split(',')
    .map((item) => item.trim().split(';')[0]?.toLowerCase())
    .filter(Boolean);

  for (const candidate of candidates) {
    const exact = languageAliases[candidate];
    if (exact) return exact;
    const primary = candidate.split('-')[0];
    if (primary && languageAliases[primary]) return languageAliases[primary];
  }

  return fallback;
}

export function localeForLanguage(language: SupportedLanguage) {
  return language === 'sw' ? 'sw-TZ' : 'en-TZ';
}
