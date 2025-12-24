import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  shouldSkipLocaleHandling,
  detectLocaleFromAcceptLanguage,
  extractSubdomain,
} from "./i18n/middleware-utils";
import { locales, type Locale } from "./i18n/config";
import { auth } from "./server/auth";

export async function middleware(request: NextRequest) {
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

  // 하위 호환성을 위한 리다이렉션: /ko/events -> /events
  const segments = pathname.split("/");
  const localeFromPath = segments[1];

  if (localeFromPath && locales.includes(localeFromPath as Locale)) {
    segments.splice(1, 1);
    const newPath = segments.join("/") || "/";
    const response = NextResponse.redirect(new URL(newPath, request.url), {
      status: 301
    });
    response.cookies.set("NEXT_LOCALE", localeFromPath, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  // Auth Checks for Admin
  if (pathname.startsWith("/admin")) {
    const session = await auth();
    const isLoginPage = pathname.includes("/login") || pathname.includes("/signup");

    if (!session && !isLoginPage) {
      // 로그인 안됨 -> 로그인 페이지로 리다이렉트
      const loginUrl = new URL(`/admin/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (session) {
      const userRole = (session.user as any).role;
      console.log(">>>> MW: session found, role:", userRole, "subdomain:", subdomain);
      
      // 1. 메인 도메인 Admin -> SUPER_ADMIN 만 허용
      if (!subdomain && pathname.startsWith("/admin")) {
        if (userRole !== "SUPER_ADMIN" && !isLoginPage) {
          console.log(">>>> MW: Main domain admin access denied for non-SUPER_ADMIN");
          return NextResponse.redirect(new URL(`/unauthorized`, request.url));
        }
      }

      // 2. 서브도메인 Admin -> 해당 조직원인지 확인 (DB 조회 필요할 수 있지만, 여기서는 기본 역할 체크)
      if (subdomain && pathname.startsWith("/admin")) {
        if (userRole !== "ORGANIZER" && userRole !== "SUPER_ADMIN" && !isLoginPage) {
          console.log(">>>> MW: Subdomain admin access denied for non-ORGANIZER/SUPER_ADMIN");
          return NextResponse.redirect(new URL(`/unauthorized`, request.url));
        }
      }
    }
  }

  const response = NextResponse.next();

  // 현재 locale 결정 (쿠키 -> Accept-Language -> 기본값)
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value as Locale | undefined;
  let targetLocale: Locale;

  if (cookieLocale && locales.includes(cookieLocale)) {
    targetLocale = cookieLocale;
  } else {
    const acceptLanguage = request.headers.get("Accept-Language");
    targetLocale = detectLocaleFromAcceptLanguage(acceptLanguage);
  }

  if (subdomain) {
    response.headers.set("x-organization", subdomain);
  }
  response.headers.set("x-locale", targetLocale);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|fonts|.*\\.(?:jpg|jpeg|gif|png|svg|ico|webp|js|css|woff|woff2|ttf|eot)).*)",
  ],
};
