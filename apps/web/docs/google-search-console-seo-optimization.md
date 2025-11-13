# Google Search Console SEO 최적화 가이드

## 개요

본 문서는 SnapRace 웹 애플리케이션의 Google Search Console(GSC) 활용을 최적화하기 위한 개선 작업을 정리합니다. 현재 TXT 레코드를 통한 소유권 인증이 완료된 상태이며, 검색 엔진 최적화(SEO)를 위한 기술적 개선사항들을 구현해야 합니다.

## 현재 상태 분석

### ✅ 구현 완료된 항목

- **Google Search Console 소유권 인증**: TXT 레코드를 통한 도메인 소유권 확인 완료
- **기본 메타데이터**: `layout.tsx`에 기본 title, description, Open Graph, Twitter Card 설정
- **Google Analytics**: `@next/third-parties/google`를 통한 GA4 연동
- **Microsoft Clarity**: 사용자 행동 분석 도구 연동
- **Next.js 15.2.3**: App Router 기반의 최신 Next.js 버전 사용
- **robots 메타 태그**: Privacy Policy 페이지에 `index: true, follow: true` 설정

### ❌ 미구현 항목 (우선순위별)

#### 🔴 High Priority

1. **Sitemap 생성 없음**: 검색 엔진이 사이트 구조를 이해할 수 없음
2. **robots.txt 없음**: 크롤러 지침이 정의되지 않음
3. **동적 페이지 메타데이터 누락**: Events 및 Bib 페이지가 client-side rendering으로 SEO 불리
4. **Canonical URL 설정 없음**: 중복 콘텐츠 이슈 가능성

#### 🟡 Medium Priority

5. **구조화된 데이터(JSON-LD) 없음**: Rich snippets 활용 불가
6. **이미지 최적화 메타데이터 부족**: alt 텍스트, width/height 속성 누락
7. **페이지 속도 최적화 부족**: 이미지 unoptimized 설정

#### 🟢 Low Priority

8. **다국어 지원 없음**: hreflang 태그 미설정 (향후 고려)
9. **페이지 네비게이션 breadcrumbs 없음**: 사용자 경험 및 SEO 개선 여부

## 구현 계획

### 1. Dynamic Sitemap 구현 (High Priority)

#### 1.1 Static Sitemap 생성

Next.js App Router의 sitemap 기능을 활용하여 동적으로 sitemap을 생성합니다.

**파일 위치**: `src/app/sitemap.ts`

```typescript
import { MetadataRoute } from "next";
import { getAllEvents } from "@/server/services/events";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://snap-race.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/events`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // Dynamic event pages
  try {
    const events = await getAllEvents();
    const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
      url: `${baseUrl}/events/${event.event_id}/null`,
      lastModified: new Date(event.event_date || Date.now()),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    return [...staticPages, ...eventPages];
  } catch (error) {
    console.error("Failed to generate dynamic sitemap:", error);
    return staticPages;
  }
}
```

**참고 사항**:

- Bib 번호 페이지(`/events/[event]/[bib]`)는 동적이고 수가 많아 sitemap에 포함하지 않음
- 대신 이벤트 페이지(`/events/[event]/null`)를 포함하여 크롤러가 접근 가능하도록 함
- Photo 상세 페이지는 이벤트 페이지에서 접근 가능하므로 별도 포함 불필요

#### 1.2 환경 변수 추가

`.env.example` 및 `.env.local`에 사이트 URL 추가:

```bash
NEXT_PUBLIC_SITE_URL=https://snap-race.com
```

`src/env.js`에 스키마 추가:

```typescript
client: {
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  // ... 기존 클라이언트 환경 변수
},
```

#### 1.3 Google Search Console에 Sitemap 제출

1. GSC 콘솔 접속
2. 좌측 메뉴에서 "Sitemaps" 선택
3. `https://snap-race.com/sitemap.xml` 제출
4. 색인 생성 상태 모니터링

### 2. robots.txt 구현 (High Priority)

#### 2.1 robots.txt 파일 생성

**파일 위치**: `src/app/robots.ts`

