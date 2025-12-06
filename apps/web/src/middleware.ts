import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  shouldSkipLocaleHandling,
  getLocaleFromPathname,
  getUnsupportedLocaleFromPathname,
  detectLocaleFromAcceptLanguage,
  extractSubdomain,
} from "./i18n/middleware-utils";
import { locales, defaultLocale, type Locale } from "./i18n/config";

const intlMiddleware = createMiddleware(routing);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  // 서브도메인 추출 (모든 경로에서 필요)
  const isLocalDev =
    hostname.includes("localhost") || hostname.includes("127.0.0.1");
  const queryOrg = request.nextUrl.searchParams.get("org");
  const subdomain = extractSubdomain(
    hostname,
    isLocalDev,
    queryOrg,
    process.env.NEXT_PUBLIC_DEV_SUBDOMAIN,
  );

  // API 경로는 locale 처리 없이 헤더만 설정
  if (pathname.startsWith("/api")) {
    const response = NextResponse.next();
    if (subdomain) {
      response.headers.set("x-organization", subdomain);
    }
    return response;
  }

  // 정적 파일 및 제외 경로는 스킵
  if (shouldSkipLocaleHandling(pathname)) {
    return NextResponse.next();
  }

  // 경로에서 locale 확인
  const pathnameLocale = getLocaleFromPathname(pathname);

  // 지원하지 않는 locale이면 기본 locale로 리다이렉트 (예: /fr/events → /en/events)
  const unsupportedLocale = getUnsupportedLocaleFromPathname(pathname);
  if (unsupportedLocale) {
    const pathWithoutLocale =
      pathname.replace(`/${unsupportedLocale}`, "") || "/";
    const newUrl = new URL(
      `/${defaultLocale}${pathWithoutLocale}${request.nextUrl.search}`,
      request.url,
    );
    const response = NextResponse.redirect(newUrl, { status: 308 });
    if (subdomain) {
      response.headers.set("x-organization", subdomain);
    }
    return response;
  }

  // locale 없으면 리다이렉트
  if (!pathnameLocale) {
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value as
      | Locale
      | undefined;
    let targetLocale: Locale;

    if (cookieLocale && locales.includes(cookieLocale)) {
      targetLocale = cookieLocale;
    } else {
      const acceptLanguage = request.headers.get("Accept-Language");
      targetLocale = detectLocaleFromAcceptLanguage(acceptLanguage);
    }

    const newUrl = new URL(
      `/${targetLocale}${pathname}${request.nextUrl.search}`,
      request.url,
    );
    const response = NextResponse.redirect(newUrl, { status: 308 });

    if (subdomain) {
      response.headers.set("x-organization", subdomain);
    }

    return response;
  }

  // next-intl 미들웨어 실행
  const response = intlMiddleware(request);

  // 커스텀 헤더 추가
  if (subdomain) {
    response.headers.set("x-organization", subdomain);
  }
  response.headers.set("x-locale", pathnameLocale);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|fonts|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp|js|css|woff|woff2|ttf|eot)).*)",
  ],
};
