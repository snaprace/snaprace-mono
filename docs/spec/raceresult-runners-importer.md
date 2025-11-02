# RaceResult API → DynamoDB Runners 테이블 데이터 임포트 구현 계획

## 개요

RaceResult API에서 레이스 결과 데이터를 가져와 DynamoDB Runners 테이블에 저장하는 스크립트/프로그램을 구현합니다.

**작성일**: 2025-01-20  
**상태**: 구현 완료 (Phase 1-5 완료, Phase 6 테스트 대기 중)  
**우선순위**: 중간

---

## 1. 현재 상황 분석

### 1.1 RaceResult API 구조

**API 엔드포인트 형식**:

```
https://api.raceresult.com/{eventId}/{apiKey}
```

**예시**:

```bash
curl -s "https://api.raceresult.com/369364/IWHDJALRR9QHRNR3J6BZ1H02TOY1KUVC"
```

**API 응답 형식**:

```json
[
  {
    "Contest": "5K",
    "Bib": 1502,
    "Name": "ANA POLANCO",
    "Hometown": "Harrison, NJ",
    "Age": 42,
    "Gender": "F",
    "AG": "Female 40-49",
    "Start Time": "09:06:58",
    "Finish Time": "09:42:36",
    "Course Time Chip": "35:38",
    "Course Time Gun": "35:57"
  },
  {
    "Contest": "5K",
    "Bib": 1504,
    "Name": "Thomas Barone",
    "Hometown": "Kearny, NJ",
    "Age": 72,
    "Gender": "M",
    "AG": "Male 70+",
    "Start Time": "09:06:42",
    "Finish Time": "09:32:33",
    "Course Time Chip": "25:52",
    "Course Time Gun": "25:54"
  }
]
```

### 1.2 DynamoDB Runners 테이블 구조

**현재 저장 형식**:

```json
{
  "bib_number": {
    "S": "228"
  },
  "event_id": {
    "S": "happy-hour-hustle-week4-2025"
  },
  "event_date": {
    "S": "8/28/25"
  },
  "event_name": {
    "S": "Happy Hour Hustle Week4 2025"
  },
  "finish_time": {
    "S": "18:47:22"
  },
  "name": {
    "S": "Eileen O'Sullivan"
  }
}
```

**DynamoDB 테이블 스키마 (확인 완료)**:

- **Partition Key**: `bib_number` (String, HASH)
- **Sort Key**: `event_id` (String, RANGE)
- **Billing Mode**: PAY_PER_REQUEST (온디맨드)
- **속성**:
  - `bib_number`: String (필수, Partition Key)
  - `event_id`: String (필수, Sort Key)
  - `event_date`: String (필수)
  - `event_name`: String (필수)
  - `finish_time`: String (필수)
  - `name`: String (필수)

### 1.3 데이터 매핑 필요사항

**API → DynamoDB 변환**:
| API 필드 | DynamoDB 필드 | 변환 로직 | 비고 |
|---------|--------------|----------|------|
| `Bib` | `bib_number` | `String(record.Bib)` | 숫자 → 문자열 변환 |
| N/A | `event_id` | **사용자 입력** | API에서 제공되지 않음 |
| N/A | `event_date` | **사용자 입력** | API에서 제공되지 않음 |
| N/A | `event_name` | **사용자 입력** | API에서 제공되지 않음 |
| `Finish Time` | `finish_time` | `record["Finish Time"]` | 직접 매핑 |
| `Name` | `name` | `record.Name` | 직접 매핑 |

### 1.4 프로젝트 구조 분석

**현재 상태**:

- ✅ `apps/web/src/mock/fetch-raceroster-data.js`: RaceRoster API 데이터 페처 (참고용)
- ✅ `apps/web/src/lib/dynamodb.ts`: DynamoDB 클라이언트 설정
- ✅ `apps/web/src/env.js`: 환경 변수 관리
- ❌ Runners 테이블 환경 변수 없음
- ❌ RaceResult API 연동 스크립트 없음

**기존 패턴 참고**:

- `fetch-raceroster-data.js`는 CLI 스크립트로 구현됨
- AWS SDK v3 사용 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)
- 환경 변수는 `env.js`에서 관리

---

## 2. 구현 목표

