import { describe, it, expect } from "vitest";
import {
  shouldSkipLocaleHandling,
  getLocaleFromPathname,
  isPotentialLocale,
  getUnsupportedLocaleFromPathname,
  detectLocaleFromAcceptLanguage,
  extractSubdomain,
} from "./middleware-utils";

describe("shouldSkipLocaleHandling", () => {
  it("정적 파일은 스킵", () => {
    expect(shouldSkipLocaleHandling("/image.png")).toBe(true);
    expect(shouldSkipLocaleHandling("/script.js")).toBe(true);
    expect(shouldSkipLocaleHandling("/style.css")).toBe(true);
  });

  it("제외 경로는 스킵", () => {
    expect(shouldSkipLocaleHandling("/api/trpc")).toBe(true);
    expect(shouldSkipLocaleHandling("/_next/static")).toBe(true);
    expect(shouldSkipLocaleHandling("/favicon.ico")).toBe(true);
  });

  it("일반 경로는 스킵 안함", () => {
    expect(shouldSkipLocaleHandling("/events")).toBe(false);
    expect(shouldSkipLocaleHandling("/ko/events")).toBe(false);
    expect(shouldSkipLocaleHandling("/")).toBe(false);
  });
});

describe("getLocaleFromPathname", () => {
  it("경로에서 locale 추출", () => {
    expect(getLocaleFromPathname("/ko/events")).toBe("ko");
    expect(getLocaleFromPathname("/en/events")).toBe("en");
    expect(getLocaleFromPathname("/ko")).toBe("ko");
  });

  it("locale 없으면 null 반환", () => {
    expect(getLocaleFromPathname("/events")).toBe(null);
    expect(getLocaleFromPathname("/")).toBe(null);
    expect(getLocaleFromPathname("/ja/events")).toBe(null);
  });
});

describe("isPotentialLocale", () => {
  it("2-3글자 소문자는 잠재적 locale", () => {
    expect(isPotentialLocale("en")).toBe(true);
    expect(isPotentialLocale("ko")).toBe(true);
    expect(isPotentialLocale("fr")).toBe(true);
    expect(isPotentialLocale("jpn")).toBe(true);
  });

  it("그 외는 locale 아님", () => {
    expect(isPotentialLocale("events")).toBe(false);
    expect(isPotentialLocale("EN")).toBe(false);
    expect(isPotentialLocale("e")).toBe(false);
    expect(isPotentialLocale("")).toBe(false);
  });
});

describe("getUnsupportedLocaleFromPathname", () => {
  it("지원하지 않는 locale 감지", () => {
    expect(getUnsupportedLocaleFromPathname("/fr/events")).toBe("fr");
    expect(getUnsupportedLocaleFromPathname("/ja/events")).toBe("ja");
    expect(getUnsupportedLocaleFromPathname("/de")).toBe("de");
  });

  it("지원하는 locale은 null 반환", () => {
    expect(getUnsupportedLocaleFromPathname("/en/events")).toBe(null);
    expect(getUnsupportedLocaleFromPathname("/ko/events")).toBe(null);
  });

  it("locale 아닌 경로는 null 반환", () => {
    expect(getUnsupportedLocaleFromPathname("/events")).toBe(null);
    expect(getUnsupportedLocaleFromPathname("/")).toBe(null);
    expect(getUnsupportedLocaleFromPathname("/privacy-policy")).toBe(null);
  });
});

describe("detectLocaleFromAcceptLanguage", () => {
  it("Accept-Language에서 locale 감지", () => {
    expect(detectLocaleFromAcceptLanguage("ko-KR,ko;q=0.9,en;q=0.8")).toBe(
      "ko",
    );
    expect(detectLocaleFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("지원하지 않는 언어면 기본값 반환", () => {
    expect(detectLocaleFromAcceptLanguage("ja-JP,ja;q=0.9")).toBe("en");
    expect(detectLocaleFromAcceptLanguage(null)).toBe("en");
    expect(detectLocaleFromAcceptLanguage("")).toBe("en");
  });

  it("우선순위에 따라 첫 번째 지원 언어 반환", () => {
    expect(detectLocaleFromAcceptLanguage("ja,ko,en")).toBe("ko");
  });
});

describe("extractSubdomain", () => {
  it("로컬 개발 환경에서 query param 우선", () => {
    expect(extractSubdomain("localhost:3000", true, "testorg", "envorg")).toBe(
      "testorg",
    );
  });

  it("로컬 개발 환경에서 env 변수 사용", () => {
    expect(extractSubdomain("localhost:3000", true, null, "envorg")).toBe(
      "envorg",
    );
  });

  it("프로덕션에서 서브도메인 추출", () => {
    expect(extractSubdomain("millenniumrunning.snap-race.com", false)).toBe(
      "millenniumrunning",
    );
  });

  it("www는 서브도메인으로 간주 안함", () => {
    expect(extractSubdomain("www.snap-race.com", false)).toBe("");
  });

  it("메인 도메인은 빈 문자열", () => {
    expect(extractSubdomain("snap-race.com", false)).toBe("");
  });
});
