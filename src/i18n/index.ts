import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  LanguageOption,
  SUPPORTED_LANGUAGES,
  SupportedLanguageCode,
  resources,
} from './translations';

export const LANGUAGE_STORAGE_KEY = 'alphamate_language';

const SUPPORTED_CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

export function normalizeLanguageCode(raw?: string | null): SupportedLanguageCode {
  if (!raw) return 'en';
  const base = raw.toLowerCase().split(/[-_]/)[0];
  if (SUPPORTED_CODES.has(base)) {
    return base as SupportedLanguageCode;
  }
  return 'en';
}

export function getLanguageOption(code?: string | null): LanguageOption {
  const normalized = normalizeLanguageCode(code);
  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.code === normalized) ??
    SUPPORTED_LANGUAGES[0]
  );
}

function detectInitialLanguage(): SupportedLanguageCode {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored && SUPPORTED_CODES.has(stored)) {
        return stored as SupportedLanguageCode;
      }
      if (typeof navigator !== 'undefined' && navigator.language) {
        return normalizeLanguageCode(navigator.language);
      }
    }
  } catch {
    // Ignore storage access failures in restricted browsing contexts
  }
  return 'en';
}

export function applyDocumentLanguage(code?: string | null): void {
  const option = getLanguageOption(code);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = option.code;
    document.documentElement.dir = option.dir;
  }
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, option.code);
    }
  } catch {
    // Ignore storage persistence errors
  }
}

const initialLanguage = detectInitialLanguage();

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

applyDocumentLanguage(initialLanguage);

i18n.on('languageChanged', (lng) => {
  applyDocumentLanguage(lng);
});

export { SUPPORTED_LANGUAGES };
export type { LanguageOption, SupportedLanguageCode };
export default i18n;
