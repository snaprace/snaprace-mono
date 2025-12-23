import { locales, defaultLocale, type Locale } from "./config";

const PUBLIC_FILE_REGEX = /\.(.*)$/;
const EXCLUDED_PATHS = [
  // "/api" 제거 - 미들웨어에서 직접 처리 (x-organization 헤더 설정)
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/images",
  "/fonts",
];

export function shouldSkipLocaleHandling(pathname: string): boolean {
  return (
    PUBLIC_FILE_REGEX.test(pathname) ||
    EXCLUDED_PATHS.some((path) => pathname.startsWith(path))
  );
}

export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;

  const acceptedLanguages = header.split(",").map((lang) => {
    return lang.trim().split(";")[0]?.toLowerCase().split("-")[0];
  });

  for (const lang of acceptedLanguages) {
    if (lang && locales.includes(lang as Locale)) {
      return lang as Locale;
    }
  }

  return defaultLocale;
}

export function extractSubdomain(
  hostname: string,
  isLocalDev: boolean,
  queryOrg?: string | null,
  envSubdomain?: string,
): string {
  if (isLocalDev) {
    return queryOrg || envSubdomain || "";
  }

  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const potentialSubdomain = parts[0];
    if (potentialSubdomain && potentialSubdomain !== "www") {
      return potentialSubdomain;
    }
  }

  return "";
}
