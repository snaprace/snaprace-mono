# i18n 및 국가별 이벤트 분리 구현 계획

## 개요

SnapRace에 다국어 지원(i18n)과 국가별 이벤트 분리 기능을 구현합니다.

- **지원 언어**: English (en), 한국어 (ko)
- **지원 국가**: US, KR
- **언어-국가 매핑**: en → US, ko → KR

## 핵심 동작 원리

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. locale 없이 접근: snap-race.com/events                        │
│    → 쿠키 체크 → Accept-Language 체크 → 308 리다이렉트           │
│                                                                 │
│ 2. locale 있이 접근: snap-race.com/ko/events                     │
│    → 리다이렉트 없이 해당 locale 사용                             │
│                                                                 │
│ 3. subdomain 접근: millenniumrunning.snap-race.com/ko           │
│    → organizer.countries에 KR 없으면 "미지원 언어" 배너 표시     │
│                                                                 │
│ 4. 메인사이트 이벤트: snap-race.com/ko/events                    │
│    → events.countries에 KR 포함된 이벤트만 표시                  │
└─────────────────────────────────────────────────────────────────┘
```

## DB 스키마 변경

### 1. organizers 테이블

```sql
ALTER TABLE organizers
ADD COLUMN countries TEXT[] DEFAULT ARRAY['US'];

CREATE INDEX idx_organizers_countries ON organizers USING GIN (countries);
```

**데이터 업데이트**:

- 모든 organizer: `['US']` (기본값)
- `goodrunner`: `['KR']` (한국어 전용)

### 2. events 테이블

```sql
ALTER TABLE events
ADD COLUMN countries TEXT[] DEFAULT ARRAY['US'];

CREATE INDEX idx_events_countries ON events USING GIN (countries);
```

**데이터 업데이트**:

- 모든 이벤트: `['US']` (기본값)
- `goodrunner` organizer의 이벤트: `['KR']`

## 파일 구조

```
src/
├── app/
│   ├── [locale]/                 # 동적 locale 세그먼트
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── events/
│   │   │   ├── page.tsx
│   │   │   └── [event]/
│   │   │       ├── page.tsx
│   │   │       └── [bib]/
│   │   │           └── page.tsx
│   │   └── privacy-policy/
│   │       └── page.tsx
│   ├── api/                      # API는 locale 밖
│   ├── not-found.tsx
│   ├── robots.ts
│   └── sitemap.ts
├── i18n/
│   ├── config.ts                 # 언어 설정
│   ├── request.ts                # next-intl 서버 설정
│   └── routing.ts                # 라우팅 설정
├── messages/
│   ├── en.json
│   └── ko.json
└── middleware.ts                 # 통합 미들웨어
```

## 구현 순서

### Phase 1: 기반 설정

1. [x] DB 마이그레이션 (countries 컬럼 추가)
2. [x] Supabase types 재생성
3. [x] i18n 설정 파일 생성 (`i18n/config.ts`, `routing.ts`, `request.ts`)
4. [x] 기본 번역 파일 생성 (`messages/en.json`, `messages/ko.json`)

### Phase 2: 라우팅 & 미들웨어

5. [x] 미들웨어 업데이트 (locale 감지 + 리다이렉트)
6. [x] `[locale]` 라우트 구조로 변경

### Phase 3: 컴포넌트 & 서비스

7. [x] LocaleSwitcher 컴포넌트
8. [x] UnsupportedLocaleWarning 컴포넌트
9. [x] 이벤트 필터링 로직 수정 (countries 기반)

### Phase 4: 번역 적용

10. [x] 기본 번역 파일 구조 완성 (추가 번역은 점진적으로)

## 테스트 시나리오

### 미들웨어 테스트 (`middleware.test.ts`)

```typescript
describe("i18n middleware", () => {
  it("URL에 locale 있으면 리다이렉트 없음", () => {
    // /ko/events → 그대로 통과
  });

  it("locale 없고 쿠키 있으면 쿠키 locale로 리다이렉트", () => {
    // /events + NEXT_LOCALE=ko → /ko/events
  });

  it("locale 없고 쿠키 없으면 Accept-Language로 리다이렉트", () => {
    // /events + Accept-Language: ko-KR → /ko/events
  });

  it("locale 없고 쿠키/헤더 없으면 기본값(en)으로 리다이렉트", () => {
    // /events → /en/events
  });
});
```

### i18n 설정 테스트 (`i18n/config.test.ts`)

```typescript
describe("i18n config", () => {
  it("지원 언어 목록이 올바름", () => {
    expect(locales).toEqual(["en", "ko"]);
  });

  it("locale-country 매핑이 올바름", () => {
    expect(localeToCountry["en"]).toBe("US");
    expect(localeToCountry["ko"]).toBe("KR");
  });
});
```

### 이벤트 필터링 테스트 (`events.test.ts`)

```typescript
describe("listEvents with country filter", () => {
  it("country=KR일 때 KR 이벤트만 반환", () => {
    // events.countries에 'KR' 포함된 것만
  });

  it("organizationId 있으면 해당 organizer 이벤트만 반환", () => {
    // countries 무관하게 organizer 이벤트
  });
});
```

## 주요 코드 스니펫

### i18n/config.ts

```typescript
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
```

### middleware.ts (핵심 로직)

```typescript
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 정적 파일 제외
  if (shouldSkip(pathname)) return NextResponse.next();

  // subdomain 추출
  const subdomain = extractSubdomain(request);

  // locale 확인
  const pathnameLocale = getLocaleFromPathname(pathname);

  if (!pathnameLocale) {
    // 리다이렉트 필요
    const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
    const targetLocale =
      cookieLocale || detectFromAcceptLanguage(request) || "en";

    return NextResponse.redirect(
      new URL(`/${targetLocale}${pathname}`, request.url),
      { status: 308 },
    );
  }

  // 헤더 설정
  const response = NextResponse.next();
  if (subdomain) response.headers.set("x-organization", subdomain);
  response.headers.set("x-locale", pathnameLocale);

  return response;
}
```

### LocaleSwitcher.tsx

```typescript
'use client';

