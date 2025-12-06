import { describe, it, expect } from "vitest";
import {
  locales,
  defaultLocale,
  localeToCountry,
  countryToLocale,
  isValidLocale,
  getCountryFromLocale,
} from "./config";

describe("i18n config", () => {
  it("지원 언어 목록이 올바름", () => {
    expect(locales).toEqual(["en", "ko"]);
  });

  it("기본 언어가 영어임", () => {
    expect(defaultLocale).toBe("en");
  });

  it("locale → country 매핑이 올바름", () => {
    expect(localeToCountry.en).toBe("US");
    expect(localeToCountry.ko).toBe("KR");
  });

  it("country → locale 매핑이 올바름", () => {
    expect(countryToLocale.US).toBe("en");
    expect(countryToLocale.KR).toBe("ko");
  });

  describe("isValidLocale", () => {
    it("유효한 locale 반환 true", () => {
      expect(isValidLocale("en")).toBe(true);
      expect(isValidLocale("ko")).toBe(true);
    });

    it("유효하지 않은 locale 반환 false", () => {
      expect(isValidLocale("ja")).toBe(false);
      expect(isValidLocale("")).toBe(false);
      expect(isValidLocale("EN")).toBe(false);
    });
  });

  describe("getCountryFromLocale", () => {
    it("locale에서 country 반환", () => {
      expect(getCountryFromLocale("en")).toBe("US");
      expect(getCountryFromLocale("ko")).toBe("KR");
    });
  });
});