```typescript
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://snap-race.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/", // API 엔드포인트는 크롤링 방지
          "/_next/", // Next.js 내부 파일
          "/admin/", // 관리자 페이지 (향후 추가될 경우)
        ],
      },
      {
        // Good bots
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
        crawlDelay: 0,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

**접근 제한 고려사항**:

- `/api/*`: API 엔드포인트는 검색 엔진에서 제외
- 사진 URL은 CloudFront(`images.snap-race.com`)에서 제공되므로 별도 처리 불필요
- 개인정보 관련 페이지가 있다면 disallow에 추가 고려

### 3. 동적 페이지 메타데이터 구현 (High Priority)

현재 주요 페이지들이 클라이언트 사이드 렌더링("use client")으로 되어 있어 검색 엔진이 메타데이터를 수집하기 어렵습니다. 다음 페이지들을 서버 사이드에서 메타데이터를 생성하도록 개선해야 합니다.

#### 3.1 Events 리스트 페이지

**현재 상태**: `src/app/events/page.tsx`가 "use client"
**개선 방향**: Server Component로 변경하여 메타데이터 추가

```typescript
// src/app/events/page.tsx
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Race Events | SnapRace",
  description:
    "Browse all race events and find your photos. Search by bib number or event name.",
  openGraph: {
    title: "Race Events | SnapRace",
    description: "Browse all race events and find your photos.",
    type: "website",
  },
};

// Component 구현...
```

#### 3.2 Event Bib 페이지 (동적 메타데이터)

**파일**: `src/app/events/[event]/[bib]/page.tsx`

가장 중요한 페이지이므로 반드시 메타데이터를 서버 사이드에서 생성해야 합니다.

```typescript
// src/app/events/[event]/[bib]/page.tsx
import { type Metadata } from 'next';
import { getEventById } from '@/server/services/events';

type Props = {
  params: { event: string; bib: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { event, bib } = params;
  const isAllPhotos = bib === 'null';

  try {
    const eventData = await getEventById(event);

    if (isAllPhotos) {
      return {
        title: `${eventData.event_name} - All Photos | SnapRace`,
        description: `View all photos from ${eventData.event_name}. Find your race photos using your bib number or facial recognition.`,
        openGraph: {
          title: `${eventData.event_name} - All Photos`,
          description: `View all photos from ${eventData.event_name}`,
          type: 'website',
          images: eventData.event_thumbnail_url ? [eventData.event_thumbnail_url] : [],
        },
      };
    }

    return {
      title: `Bib #${bib} - ${eventData.event_name} | SnapRace`,
      description: `View race photos for bib number ${bib} at ${eventData.event_name}. Download and share your race photos.`,
      openGraph: {
        title: `Bib #${bib} - ${eventData.event_name}`,
        description: `Race photos for bib #${bib}`,
        type: 'website',
        images: eventData.event_thumbnail_url ? [eventData.event_thumbnail_url] : [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    return {
      title: 'Race Photos | SnapRace',
      description: 'Find your race photos',
    };
  }
}

// 기존 클라이언트 컴포넌트를 별도 파일로 분리
export default function EventBibPage({ params }: Props) {
  return <EventBibClient params={params} />;
}
```

**구현 시 주의사항**:

- 기존 클라이언트 로직을 `EventBibClient` 컴포넌트로 분리
- Server Component에서는 메타데이터만 처리
- 데이터 fetching 로직이 server/client에서 중복되지 않도록 최적화

#### 3.3 Photo 상세 페이지

**파일**: `src/app/photo/[photoId]/page.tsx`

이미 Server Component로 구현되어 있으나, 메타데이터를 더 풍부하게 개선할 수 있습니다.

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { photoId } = params;

  try {
    const photoData = await getPhotoMetadata(photoId);
    const imageUrl = constructImageUrl(
      photoId,
      photoData.organizerId,
      photoData.eventId,
    );

    return {
      title: `Race Photo - ${photoData.eventName} | SnapRace`,
      description: `View and download your race photo from ${photoData.eventName}${photoData.bibNumber ? ` (Bib #${photoData.bibNumber})` : ""}.`,
      openGraph: {
        title: `Race Photo - ${photoData.eventName}`,
        description: `Race photo from ${photoData.eventName}`,
        type: "website",
        images: imageUrl
          ? [
              {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: `Race photo from ${photoData.eventName}`,
              },
            ]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title: `Race Photo - ${photoData.eventName}`,
        description: `Race photo from ${photoData.eventName}`,
        images: imageUrl ? [imageUrl] : [],
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    console.error("Failed to generate photo metadata:", error);
    return {
      title: "Race Photo | SnapRace",
      description: "View and download your race photo",
    };
  }
}
```

### 4. Canonical URL 설정 (High Priority)

중복 콘텐츠 이슈를 방지하기 위해 canonical URL을 설정합니다.

#### 4.1 Root Layout에 Base URL 추가

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://snap-race.com",
  ),
  // ... 기존 메타데이터
};
```

#### 4.2 동적 페이지에 Canonical URL 추가

```typescript
// generateMetadata 함수 내부에 추가
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // ...
  return {
    // ...
    alternates: {
      canonical: `/events/${params.event}/${params.bib}`,
    },
  };
}
```

### 5. 구조화된 데이터 (JSON-LD) 구현 (Medium Priority)

Google의 Rich Snippets을 활용하기 위해 구조화된 데이터를 추가합니다.

#### 5.1 Event Schema 구현

**파일 위치**: `src/components/seo/EventSchema.tsx`

```typescript
import Script from 'next/script';

interface EventSchemaProps {
  eventId: string;
  eventName: string;
  eventDate: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  organizerName?: string;
}

export function EventSchema({
  eventId,
  eventName,
  eventDate,
  location,
  description,
  imageUrl,
  organizerName,
}: EventSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: eventName,
    startDate: eventDate,
    ...(location && {
      location: {
        '@type': 'Place',
        name: location,
      },
    }),
    ...(description && { description }),
    ...(imageUrl && { image: imageUrl }),
    ...(organizerName && {
      organizer: {
        '@type': 'Organization',
        name: organizerName,
      },
    }),
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/events/${eventId}/null`,
  };

  return (
    <Script
      id={`event-schema-${eventId}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

#### 5.2 Organization Schema (Root Layout)

```typescript
// src/components/seo/OrganizationSchema.tsx
import Script from 'next/script';

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SnapRace',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://snap-race.com',
    logo: `${process.env.NEXT_PUBLIC_SITE_URL}/images/snaprace-logo.svg`,
    description: 'Find your race photos easily using your bib number or facial recognition',
    sameAs: [
      // 소셜 미디어 링크가 있다면 추가
      // 'https://www.facebook.com/snaprace',
      // 'https://twitter.com/snaprace',
      // 'https://www.instagram.com/snaprace',
    ],
  };

  return (
    <Script
      id="organization-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

Root Layout에 추가:

```typescript
// src/app/layout.tsx
import { OrganizationSchema } from '@/components/seo/OrganizationSchema';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // ...
  return (
    <html lang="en">
      <head>
        <OrganizationStyles organization={organization} />
        <OrganizationSchema />
      </head>
      {/* ... */}
    </html>
  );
}
```

#### 5.3 ImageObject Schema (Photo 페이지)

사진 상세 페이지에 ImageObject 스키마를 추가하여 이미지 검색 최적화:

```typescript
// src/components/seo/ImageObjectSchema.tsx
import Script from 'next/script';

