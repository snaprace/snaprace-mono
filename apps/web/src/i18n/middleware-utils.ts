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

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segments = pathname.split("/");
  const firstSegment = segments[1];

  if (firstSegment && locales.includes(firstSegment as Locale)) {
    return firstSegment as Locale;
  }
  return null;
}

export function isPotentialLocale(segment: string): boolean {
  return /^[a-z]{2,3}$/.test(segment);
}

export function getUnsupportedLocaleFromPathname(
  pathname: string,
): string | null {
  const segments = pathname.split("/");
  const firstSegment = segments[1];

  if (
    firstSegment &&
    isPotentialLocale(firstSegment) &&
    !locales.includes(firstSegment as Locale)
  ) {
    return firstSegment;
  }
  return null;
}

export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;

  const languages = header.split(",").map((lang) => {
    const [code] = lang.trim().split(";");
    return code?.split("-")[0]?.toLowerCase();
  });

  for (const lang of languages) {
    if (lang === "ko") return "ko";
    if (lang === "en") return "en";
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