### 2.1 핵심 기능

1. **RaceResult API 데이터 페칭**
   - Event ID와 API Key로 레이스 결과 조회
   - 에러 핸들링 및 재시도 로직

2. **데이터 변환**
   - API 응답 형식 → DynamoDB 저장 형식
   - 필수 필드 검증
   - 선택적 필드 처리

3. **DynamoDB 배치 저장**
   - 여러 레코드를 효율적으로 저장
   - 중복 처리 (같은 bib_number + event_id 조합)
   - 에러 발생 시 부분 실패 처리

4. **CLI 인터페이스**
   - 커맨드 라인 인자로 Event ID, API Key, Event 정보 입력
   - 진행 상황 표시
   - 성공/실패 통계 출력

### 2.2 비기능 요구사항

- **에러 핸들링**: 네트워크 오류, API 오류, DynamoDB 오류 처리
- **로깅**: 처리 진행 상황, 성공/실패 로그
- **멱등성**: 동일 데이터 재실행 시 안전하게 처리
- **확장성**: 대량 데이터 처리 지원 (1000+ 레코드)

---

## 3. 구현 계획

### 3.1 프로젝트 구조

```
apps/web/
├── src/
│   └── scripts/
│       ├── import-raceresult-runners.ts     # 메인 스크립트
│       └── utils/
│           ├── raceresult-api.ts           # RaceResult API 클라이언트
│           ├── runners-transformer.ts      # 데이터 변환 로직
│           └── dynamodb-helpers.ts         # DynamoDB 헬퍼 함수
├── package.json                            # 스크립트 실행 명령어 추가
└── tsconfig.json                           # TypeScript 설정
```

**또는 더 간단한 구조**:

```
apps/web/
├── scripts/
│   └── import-raceresult-runners.ts        # 독립 실행 가능한 스크립트
└── package.json
```

### 3.2 기술 스택 결정

**권장**: TypeScript + Node.js

**이유**:

- ✅ 프로젝트 전반이 TypeScript 사용 중
- ✅ 타입 안정성 보장
- ✅ 기존 코드와 일관성 유지

**대안**: JavaScript (Node.js)

- 더 간단한 설정
- 기존 `fetch-raceroster-data.js`와 일관성

**결정 완료**: ✅ TypeScript + Node.js 사용

### 3.3 AWS SDK 사용 방법

**사용**: AWS SDK for JavaScript v3

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
```

**이유**:

- 배치 처리 효율성
- 에러 핸들링 용이
- 재사용성 높음

---

## 4. 상세 구현 사항

### 4.1 데이터 변환 로직

**TypeScript 인터페이스 정의**:

```typescript
// RaceResult API 응답 형식
interface RaceResultRecord {
  Contest: string
  Bib: number
  Name: string
  Hometown: string
  Age: number
  Gender: string
  AG: string
  'Start Time': string
  'Finish Time': string
  'Course Time Chip': string
  'Course Time Gun': string
}