interface ImageObjectSchemaProps {
  imageUrl: string;
  name: string;
  description?: string;
  photographer?: string;
  datePublished?: string;
}

export function ImageObjectSchema({
  imageUrl,
  name,
  description,
  photographer,
  datePublished,
}: ImageObjectSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: imageUrl,
    name,
    ...(description && { description }),
    ...(photographer && {
      creator: {
        '@type': 'Person',
        name: photographer,
      },
    }),
    ...(datePublished && { datePublished }),
  };

  return (
    <Script
      id="image-schema"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

### 6. 이미지 최적화 (Medium Priority)

#### 6.1 Next.js Image Optimization 활성화

현재 `next.config.js`에서 `images.unoptimized: true`로 설정되어 있습니다. CloudFront를 사용하고 있지만, Next.js의 이미지 최적화를 활용하면 더 나은 성능을 얻을 수 있습니다.

**옵션 1: Next.js Image Optimization 활성화**

```javascript
// next.config.js
const config = {
  images: {
    unoptimized: false, // 변경
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.snap-race.com",
      },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ["image/webp", "image/avif"],
  },
};
```

**옵션 2: CloudFront 유지 (현재 방식)**

이미지 최적화를 CloudFront에서 처리하고 있다면 현재 설정을 유지하되, Image 컴포넌트 사용 시 alt, width, height 속성을 반드시 추가:

```tsx
<Image
  src={imageUrl}
  alt={`Race photo from ${eventName} - Bib #${bibNumber}`}
  width={1200}
  height={800}
  priority={isAboveFold} // 첫 화면에 표시되는 이미지는 priority 설정
/>
```

#### 6.2 Open Graph 이미지 최적화

Open Graph 이미지는 1200x630px 권장:

```typescript
openGraph: {
  images: [
    {
      url: '/images/og-landing.png',
      width: 1200,
      height: 630,
      alt: 'SnapRace - Find Your Race Photos',
    },
  ],
},
```

### 7. 페이지 속도 최적화 (Medium Priority)

#### 7.1 Core Web Vitals 모니터링

Google Search Console의 Core Web Vitals 리포트를 주기적으로 확인합니다.

현재 구현된 `web-vitals` 라이브러리를 활용하여 성능 데이터 수집:

```typescript
// src/app/layout.tsx 또는 별도 컴포넌트
"use client";

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    // Google Analytics로 전송
    if (window.gtag) {
      window.gtag("event", metric.name, {
        value: Math.round(
          metric.name === "CLS" ? metric.value * 1000 : metric.value,
        ),
        event_category: "Web Vitals",
        event_label: metric.id,
        non_interaction: true,
      });
    }
  });

  return null;
}
```

#### 7.2 이미지 Lazy Loading

무한 스크롤이 구현된 `InfinitePhotoGrid`에서 이미지 lazy loading이 적용되어 있는지 확인:

```tsx
<Image
  src={photo}
  alt={`Race photo`}
  loading="lazy" // 명시적으로 lazy loading 설정
  // ...
