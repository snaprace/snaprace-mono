import { describe, it, expect } from "vitest";
import {
  shouldSkipLocaleHandling,
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
    expect(shouldSkipLocaleHandling("/_next/static")).toBe(true);
    expect(shouldSkipLocaleHandling("/favicon.ico")).toBe(true);
  });

  it("API 경로는 스킵 안함 (미들웨어에서 헤더 설정 필요)", () => {
    expect(shouldSkipLocaleHandling("/api/trpc")).toBe(false);
    expect(shouldSkipLocaleHandling("/api/auth")).toBe(false);
  });

  it("일반 경로는 스킵 안함", () => {
    expect(shouldSkipLocaleHandling("/events")).toBe(false);
    expect(shouldSkipLocaleHandling("/")).toBe(false);
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
