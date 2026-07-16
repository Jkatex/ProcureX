import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resolveSupportedLanguage, supportedLanguages, type SupportedLanguage } from '@procurex/shared';
import en from './locales/en/common.json';
import sw from './locales/sw/common.json';

export { supportedLanguages };
export type { SupportedLanguage };

const storedLanguage = typeof window !== 'undefined' ? window.localStorage.getItem('procurex.language') : null;
const initialLanguage = resolveSupportedLanguage(storedLanguage);

void i18n.use(initReactI18next).init({
  resources: {
    en: { common: en },
    sw: { common: sw }
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: {
    escapeValue: false
  }
});

const procurexStaticNamespaceLoads = new Map<SupportedLanguage, Promise<void>>();

export function hasProcurexStaticNamespace(language: SupportedLanguage) {
  return i18n.hasResourceBundle(language, 'procurexStatic');
}

export function ensureProcurexStaticNamespace(language: SupportedLanguage) {
  if (hasProcurexStaticNamespace(language)) return Promise.resolve();

  const activeLoad = procurexStaticNamespaceLoads.get(language);
  if (activeLoad) return activeLoad;

  const load = (language === 'sw'
    ? import('./locales/sw/procurex-static.json')
    : import('./locales/en/procurex-static.json')
  ).then((module) => {
    i18n.addResourceBundle(language, 'procurexStatic', module.default, true, true);
  });

  procurexStaticNamespaceLoads.set(language, load);
  return load;
}

export function persistLanguage(language: SupportedLanguage) {
  window.localStorage.setItem('procurex.language', language);
  document.documentElement.lang = language;
}

export function currentRequestLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return resolveSupportedLanguage(i18n.language);
  return resolveSupportedLanguage(
    window.localStorage.getItem('procurex.language') || document.documentElement.lang || i18n.language
  );
}

document.documentElement.lang = initialLanguage;

export default i18n;
