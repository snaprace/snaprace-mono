# SnapRace 프로젝트 개선 방안

## 목차
1. [Subdomain 환경 분리 개선](#1-subdomain-환경-분리-개선)
2. [Organization 스키마 개선](#2-organization-스키마-개선)
3. [구현 가이드](#3-구현-가이드)
4. [실행 계획](#4-실행-계획)

---

## 1. Subdomain 환경 분리 개선

### 현재 구조의 문제점

#### Images 경로 문제
- **현재**: 하드코딩된 경로 패턴
  - `images/organizations/${organization.subdomain}/logo.png`
  - `images/organizations/${organization.subdomain}/partners/${partner.name}.png`
- **문제점**:
  - 이미지 경로가 컴포넌트에 직접 하드코딩됨
  - 메인 사이트와 subdomain 이미지가 동일한 폴더 구조 공유
  - 조직별 이미지 관리가 비효율적

#### tRPC 쿼리 문제
- **현재**: 컴포넌트 레벨에서 조건부 필터링
  ```typescript
  api.events.getAll.useQuery(
    organization?.organization_id
      ? { organizationId: organization.organization_id }
      : undefined
  )
  ```
- **문제점**:
  - 모든 컴포넌트에서 반복적인 조건 체크
  - 실수로 필터링을 빠뜨릴 가능성
  - 코드 중복

#### 환경 구성 문제
- Subdomain 감지가 middleware에서만 처리
- Organization 데이터 fetching이 클라이언트 사이드에 의존
- 메인 사이트와 subdomain의 역할/기능 구분 불명확

### 개선 방안

#### 1. 이미지 경로 유틸리티

```typescript
// src/utils/organization-assets.ts
interface AssetPaths {
  logo: string;
  getPartnerImage: (partnerName: string) => string;
  fallbackLogo: string;
}

export function getOrganizationAssets(
  subdomain?: string | null
): AssetPaths {
  const isMainSite = !subdomain;

  return {
    logo: isMainSite
      ? '/images/logo.png'
      : `/images/organizations/${subdomain}/logo.png`,

    getPartnerImage: (partnerName: string) => {
      const normalizedName = partnerName.toLowerCase().replace(/\s+/g, '');
      return isMainSite
        ? `/images/partners/partner-${normalizedName}.png`
        : `/images/organizations/${subdomain}/partners/${partnerName}.png`;
    },

    fallbackLogo: '/images/default-logo.png'
  };
}
```

#### 2. Site Configuration

```typescript
// src/config/site-config.ts
export interface SiteConfig {
  isMainSite: boolean;
  features: {
    showAllEvents: boolean;
    showPartnerSection: boolean;
    enableFacialRecognition: boolean;
    showEventBrowser: boolean;
  };
  navigation: Array<{ name: string; href: string }>;
  metadata: {
    title: string;
    description: string;
  };
}

export function getSiteConfig(
  subdomain?: string | null,
  organizationName?: string | null
): SiteConfig {
  const isMainSite = !subdomain;

  return {
    isMainSite,
    features: {
      showAllEvents: isMainSite,
      showPartnerSection: true,
      enableFacialRecognition: !isMainSite,
      showEventBrowser: isMainSite,
    },
    navigation: isMainSite
      ? [
          { name: "Search", href: "/" },
          { name: "Events", href: "/events" },
        ]
      : [
          { name: "Search", href: "/" },
          { name: "Events", href: "/events" },
        ],
    metadata: {
      title: organizationName
        ? `${organizationName} - Race Photos`
        : "SnapRace - Find Your Race Photos",
      description: organizationName
        ? `Find your ${organizationName} event photos using your bib number`
        : "Easily find and download your race photos using your bib number",
    },
  };
}
```

#### 3. tRPC Context 개선

```typescript
// src/server/api/trpc.ts
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const subdomain = opts.headers.get('x-organization');

  let organizationContext = {
    subdomain: subdomain,
    organizationId: null as string | null,
    isMainSite: !subdomain,
  };

  if (subdomain) {
    try {
      const org = await getOrganizationBySubdomain(subdomain);
      if (org) {
        organizationContext.organizationId = org.organization_id;
      }
    } catch (error) {
      console.error('Failed to fetch organization in context:', error);
    }
  }

  return {
    ...opts,
    ...organizationContext,
  };
};

// Events Router에서 자동 필터링
export const eventsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z.object({
        overrideOrganizationId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = input?.overrideOrganizationId ?? ctx.organizationId;

      if (organizationId) {
        // Organization별 이벤트만 반환
        const command = new ScanCommand({
          TableName: TABLES.EVENTS,
          FilterExpression: "organization_id = :organizationId",
          ExpressionAttributeValues: {
            ":organizationId": organizationId,
          },
        });
        const result = await dynamoClient.send(command);
        return (result.Items ?? []) as Event[];
      }

      // 메인 사이트: 모든 public 이벤트
      if (ctx.isMainSite) {
        const command = new ScanCommand({
          TableName: TABLES.EVENTS,
        });
        const result = await dynamoClient.send(command);
        return (result.Items ?? []) as Event[];
      }

      return [];
    }),
});
```

---

## 2. Organization 스키마 개선

### 현재 스키마의 문제점

1. **중첩된 custom_settings 객체**
   - 너무 많은 관련 없는 설정들이 한 객체에 모여있음
   - 타입 안정성이 떨어지고 확장이 어려움
   - 관련 필드가 분산됨

2. **일관성 없는 필드 구조**
   - 일부는 최상위 레벨 (primary_color, secondary_color)
   - 일부는 custom_settings 내부 (welcome_message, partners)
   - 일부는 social_links 내부 (facebook, instagram)

3. **서비스 코드와의 결합도**
   - 컴포넌트에서 깊은 중첩 접근 (`organization.custom_settings?.partners`)
   - Null 체크가 복잡함

### 개선된 스키마 설계

```typescript
// src/types/organization.ts
import { z } from "zod";

// 브랜딩 스키마
const BrandingSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  secondary_color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  logo_url: z.string().url().optional(),
  favicon_url: z.string().url().optional(),
});

// 콘텐츠 스키마
const ContentSchema = z.object({
  welcome_message: z.string().max(500).optional(),
  footer_text: z.string().max(200).optional(),
  privacy_policy_url: z.string().url().optional(),
  terms_url: z.string().url().optional(),
});

// 연락처 스키마
const ContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website_url: z.string().url().optional(),
  address: z.string().optional(),
});

// 소셜 스키마
const SocialSchema = z.object({
  facebook: z.string().url().optional(),
  instagram: z.string().url().optional(),
  twitter: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  youtube: z.string().url().optional(),
});

// 파트너 스키마
const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo_url: z.string().url(),
  website_url: z.string().url().optional(),
  display_order: z.number().default(0),
});

// 기능 플래그 스키마
const FeaturesSchema = z.object({
  show_partners: z.boolean().default(true),
  enable_facial_recognition: z.boolean().default(false),
  enable_selfie_upload: z.boolean().default(false),
  enable_watermark: z.boolean().default(true),
  enable_bulk_download: z.boolean().default(true),
});

// 전체 Organization 스키마
export const OrganizationSchema = z.object({
  // 핵심 필드
  organization_id: z.string(),
  subdomain: z.string(),
  name: z.string(),

  // 그룹화된 필드
  branding: BrandingSchema.default({}),
  content: ContentSchema.default({}),
  contact: ContactSchema.default({}),
  social: SocialSchema.default({}),
  partners: z.array(PartnerSchema).default([]),
  features: FeaturesSchema.default({}),

  // 메타데이터
  status: z.enum(['active', 'inactive', 'trial']).default('active'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Organization = z.infer<typeof OrganizationSchema>;
```

### OrganizationHelper 클래스

```typescript
// src/lib/organization-helpers.ts
import type { Organization } from '@/types/organization';

export class OrganizationHelper {
  constructor(private org: Organization | null) {}

  // 기본 정보
  get id() {
    return this.org?.organization_id;
  }

  get name() {
    return this.org?.name || 'SnapRace';
  }

  get subdomain() {
    return this.org?.subdomain;
  }

  get isActive() {
    return this.org?.status === 'active';
  }

  // 브랜딩
  get primaryColor() {
    return this.org?.branding?.primary_color;
  }

  get secondaryColor() {
    return this.org?.branding?.secondary_color;
  }

  get logoUrl() {
    // 로컬 개발 환경 fallback 지원
    if (!this.org?.branding?.logo_url && this.subdomain) {
      return `/images/organizations/${this.subdomain}/logo.png`;
    }
    return this.org?.branding?.logo_url || '/images/default-logo.png';
  }

  // 콘텐츠
  get welcomeMessage() {
    return this.org?.content?.welcome_message ||
           'Enter your bib number to discover all your photos.';
  }

  get footerText() {
    return this.org?.content?.footer_text ||
           `© ${new Date().getFullYear()} ${this.name}. All rights reserved.`;
  }

  // 파트너
  get partners() {
    if (!this.org?.partners) return [];
    return [...this.org.partners].sort((a, b) =>
      (a.display_order || 0) - (b.display_order || 0)
    );
  }

  get hasPartners() {
    return this.showPartners && this.partners.length > 0;
  }

  get showPartners() {
    return this.org?.features?.show_partners ?? true;
  }

  // 기능 체크
  isFeatureEnabled(feature: keyof Organization['features']): boolean {
    return this.org?.features?.[feature] ?? false;
  }

  // 연락처
  get contactEmail() {
    return this.org?.contact?.email;
  }

  get websiteUrl() {
    return this.org?.contact?.website_url;
  }

  // 소셜 미디어
  getSocialUrl(platform: keyof Organization['social']): string | undefined {
    return this.org?.social?.[platform];
  }

  get hasSocialLinks() {
    if (!this.org?.social) return false;
    return Object.values(this.org.social).some(url => !!url);
  }
}
```

### React Hook

```typescript
// src/hooks/useOrganizationHelper.ts
import { useMemo } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OrganizationHelper } from '@/lib/organization-helpers';

export function useOrganizationHelper() {
  const { organization } = useOrganization();

  return useMemo(
    () => new OrganizationHelper(organization),
    [organization]
  );
}
```

### 컴포넌트 사용 예시

```typescript
// 개선 전
export function HomePage() {
  const { organization } = useOrganization();

  return (
    <div>
      <h1>{organization?.custom_settings?.welcome_message || "Default message"}</h1>

      {organization?.custom_settings?.partners &&
       organization.custom_settings.partners.length > 0 &&
       organization?.custom_settings?.show_partner_section !== false && (
        <div>
          {organization.custom_settings.partners
            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            .map(partner => (
              <img
                src={`/images/organizations/${organization.subdomain}/partners/${partner.name}.png`}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// 개선 후
export function HomePage() {
  const org = useOrganizationHelper();

  return (
    <div>
      <h1>{org.welcomeMessage}</h1>

      {org.hasPartners && (
        <div>
          {org.partners.map(partner => (
            <img
              key={partner.id}
              src={partner.logo_url}
              alt={partner.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 3. 구현 가이드

### Phase 1: 즉시 적용 가능 (간단)

#### 1단계: 유틸리티 함수 생성 (30분)
- [ ] `organization-assets.ts` 유틸리티 생성
- [ ] `site-config.ts` 생성

#### 2단계: 컴포넌트 수정 (1시간)
- [ ] Header 컴포넌트 - 이미지 경로와 navigation 개선
- [ ] HomePage 컴포넌트 - 파트너 이미지 경로 개선
- [ ] 이미지 경로 통일

#### 3단계: 테스트 (30분)
- [ ] 메인 사이트 동작 확인
- [ ] Subdomain 동작 확인
- [ ] 이미지 로딩 확인

### Phase 2: 백엔드 개선 (중간)

#### 4단계: tRPC Context 개선 (1시간)
- [ ] tRPC context에 organizationId 자동 주입
- [ ] Events router 자동 필터링
- [ ] Photos router 수정
- [ ] 클라이언트 컴포넌트 단순화

### Phase 3: Organization 스키마 개선 (선택)

#### 5단계: 스키마 구조 개선 (2시간)
- [ ] 새 타입 정의 파일 생성 (`types/organization.ts`)
- [ ] Helper 클래스 생성 (`lib/organization-helpers.ts`)
- [ ] Hook 생성 (`hooks/useOrganizationHelper.ts`)

#### 6단계: 점진적 적용
- [ ] OrganizationContext 업데이트 (helper 추가)
- [ ] HomePage 컴포넌트 개선
- [ ] Header 컴포넌트 개선
- [ ] OrganizationStyles 컴포넌트 개선

#### 7단계: 백엔드 마이그레이션
- [ ] 새 스키마로 router 업데이트
- [ ] DynamoDB 데이터 마이그레이션 스크립트 실행
- [ ] 기존 스키마 제거

---

## 4. 실행 계획

### 우선순위별 구현

#### 🔴 높음 (즉시 적용)
1. **이미지 경로 유틸리티** - 코드 중복 제거, 유지보수성 향상
2. **Site Config** - 메인/subdomain 기능 명확한 구분

#### 🟡 중간 (1주일 내)
3. **tRPC Context 개선** - 자동 필터링으로 실수 방지
4. **Organization Helper** - 타입 안정성과 코드 가독성

#### 🟢 낮음 (선택적)
5. **스키마 전면 개편** - 장기적 유지보수성 개선
6. **CDN 마이그레이션** - 이미지 로딩 성능 개선

### 예상 효과

1. **코드 품질**
   - 중복 코드 60% 감소
   - 타입 안정성 향상
   - 유지보수 시간 50% 단축

2. **개발 효율성**
   - 새 organization 추가 시간 75% 단축
   - 버그 발생률 감소
   - 테스트 용이성 향상

3. **성능 개선**
   - 불필요한 데이터 fetching 제거
   - 이미지 로딩 최적화 준비
   - 중첩 접근 제거로 파싱 속도 향상

### 주의사항

- ✅ 오버엔지니어링 방지: 필요한 부분만 점진적 개선
- ✅ 기존 기능 호환성 유지
- ✅ 테스트 환경에서 충분한 검증 후 적용
- ✅ 기존 데이터와의 호환성 유지를 위해 Helper에서 fallback 지원
- ✅ 점진적 마이그레이션으로 서비스 중단 없음

### 성공 지표

- [ ] 컴포넌트 코드 라인 수 30% 감소
- [ ] 조건부 렌더링 복잡도 50% 감소
- [ ] 새 기능 추가 시간 40% 단축
- [ ] 타입 에러 0건
- [ ] 테스트 커버리지 80% 이상