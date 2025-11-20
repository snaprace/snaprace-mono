# Supabase 마이그레이션 계획

이 문서는 `apps/web` 애플리케이션을 DynamoDB에서 Supabase로 마이그레이션하기 위한 계획을 설명합니다.

## 현재 상태
- **Supabase 설정**: `@repo/supabase`에 구성 완료.
- **데이터**: `organizers`, `events`, `event_runners` 테이블에 데이터 적재 완료.
- **목표**: `winningeventsgroup` 조직 및 `run-for-liberty-5k-2025` 이벤트를 대상으로 마이그레이션 진행.

## 1단계: 기초 및 조직 컨텍스트 (우선순위)
목표: 서브도메인 처리를 시작으로 조직 및 이벤트 데이터 가져오기를 Supabase로 전환합니다.

### 1.1 설정 및 구성
- [x] `apps/web/.env`에 Supabase 자격 증명이 있는지 확인. (확인됨)
- [x] `apps/web`에서 `@repo/supabase` 클라이언트에 접근 가능한지 확인. (`@supabase/supabase-js` 설치 및 `lib/supabase.ts` 생성 완료)

### 1.2 조직 마이그레이션 (`organizationsRouter`)
- [x] `src/server/api/routers/organizations.ts`에서 `dynamoClient`를 Supabase 클라이언트로 교체.
- [x] `getBySubdomain`을 `organizers` 테이블 쿼리로 업데이트.
- [x] `getById`를 `organizers` 테이블 쿼리로 업데이트.
- [x] Supabase 스키마와 일치하도록 `OrganizationSchema` 업데이트 (필요 시). (`transformOrganizer` 헬퍼 함수로 해결)

### 1.3 이벤트 마이그레이션 (`eventsRouter`)
- [x] `src/server/api/routers/events.ts`에서 `dynamoClient`를 Supabase 클라이언트로 교체.
- [x] `getAll`, `getByOrganization`, `getById`를 `events` 테이블 쿼리로 업데이트.
- [x] Supabase 스키마(snake_case)와 코드(camelCase) 간의 매핑을 위해 `EventSchema` 업데이트. (`transformEvent` 헬퍼 함수로 해결)

### 1.4 레이아웃 및 미들웨어 검증
- [x] `middleware.ts`가 `x-organization` 헤더를 올바르게 전달하는지 확인. (기존 로직 유지)
- [x] 루트 레이아웃 또는 조직 레이아웃이 새로운 라우터를 사용하여 조직 데이터를 올바르게 가져오는지 확인. (`lib/server-organization.ts` 업데이트 완료)

## 2단계: 결과 및 러너
목표: 레이스 결과 데이터 가져오기를 `event_runners` 테이블을 사용하도록 전환합니다.

### 2.1 결과 마이그레이션 (`resultsRouter`)
- [ ] `src/server/api/routers/results.ts`를 Supabase를 사용하도록 리팩토링.
- [ ] `getBibDetail` (DDB)을 `event_runners` 쿼리로 교체.
- [ ] `getAllEventResults` (S3/DDB)를 `event_runners` 쿼리로 교체 (대용량 데이터 처리에 대한 고려 필요).

## 3단계: 사진 및 갤러리 (추후 진행)
- [ ] `photosRouter` 및 `galleriesRouter` 마이그레이션.
- *참고: 사용자가 "이미지 프로세싱 결과만 DDB에 저장"한다고 언급했으므로, 사진 메타데이터의 위치에 대한 확인이 필요합니다.*

## 사용자 확인 필요 사항
- `photos` 및 `galleries` 메타데이터도 Supabase로 이동하는지, 아니면 DDB/S3에 유지하는지 확인 필요.
- DDB(camelCase)와 Supabase(snake_case) 간의 스키마 매핑 전략 검토 (예: Zod transform 사용).

---

## 개발 규칙 (Development Rules)

### 에러 처리 (Error Handling)
모든 API 라우터 및 서버 사이드 로직의 에러 처리는 `apps/web/src/server/api/error-utils.ts`를 사용하여 공통화해야 합니다.

```typescript
import { trpcError } from "@/server/api/error-utils";

// ...
try {
  // ... logic
} catch (error) {
  console.error("Error description:", error);
  throw trpcError.internal("User-friendly error message");
}
```

## 1단계 상세 작업 내용

1.  **의존성 설치**: `@repo/supabase`가 연결되어 있는지 확인.
2.  **`organizations.ts` 업데이트**:
    ```typescript
    // Supabase 쿼리 예시
    const { data } = await supabase
      .from('organizers')
      .select('*')
      .eq('subdomain', input.subdomain)
      .single();
    ```
3.  **`events.ts` 업데이트**:
    ```typescript
    // Supabase 쿼리 예시
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizationId);
    ```