export function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60*60*24*365}`;
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <select value={currentLocale} onChange={(e) => switchLocale(e.target.value as Locale)}>
      <option value="en">English</option>
      <option value="ko">한국어</option>
    </select>
  );
}
```

## 번역 파일 구조

### messages/en.json

```json
{
  "common": {
    "search": "Search",
    "loading": "Loading...",
    "error": "An error occurred"
  },
  "home": {
    "title": "Find your snap",
    "searchPlaceholder": "Enter bib number"
  },
  "events": {
    "title": "Events",
    "noEvents": "No events found"
  },
  "locale": {
    "unsupported": "This organizer does not support {locale}",
    "switchTo": "Switch to {locale}"
  }
}
```

### messages/ko.json

```json
{
  "common": {
    "search": "검색",
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다"
  },
  "home": {
    "title": "내 사진 찾기",
    "searchPlaceholder": "배번 입력"
  },
  "events": {
    "title": "이벤트",
    "noEvents": "이벤트가 없습니다"
  },
  "locale": {
    "unsupported": "이 주최자는 {locale}을(를) 지원하지 않습니다",
    "switchTo": "{locale}로 변경"
  }
}
```

## 리스크 & 고려사항

1. **SEO 영향**: 기존 `/events` URL이 308로 리다이렉트됨 → 검색엔진이 새 URL 인덱싱
2. **기존 링크**: 공유된 링크들이 리다이렉트됨 → 사용자 경험에 큰 영향 없음
3. **성능**: 미들웨어에서 추가 처리 → 무시할 수준

## 완료 기준

- [x] `/ko`, `/en` URL로 언어별 페이지 접근 가능
- [x] locale 없이 접근 시 적절한 언어로 리다이렉트
- [x] 언어 전환 버튼이 작동하고 쿠키에 저장됨
- [x] 메인 사이트에서 국가별 이벤트 필터링 작동
- [x] subdomain에서 미지원 언어 접근 시 경고 표시
- [ ] 모든 테스트 통과 (추후 검증 필요)

## 구현 완료 (2024-12-06)

### 생성된 파일

- `src/i18n/config.ts` - 언어 설정 및 매핑
- `src/i18n/routing.ts` - next-intl 라우팅 설정
- `src/i18n/request.ts` - next-intl 서버 설정
- `src/i18n/middleware-utils.ts` - 미들웨어 유틸리티 함수 (locale 감지, 미지원 locale 처리 등)
- `src/i18n/config.test.ts` - 설정 테스트
- `src/i18n/middleware-utils.test.ts` - 미들웨어 유틸리티 테스트
- `src/components/LocaleSwitcher.tsx` - 언어 전환 컴포넌트 (단일 언어 organizer는 자동 숨김)
- `src/components/UnsupportedLocaleWarning.tsx` - 미지원 언어 경고 컴포넌트
- `messages/en.json` - 영어 번역
- `messages/ko.json` - 한국어 번역

### 수정된 파일

- `next.config.js` - next-intl 플러그인 추가
- `src/middleware.ts` - locale 감지 및 리다이렉트 로직
- `src/app/layout.tsx` - 최소화 (children만 반환)
- `src/app/[locale]/layout.tsx` - 메인 레이아웃 (신규)
- `src/app/[locale]/page.tsx` - 홈페이지 (신규)
- `src/components/header.tsx` - LocaleSwitcher 추가
- `src/server/services/events.ts` - country 필터 추가
- `src/server/api/routers/events.ts` - country 파라미터 추가

### DB 변경

- `organizers.countries` 컬럼 추가 (TEXT[])
- `events.countries` 컬럼 추가 (TEXT[])
- `goodrunner` organizer는 `['KR']`로 설정
