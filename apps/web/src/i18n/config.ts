export const locales = ["en", "ko"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeToCountry: Record<Locale, string> = {
  en: "US",
  ko: "KR",
};

export const countryToLocale: Record<string, Locale> = {
  US: "en",
  KR: "ko",
};

export const localeNames: Record<Locale, string> = {
  en: "English",
  ko: "한국어",
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getCountryFromLocale(locale: Locale): string {
  return localeToCountry[locale];
}