/>
```

#### 7.3 Code Splitting

Dynamic Import를 활용하여 필요한 컴포넌트만 로드:

```typescript
// 예: SelfieUploadCard가 무거운 컴포넌트라면
const SelfieUploadCard = dynamic(
  () => import('@/components/SelfieUploadCard'),
  {
    loading: () => <Skeleton className="h-48 w-full" />,
    ssr: false,
  }
);
```

### 8. 추가 SEO 최적화 사항

#### 8.1 404 페이지 커스터마이징

**파일 위치**: `src/app/not-found.tsx`

```typescript
import { type Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '404 - Page Not Found | SnapRace',
  description: 'The page you are looking for does not exist.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link href="/">
        <Button>Go back to home</Button>
      </Link>
    </div>
  );
}
```

#### 8.2 언어 설정

HTML lang 속성이 이미 설정되어 있지만, 추가적으로 메타 태그에도 명시:

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  // ...
  other: {
    google: "notranslate", // 자동 번역 방지 (필요시)
  },
};
```

#### 8.3 Social Media 메타 태그 강화

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  // ...
  twitter: {
    card: "summary_large_image",
    site: "@snaprace", // Twitter 계정이 있다면
    creator: "@snaprace",
    images: ["/images/og-landing.png"],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "SnapRace",
    // ...
  },
};
```

## Google Search Console 활용 가이드

### 1. Sitemaps 제출 및 모니터링

1. **Sitemap 제출**:
   - GSC → Sitemaps → 새 사이트맵 추가
   - `https://snap-race.com/sitemap.xml` 입력
   - "제출" 클릭

2. **색인 생성 상태 확인**:
   - "발견됨", "크롤링됨", "색인 생성됨" 상태 모니터링
   - 오류 발생 시 상세 내용 확인 및 수정

### 2. URL 검사 도구 활용

1. **개별 URL 색인 요청**:
   - 상단 검색바에 URL 입력
   - "색인 생성 요청" 클릭
   - 중요한 페이지(홈, 이벤트 페이지) 우선 처리

2. **렌더링 확인**:
   - "크롤링된 페이지 보기" 클릭
   - Google이 페이지를 어떻게 렌더링하는지 확인
   - JavaScript 렌더링 이슈 파악

### 3. 성능 리포트 모니터링

1. **Core Web Vitals**:
   - GSC → 환경 → Core Web Vitals
   - LCP, FID, CLS 지표 확인
   - "불량" 상태 URL 개선

2. **페이지 환경**:
   - 모바일 사용성 이슈 확인
   - HTTPS 문제, 보안 이슈 모니터링

### 4. 검색 실적 분석

1. **검색 쿼리 분석**:
   - GSC → 실적 → 쿼리
   - 어떤 키워드로 유입되는지 확인
   - 클릭률(CTR) 낮은 페이지 메타데이터 개선

2. **페이지별 실적**:
   - 페이지 탭에서 트래픽 상위 페이지 확인
   - 노출은 많지만 클릭이 적은 페이지 개선

### 5. 색인 생성 범위 확인