// DynamoDB 저장 형식 (최소 필드만 저장)
interface RunnerItem {
  bib_number: string // Partition Key
  event_id: string // Sort Key
  event_date: string
  event_name: string
  finish_time: string
  name: string
}
```

**변환 함수**:

```typescript
function transformToRunnerItem(
  record: RaceResultRecord,
  eventInfo: {
    eventId: string
    eventDate: string
    eventName: string
  }
): RunnerItem {
  return {
    bib_number: String(record.Bib),
    event_id: eventInfo.eventId,
    event_date: eventInfo.eventDate,
    event_name: eventInfo.eventName,
    finish_time: record['Finish Time'],
    name: record.Name
  }
}
```

### 4.2 RaceResult API 클라이언트

```typescript
async function fetchRaceResultData(eventId: string, apiKey: string): Promise<RaceResultRecord[]> {
  const url = `https://api.raceresult.com/${eventId}/${apiKey}`

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`RaceResult API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('Invalid API response format')
  }

  return data
}
```

### 4.3 DynamoDB 배치 저장

**배치 WriteItem 사용** (최대 25개 항목):

```typescript
async function batchSaveRunners(items: RunnerItem[], tableName: string): Promise<{ success: number; failed: number }> {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION })
  const docClient = DynamoDBDocumentClient.from(client)

  let success = 0
  let failed = 0

  // 25개씩 배치 처리
  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25)

    const requests = batch.map((item) => ({
      PutRequest: {
        Item: item
      }
    }))

    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: requests
          }
        })
      )
      success += batch.length
    } catch (error) {
      console.error(`Batch write failed:`, error)
      failed += batch.length
    }
  }

  return { success, failed }
}
```

**중복 처리 전략**: ✅ PutItem으로 덮어쓰기 (최신 데이터 유지)

- BatchWriteItem의 PutRequest는 자동으로 기존 항목을 덮어씀
- 추가 처리 불필요

### 4.4 CLI 인터페이스

**커맨드 라인 인자** (CLI 인자 방식 사용):

```bash
tsx src/scripts/import-raceresult-runners.ts \
  --event-id 369364 \
  --api-key IWHDJALRR9QHRNR3J6BZ1H02TOY1KUVC \
  --event-id-db happy-hour-hustle-week4-2025 \
  --event-date "8/28/25" \
  --event-name "Happy Hour Hustle Week4 2025"
```

**필수 인자**:

- `--event-id`: RaceResult API Event ID
- `--api-key`: RaceResult API Key
- `--event-id-db`: DynamoDB에 저장할 event_id
- `--event-date`: 이벤트 날짜
- `--event-name`: 이벤트 이름 (DynamoDB에 저장되는 필수 필드)

**`--event-name`이 필요한 이유**:

DynamoDB Runners 테이블에는 `event_name` 필드가 **필수 속성**으로 정의되어 있습니다. RaceResult API는 이 정보를 제공하지 않기 때문에, 사용자가 직접 입력해야 합니다.

- `event_id`: 기술적 식별자 (예: "happy-hour-hustle-week4-2025")
- `event_name`: 사용자 친화적인 이름 (예: "Happy Hour Hustle Week4 2025")

두 필드는 모두 DynamoDB에 저장되어야 하며, `event_name`은 UI에서 표시하거나 검색 시 사용됩니다.

**선택적 인자**:

- `--table-name`: DynamoDB 테이블 이름 (기본값: 환경 변수 또는 "Runners")

**라이브러리**: `yargs` 사용

---

## 5. 환경 변수 설정

### 5.1 필수 환경 변수 추가

**apps/web/src/env.js에 추가**:

```javascript
DYNAMO_RUNNERS_TABLE: z.string(),
```

**apps/web/.env.example에 추가**:

```env
DYNAMO_RUNNERS_TABLE=Runners
```

### 5.2 AWS 자격 증명

**옵션 1**: 환경 변수 사용 (기존 방식)

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
```

**옵션 2**: AWS CLI 프로파일 사용

```bash
aws configure --profile snaprace
export AWS_PROFILE=snaprace
```

---

## 6. 에러 핸들링 및 재시도

### 6.1 RaceResult API 에러 처리

```typescript
async function fetchRaceResultDataWithRetry(
  eventId: string,
  apiKey: string,
  maxRetries = 3
): Promise<RaceResultRecord[]> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchRaceResultData(eventId, apiKey)
    } catch (error) {
      if (attempt === maxRetries) {
        throw error
      }
      // 지수 백오프: 1초, 2초, 4초
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
  throw new Error('Max retries exceeded')
}
```

### 6.2 DynamoDB 에러 처리

**Throttling 처리**:

```typescript
if (error.name === 'ProvisionedThroughputExceededException') {
  // 지수 백오프 재시도
  await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000))
}
```

**Validation 에러**:

- 필수 필드 누락 시 해당 레코드 스킵 및 로그 기록
- 잘못된 데이터 형식 시 해당 레코드 스킵 및 로그 기록

---

## 7. 실행 시나리오

### 7.1 기본 사용법

```bash
# 1. 의존성 설치
cd apps/web
pnpm install

# 2. 환경 변수 설정
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export DYNAMO_RUNNERS_TABLE=Runners

# 3. 스크립트 실행
pnpm run import:raceresult \
  --event-id 369364 \
  --api-key IWHDJALRR9QHRNR3J6BZ1H02TOY1KUVC \
  --event-id-db happy-hour-hustle-week4-2025 \
  --event-date "8/28/25" \
  --event-name "Happy Hour Hustle Week4 2025"
