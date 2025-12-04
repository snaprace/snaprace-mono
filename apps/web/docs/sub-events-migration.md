# SubEvents 테이블 마이그레이션 계획

## 개요

`event_runners` 테이블에 카테고리 정보(`event_slug`, 거리 정보 등)가 중복 저장되는 비정규화 문제를 해결하고, **SubEvent(하위 이벤트)** 개념을 도입하여 스키마를 정규화합니다.

### 핵심 원칙

- **모든 이벤트는 최소 1개 이상의 SubEvent를 가진다**
- 단일 카테고리 이벤트도 "Default" SubEvent 1개를 생성
- 이를 통해 로직을 통일하고 코드 분기 처리를 제거

### Before / After 비교

| 항목 | Before | After |
|------|--------|-------|
| 카테고리 정보 저장 | `event_runners`에 중복 저장 | `sub_events` 1곳에 정규화 |
| 정렬 로직 | 코드에 하드코딩 (`sortCategories`) | DB `sort_order` 컬럼 |
| 릴레이 판별 | 러너 데이터 순회하며 추측 | DB `is_relay` 플래그 |
| 카테고리 라벨 | `source_payload` 파싱 / 추측 | DB `name` 필드 |
| 쿼리 복잡도 | 전체 스캔 → 메모리 그룹핑 | `sub_events` JOIN 쿼리 |

---

## Phase 1: DB 스키마 변경

### Step 1.1: `sub_events` 테이블 생성

```sql
-- sub_events 테이블 생성
CREATE TABLE sub_events (
  sub_event_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
  
  -- 카테고리 식별
  name TEXT NOT NULL,           -- 표시명 (예: "Marathon", "Half Marathon")
  slug TEXT NOT NULL,           -- URL/매칭용 (예: "marathon", "half-marathon")
  
  -- 메타 데이터 (event_runners에서 이동)
  distance_km NUMERIC,
  distance_mi NUMERIC,
  is_relay BOOLEAN DEFAULT FALSE,
  
  -- 정렬
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 유니크 제약: 이벤트 내에서 slug는 유일
  UNIQUE(event_id, slug)
);

-- 인덱스
CREATE INDEX idx_sub_events_event_id ON sub_events(event_id);

-- RLS 활성화
ALTER TABLE sub_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_events are viewable by everyone" ON sub_events FOR SELECT USING (true);
```

### Step 1.2: `event_runners` 테이블 수정

```sql
-- event_runners에 sub_event_id 컬럼 추가
ALTER TABLE event_runners 
  ADD COLUMN sub_event_id UUID REFERENCES sub_events(sub_event_id) ON DELETE CASCADE;

-- 인덱스 추가
CREATE INDEX idx_event_runners_sub_event_id ON event_runners(sub_event_id);
```

### Step 1.3: 기존 데이터 정리

```sql
-- 기존 데이터 삭제 (서비스 중단 가능하므로)
TRUNCATE TABLE event_runners CASCADE;

-- 더 이상 필요 없는 컬럼 삭제 (optional - 추후 진행 가능)
-- ALTER TABLE event_runners DROP COLUMN event_slug;
-- ALTER TABLE event_runners DROP COLUMN event_distance_km;
-- ALTER TABLE event_runners DROP COLUMN event_distance_mi;
-- ALTER TABLE event_runners DROP COLUMN is_relay;
```

---

## Phase 2: TypeScript 타입 업데이트

`packages/supabase/src/types.ts` 파일에 `sub_events` 테이블 타입 추가 및 `event_runners`에 `sub_event_id` 컬럼 추가.

---

## Phase 3: Import 스크립트 수정

### 핵심 변경점

1. SubEvent를 먼저 생성/조회
2. 러너에 `sub_event_id` 연결
3. `--sort_order` 옵션 추가 (여러 sub-event 호출 시 순서 지정용)

### 사용 예시

#### Millennium Running (RaceRoster)

한 번의 호출로 모든 sub-events 자동 처리:

```bash
pnpm --filter @repo/scripts tsx event-runners/millenniumrunning/import-runners.ts \
  --event_id=fisher-cats-thanksgiving-5k-2025 \
  --api_url=https://results.raceroster.com/v2/api/events/exhecqdv3uwxy2e4

# 스크립트가 자동으로:
# 1. 이벤트 메타데이터에서 모든 sub-events 추출
# 2. 각 sub-event에 대해 sub_events 테이블에 저장 (sortOrder 기준)
# 3. 각 sub-event의 러너들을 event_runners에 저장
```

#### WinningEventsGroup (RaceResult)

한 번의 호출로 모든 카테고리 자동 처리 (Contest별 자동 분류):

```bash
pnpm --filter @repo/scripts tsx event-runners/winningeventsgroup/import-runners.ts \
  --event_id=some-event-2025 \
  --api_url=https://api.raceresult.com/...

# 스크립트가 자동으로:
# 1. Contest별로 sub_event 생성
# 2. 거리 기준으로 sort_order 자동 할당 (Marathon → Half → 10K → 5K)
# 3. 러너를 해당 sub_event에 연결
```

---

## Phase 4: 백엔드 서비스 리팩토링

`apps/web/src/server/services/results.ts` 간소화:

- SubEvents를 먼저 조회 (sort_order로 정렬)
- 해당 SubEvents의 러너 데이터 조회
- `sortCategories` 함수 제거 (DB sort_order로 대체)

---

## Phase 5: 프론트엔드 컴포넌트 정리

- `LeaderboardSection.tsx`: `isRelay`를 DB에서 직접 가져옴
- `race-category.ts`: `sortCategories` 함수 제거/deprecated

---

## Phase 6: 테스트 및 배포

### 로컬 테스트 순서

```bash
# 1. DB 마이그레이션 적용 (Supabase Dashboard SQL Editor)

# 2. TypeScript 타입 업데이트 후 빌드 확인
pnpm check

# 3. 테스트 이벤트로 import 스크립트 실행
pnpm --filter @repo/scripts tsx event-runners/millenniumrunning/import-runners.ts \
  --event_id=test-event \
  --meta_api_url=... \
  --dry_run

# 4. 실제 import
pnpm --filter @repo/scripts tsx event-runners/millenniumrunning/import-runners.ts \
  --event_id=test-event \
  --meta_api_url=...

# 5. 웹 앱 실행 후 확인
pnpm dev
```

### 배포 체크리스트

- [x] Supabase에 SQL 마이그레이션 적용
- [x] `packages/supabase/src/types.ts` 업데이트
- [x] `import-runners.ts` 수정
- [x] `apps/web/src/server/services/results.ts` 리팩토링
- [x] `apps/web/src/utils/race-category.ts` 정리 (deprecated 처리)
- [x] `LeaderboardSection.tsx` 수정
- [ ] 기존 이벤트 데이터 재import
- [ ] Vercel 배포

---

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|----------|
| `packages/supabase/src/types.ts` | `sub_events` 타입 추가, `event_runners`에 `sub_event_id` 추가 |
| `packages/scripts/event-runners/millenniumrunning/import-runners.ts` | SubEvent 생성 로직 추가, `sub_event_id` 연결, `--sort_order` 옵션 |
| `packages/scripts/event-runners/winningeventsgroup/import-runners.ts` | Contest별 SubEvent 자동 생성, 거리 기준 자동 정렬 |
| `apps/web/src/server/services/results.ts` | SubEvents 기반 쿼리로 리팩토링 |
| `apps/web/src/utils/race-category.ts` | `sortCategories` 함수 deprecated 처리 |
| `apps/web/src/app/events/[event]/_components/LeaderboardSection.tsx` | `isRelay` DB에서 가져오도록 수정 |