1. **페이지별 색인 상태**:
   - GSC → 색인 생성 → 페이지
   - "제외됨" 항목 검토
   - robots.txt 또는 noindex 태그로 의도적으로 제외된 건지 확인

2. **문제 해결**:
   - "크롤링됨 - 현재 색인이 생성되지 않음" → 콘텐츠 품질 개선
   - "발견됨 - 현재 색인이 생성되지 않음" → 시간이 지나면 자동 색인됨
   - "중복됨" → canonical URL 설정 확인

## 구현 우선순위 및 타임라인

### Phase 1: 필수 SEO 인프라 구축 ✅ 완료 (2025-11-13)

1. ✅ Sitemap 생성 (`sitemap.ts`) - 완료
2. ✅ robots.txt 생성 (`robots.ts`) - 완료
3. ✅ 환경 변수 추가 (`NEXT_PUBLIC_SITE_URL`) - 완료
4. ✅ Canonical URL 설정 (metadataBase) - 완료
5. ✅ 404 페이지 커스터마이징 (`not-found.tsx`) - 완료
6. ⏳ GSC에 Sitemap 제출 - 수동 작업 필요

### Phase 2: 동적 페이지 메타데이터 개선 (2-3주)

1. ✅ Events 페이지 메타데이터 추가
2. ✅ Event/Bib 페이지 동적 메타데이터 구현
3. ✅ Photo 페이지 메타데이터 강화
4. ✅ 404 페이지 커스터마이징

### Phase 3: Rich Snippets 및 구조화된 데이터 (1-2주)

1. ✅ Organization Schema 추가
2. ✅ Event Schema 구현
3. ✅ ImageObject Schema 추가
4. ✅ Breadcrumbs Schema (선택사항)

### Phase 4: 성능 최적화 및 모니터링 (계속 진행)

1. ✅ Core Web Vitals 모니터링 설정
2. ✅ 이미지 최적화 검토
3. ✅ Code Splitting 적용
4. ✅ GSC 데이터 분석 및 개선

## 체크리스트

### 구현 완료 후 확인사항

- [ ] `https://snap-race.com/sitemap.xml` 접근 시 sitemap이 올바르게 생성되는가?
- [ ] `https://snap-race.com/robots.txt` 접근 시 robots 파일이 표시되는가?
- [ ] GSC에서 sitemap이 성공적으로 제출되었는가?
- [ ] 주요 페이지의 메타데이터가 올바르게 표시되는가? (View Page Source로 확인)
- [ ] Open Graph 이미지가 소셜 미디어에서 제대로 표시되는가? (Facebook Debugger, Twitter Card Validator 사용)
- [ ] 구조화된 데이터가 유효한가? (Google Rich Results Test 사용)
- [ ] 모든 이미지에 alt 텍스트가 포함되어 있는가?
- [ ] Canonical URL이 올바르게 설정되어 있는가?
- [ ] 404 페이지가 적절하게 표시되는가?
- [ ] Core Web Vitals 점수가 "양호" 범위에 있는가?

### 테스트 도구

1. **Google Search Console**: https://search.google.com/search-console
2. **Google Rich Results Test**: https://search.google.com/test/rich-results
3. **PageSpeed Insights**: https://pagespeed.web.dev/
4. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
5. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
6. **Lighthouse (Chrome DevTools)**: 브라우저 내장 도구

## 참고 자료

### 공식 문서

- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Google Search Central](https://developers.google.com/search/docs)
- [Schema.org Documentation](https://schema.org/)
- [Open Graph Protocol](https://ogp.me/)

### 추가 학습 자료

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Web.dev Performance](https://web.dev/performance/)
- [Next.js App Router Performance](https://nextjs.org/docs/app/building-your-application/optimizing)

## 업데이트 로그

- **2025-11-13**:
  - 초안 작성, 현재 상태 분석 및 구현 계획 수립
  - Phase 1 구현 완료:
    - `src/app/sitemap.ts` 생성 (동적 sitemap with DynamoDB integration)
    - `src/app/robots.ts` 생성
    - `src/app/layout.tsx`에 metadataBase 추가
    - `src/app/not-found.tsx` 생성 (커스텀 404 페이지)
    - Open Graph 이미지 크기 최적화 (1200x630px)
- **향후 업데이트**: Phase 2-4 구현, GSC 데이터 분석 결과 추가

---

**문서 작성자**: AI Assistant  
**최종 수정일**: 2025-11-13  
**버전**: 1.0