```

**또는 테이블 이름 직접 지정**:

```bash
pnpm run import:raceresult \
  --event-id 369364 \
  --api-key IWHDJALRR9QHRNR3J6BZ1H02TOY1KUVC \
  --event-id-db happy-hour-hustle-week4-2025 \
  --event-date "8/28/25" \
  --event-name "Happy Hour Hustle Week4 2025" \
  --table-name Runners
```

### 7.2 배치 처리 예시

```bash
# 여러 이벤트 일괄 처리
for event in event1 event2 event3; do
  pnpm run import:raceresult \
    --event-id $event \
    --api-key $API_KEY \
    --event-id-db $event \
    --event-date "8/28/25" \
    --event-name "$event Name"
done
```

---

## 8. 결정 사항 확정 ✅

### 8.1 구현 방식

**결정**: ✅ Node.js 스크립트 (TypeScript + AWS SDK v3)

- 배치 처리 효율적
- 에러 핸들링 용이
- 재사용성 높음

### 8.2 DynamoDB 테이블 구조

**확인 완료**:

- ✅ Partition Key: `bib_number` (String, HASH)
- ✅ Sort Key: `event_id` (String, RANGE)
- ✅ Billing Mode: PAY_PER_REQUEST (온디맨드)
- ✅ GSI 없음

### 8.3 이벤트 정보 입력 방식

**결정**: ✅ CLI 인자로 입력

- `--event-id-db`: DynamoDB event_id
- `--event-date`: 이벤트 날짜
- `--event-name`: 이벤트 이름

### 8.4 중복 처리 전략

**결정**: ✅ 덮어쓰기 (PutItem)

- BatchWriteItem의 PutRequest 사용
- 최신 데이터 유지
- 간단한 구현

### 8.5 선택적 필드 저장 여부

**결정**: ✅ 최소 필드만 저장

- `bib_number`, `event_id`, `event_date`, `event_name`, `finish_time`, `name`만 저장
- 추가 필드 (hometown, age, gender 등)는 저장하지 않음

---

## 9. 구현 단계

### Phase 1: 기반 구조 구축 ✅ 완료

- [x] `apps/web/src/scripts/` 디렉토리 생성
- [x] TypeScript 설정 확인 (기존 설정 사용)
- [x] 환경 변수 추가 (`DYNAMO_RUNNERS_TABLE`)
- [x] 기본 스크립트 파일 생성

### Phase 2: RaceResult API 연동 ✅ 완료

- [x] RaceResult API 클라이언트 구현
- [x] 에러 핸들링 및 재시도 로직 (지수 백오프 포함)
- [x] 데이터 타입 정의 (`RaceResultRecord` 인터페이스)

### Phase 3: 데이터 변환 로직 ✅ 완료

- [x] 데이터 변환 함수 구현 (`transformToRunnerItem`)
- [x] 필드 매핑 로직 (Bib → bib_number, Finish Time → finish_time 등)
- [x] 검증 로직 (필수 필드 검증 포함)

### Phase 4: DynamoDB 저장 ✅ 완료

- [x] DynamoDB 클라이언트 설정 (`createDynamoDBClient`)
- [x] 배치 WriteItem 구현 (25개씩 처리)
- [x] 에러 핸들링 (Throttling 및 개별 항목 재시도 포함)

### Phase 5: CLI 인터페이스 ✅ 완료

- [x] 커맨드 라인 인자 파싱 (`yargs` 사용)
- [x] 진행 상황 표시 (배치별 진행 상황 및 통계)
- [x] 통계 출력 (성공/실패 개수)

### Phase 6: 테스트 및 문서화 🔄 부분 완료

- [ ] 실제 데이터로 테스트 (사용자 실행 필요)
- [ ] 에러 시나리오 테스트 (사용자 실행 필요)
- [x] 사용법 문서 작성 (spec 문서에 포함)
- [ ] README 업데이트 (선택 사항)

**총 예상 기간**: 6일 (1인 기준)  
**실제 구현 기간**: 1일 (모든 Phase 1-5 완료)

---

## 10. 예상 결과물

### 10.1 생성될 파일

```
apps/web/
├── src/
│   └── scripts/
│       ├── import-raceresult-runners.ts
│       └── utils/
│           ├── raceresult-api.ts
│           ├── runners-transformer.ts
│           └── dynamodb-helpers.ts
├── package.json                              # 스크립트 명령어 추가
└── README.md                                 # 사용법 문서 업데이트
```

### 10.2 package.json 스크립트 추가

```json
{
  "scripts": {
    "import:raceresult": "tsx src/scripts/import-raceresult-runners.ts"
  }
}
```

**의존성 추가** (완료):

```json
{
  "devDependencies": {
    "tsx": "^4.19.2", // TypeScript 실행
    "yargs": "^17.7.2" // CLI 인자 파싱
  }
}
```

**실제 생성된 파일**:

```
apps/web/
├── src/
│   └── scripts/
│       ├── import-raceresult-runners.ts      # 메인 스크립트
│       └── utils/
│           ├── raceresult-api.ts            # RaceResult API 클라이언트
│           ├── runners-transformer.ts        # 데이터 변환 로직
│           └── dynamodb-helpers.ts          # DynamoDB 헬퍼 함수
└── package.json                              # 스크립트 및 의존성 추가됨
```

---

## 11. 향후 확장 가능성

### 11.1 추가 기능

1. **증분 업데이트**: 기존 데이터 확인 후 변경된 항목만 업데이트
2. **다중 이벤트 일괄 처리**: 설정 파일로 여러 이벤트 한번에 처리
3. **Dry-run 모드**: 실제 저장 없이 검증만 수행
4. **로깅 개선**: CloudWatch Logs 연동
5. **스케줄링**: EventBridge로 주기적 실행

### 11.2 다른 데이터 소스 연동

- RaceRoster API (이미 구현됨)
- RunSignup API
- ChronoTrack API
- 기타 타이밍 서비스

---

## 12. 리스크 및 완화 방안

### 12.1 API Rate Limiting

**리스크**: RaceResult API 호출 제한

**완화**:

- 요청 간 딜레이 추가
- 에러 발생 시 재시도 로직

### 12.2 DynamoDB Throttling

**리스크**: 대량 데이터 처리 시 쓰로틀링

**완화**:

- 배치 크기 조절 (25개씩)
- 지수 백오프 재시도
- 온디맨드 용량 모드 사용

### 12.3 데이터 불일치

**리스크**: API 응답 형식 변경

**완화**:

- 타입 검증
- 필수 필드 확인
- 에러 로깅

---

## 13. 참고 자료

- [RaceResult API 문서](https://www.raceresult.com/) (공식 문서 확인 필요)
- [AWS DynamoDB BatchWriteItem 문서](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html)
- [AWS SDK for JavaScript v3 문서](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- 기존 구현 참고: `apps/web/src/mock/fetch-raceroster-data.js`

---

## 14. 결정 사항 요약 ✅

### ✅ 결정 완료

1. **구현 방식**: ✅ Node.js 스크립트 (TypeScript + AWS SDK v3)
2. **언어**: ✅ TypeScript
3. **중복 처리**: ✅ 덮어쓰기 (PutItem)
4. **선택적 필드**: ✅ 최소 필드만 저장 (6개 필드)
5. **이벤트 정보 입력**: ✅ CLI 인자로 입력
6. **테이블 구조**: ✅ Partition Key: bib_number, Sort Key: event_id

### ✅ 구현 진행 가능

- 환경 변수 추가
- 기본 스크립트 구조
- RaceResult API 연동
- 데이터 변환 로직
- DynamoDB 저장

---

## 변경 이력

| 날짜       | 작성자 | 변경 내용                                                     |
| ---------- | ------ | ------------------------------------------------------------- |
| 2025-01-20 | Claude | 초안 작성 - 구현 계획 수립 완료                               |
| 2025-01-20 | Claude | 결정 사항 반영 - 테이블 구조, 구현 방식 확정                  |
| 2025-01-20 | Claude | 구현 완료 - 스크립트 및 유틸리티 파일 작성                    |
| 2025-01-20 | Claude | 문서 업데이트 - 구현 단계 완료 표시 및 --event-name 설명 추가 |
