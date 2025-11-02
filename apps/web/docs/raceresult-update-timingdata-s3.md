# RaceResult API → S3 타임링 데이터 업로드 구현 계획

## 개요

RaceResult API에서 타임링 데이터를 가져와 mock 폴더 형식으로 변환한 후 S3에 업로드하는 스크립트를 구현합니다.

**작성일**: 2025-01-20  
**상태**: 결정 사항 확정 완료, 구현 대기 중  
**우선순위**: 중간

---

## 1. 현재 상황 분석

### 1.1 RaceResult API 구조

**API 엔드포인트 형식**:

```
https://my1.raceresult.com/{eventId}/RRPublish/data/list?key={apiKey}&listname={listname}&page=results&contest={contest}&r={r}&l={limit}
```

**예시**:

```bash
curl "https://my1.raceresult.com/369364/RRPublish/data/list?key=f1775607391b25d72cfdc021a8492089&listname=Online%7CFinal&page=results&contest=0&r=leaders&l=1000"
```

**API 응답 구조**:

```json
{
  "list": {
    "ListName": "Online|Final",
    "Fields": [...],  // UI 필드 정의
    "Orders": [...],  // 정렬 설정
    "Filters": [...]  // 필터 설정
  },
  "data": {
    "#1_5K": {
      "#1_Female": [[...], [...], ...],
      "#2_Male": [[...], [...], ...]
    },
    "#2_10K": {
      "#1_Female": [[...], [...], ...],
      "#2_Male": [[...], [...], ...]
    }
  },
  "DataFields": [
    "BIB",
    "ID",
    "WithStatus([AutoRank.p])",
    "Bib",
    "DisplayName",
    "Nation.Flag",
    "Age",
    "Club",
    "Finish.PACE",
    "Finish.CHIP",
    "Finish.GUN"
  ],
  "groupFilters": [...]
}
```

**데이터 구조 특징**:

- `data` 필드: contest별로 그룹화된 결과 (`#1_5K`, `#2_10K` 등)
- 각 contest 아래: 성별/연령대별 그룹 (`#1_Female`, `#2_Male` 등)
- 각 그룹: 배열의 배열 형태 (row 배열)
- `DataFields`: 실제 데이터 필드 순서 정의
- `list.Fields`: UI 표시용 필드 정의 (Label, Alignment 등)

### 1.2 Mock 파일 구조

**index.json**:

```json
{
  "event_id": "everybody-5k-10k-2025",
  "event_name": "Everybody 5k + 10k",
  "organization_id": "winningeventsgroup",
  "result_sets": [
    {
      "id": "everybody-10k-2025-5k",
      "category": "5K",
      "s3_key": "winningeventsgroup/everybody-10k-2024/results/5k.json"
    },
    {
      "id": "everybody-5k-2025-10k",
      "category": "10K",
      "s3_key": "winningeventsgroup/everybody-10k-2024/results/10k.json"
    }
  ],
  "updated_at": "2025-10-19T12:40:00Z"
}
```

**5k.json / 10k.json**:

```json
{
  "headings": [
    {
      "key": "race_placement",
      "name": "Place",
      "style": "place",
      "hidden": false
    },
    {
      "key": "bib_num",
      "name": "Bib",
      "style": "bib",
      "hidden": false
    }
    // ... 더 많은 필드
  ],
  "resultSet": {
    "extraFieldIds": [475549],
    "results": [
      [
        1,
        "1703",
        "ABDULLAH ABBASI",
        "",
        "M",
        25,
        "WEST NEW YORK",
        "NJ",
        "US",
        "19:08",
        "19:07",
        "",
        "",
        "1",
        "Male Overall",
        "1"
      ],
      [
        2,
        "1787",
        "LAWRENCE TOPOR",
        "",
        "M",
        53,
        "HAWORTH",
        "NJ",
        "US",
        "19:17",
        "19:16",
        "",
        "",
        "2",
        "Male Overall",
        "2"
      ]
      // ... 더 많은 레코드
    ]
  }
}
```

### 1.3 S3 저장 경로

**경로 형식**:

```
snap-race/{organizerId}/{eventId}/results/{contest}.json
snap-race/{organizerId}/{eventId}/results/index.json
```

**예시**:

```
snap-race/winningeventsgroup/everybody-5k-10k-2025/results/5k.json
snap-race/winningeventsgroup/everybody-5k-10k-2025/results/10k.json
snap-race/winningeventsgroup/everybody-5k-10k-2025/results/index.json
```

---

## 2. 구현 목표

### 2.1 핵심 기능

1. **RaceResult API 데이터 페칭**
   - Event ID, API Key, List Name 등으로 타임링 데이터 조회
   - 에러 핸들링 및 재시도 로직

2. **데이터 변환**
   - API 응답 형식 → Mock 파일 형식
   - Contest별로 데이터 분리
   - `DataFields` 기반으로 headings 생성
   - 성별/연령대별 그룹을 하나의 results 배열로 병합

3. **JSON 파일 생성**
   - 각 contest별 JSON 파일 생성 (5k.json, 10k.json 등)
   - index.json 생성 (메타데이터 및 result_sets 목록)

4. **S3 업로드**
   - 생성된 JSON 파일들을 S3에 업로드
   - Content-Type: application/json 설정

5. **CLI 인터페이스**
   - 커맨드 라인 인자로 필요한 정보 입력
   - 진행 상황 표시
   - 성공/실패 통계 출력

### 2.2 비기능 요구사항

- **에러 핸들링**: 네트워크 오류, API 오류, S3 오류 처리
- **로깅**: 처리 진행 상황, 성공/실패 로그
- **확장성**: 대량 데이터 처리 지원 (1000+ 레코드)

---

## 3. 데이터 변환 로직

### 3.1 API 응답 → Mock 형식 변환

**Step 1: Contest별 데이터 추출**

```typescript
// groupFilters에서 contest 이름 추출
// groupFilters[0].Type === 1인 경우 Values 배열에서 contest 이름 추출
// 예: ["5K", "10K"] → 각각 "5k.json", "10k.json"으로 변환

// Fallback: groupFilters 추출 실패 시 키에서 직접 추출
// "#1_5K" → "5K" → "5k.json"
// "#2_10K" → "10K" → "10k.json"
```

**Step 2: Headings 생성**

`list.Fields`와 `DataFields`를 매핑하여 headings 배열 생성:

```typescript
// list.Fields의 각 항목을 headings 형식으로 변환
{
  key: "race_placement",  // DataFields 인덱스 기반 매핑
  name: "Place",           // list.Fields[].Label
  style: "place",          // list.Fields[].Expression 기반 추론
  hidden: false            // list.Fields[].ResponsiveHide 기반
}
```

**필드 매핑 규칙** (기본 필드만 매핑):

| API Expression             | Mock Key         | DataFields 인덱스 | 비고                        |
| -------------------------- | ---------------- | ----------------- | --------------------------- |
| `WithStatus([AutoRank.p])` | `race_placement` | 2                 | Place                       |
| `Bib`                      | `bib_num`        | 3                 | Bib Number                  |
| `DisplayName`              | `name`           | 4                 | Name                        |
| `Nation.Flag`              | `countrycode`    | 5                 | Country (hidden, 없으면 "") |
| `Age`                      | `age`            | 6                 | Age                         |
| `Finish.PACE`              | `avg_pace`       | 8                 | Pace                        |
| `Finish.CHIP`              | `chip_time`      | 9                 | Chip Time                   |
| `Finish.GUN`               | `clock_time`     | 10                | Clock Time                  |

**추가 필드** (API 응답에 없음, 빈 문자열 처리):

- `profile_image_url`: `""`
- `city`: `""`
- `state`: `""`
- `gender`: 추정 (필요시 `MaleFemale` 기반으로 추출, 없으면 `""`)

**데이터 추출 방식**:

- `DataFields` 배열의 인덱스를 기준으로 row 데이터 추출
- 예: `DataFields[0] = "BIB"`이면 `row[0]`이 BIB 값

**Step 3: Results 배열 생성**

각 contest의 모든 그룹(`#1_Female`, `#2_Male` 등)을 하나의 results 배열로 병합:

```typescript
// 모든 그룹의 데이터를 하나로 합치기 (API 응답 순서 유지)
const allResults = [];
// Object.keys()는 삽입 순서를 보장하므로 API 응답 순서 유지
for (const groupKey in contestData) {
  const groupData = contestData[groupKey];
  // 각 그룹 내 순서 유지하며 추가
  allResults.push(...groupData);
}
// 그룹 간 순서는 API 응답 순서 유지, 그룹 내 순서도 유지
```

**Step 4: Index.json 생성**

```typescript
{
  event_id: string,        // CLI 인자
  event_name: string,       // CLI 인자
  organization_id: string,  // CLI 인자 (organizerId)
  result_sets: [
    {
      id: string,           // "{eventId}-{contest}"
      category: string,     // "5K", "10K" 등
      s3_key: string        // "{organizerId}/{eventId}/results/{contest}.json"
    }
  ],
  updated_at: string        // ISO 8601 형식
}
```

---

## 4. 구현 계획

### 4.1 프로젝트 구조

```
apps/web/
├── src/
│   └── scripts/
│       └── raceresult/
│           ├── update-timingdata-s3.ts     # 메인 스크립트
│           └── utils/
│               ├── raceresult-timing-api.ts    # RaceResult API 클라이언트
│               ├── timing-data-transformer.ts   # 데이터 변환 로직
│               └── s3-helpers.ts                # S3 업로드 헬퍼 함수
├── package.json                            # 스크립트 실행 명령어 추가
└── tsconfig.json                           # TypeScript 설정
```

### 4.2 기술 스택

- **언어**: TypeScript + Node.js
- **AWS SDK**: AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`)
- **CLI**: `yargs` (기존 패턴 따름)

---

## 5. CLI 인터페이스

### 5.1 커맨드 라인 인자

**필수 인자**:

- `--event-id`: RaceResult API Event ID (예: `369364`)
- `--api-key`: RaceResult API Key
- `--listname`: List Name (예: `Online|Final`, URL 인코딩 필요)
- `--organizer-id`: Organizer ID (S3 경로용, 예: `winningeventsgroup`)
- `--event-id-db`: Event ID (S3 경로용, 예: `everybody-5k-10k-2025`)
- `--event-name`: Event Name (예: `Everybody 5k + 10k`)

**선택적 인자**:

- `--contest`: Contest 필터 (기본값: `0` = 모든 contest)
- `--limit`: 결과 제한 (기본값: `1000`)
- `--r`: 정렬 방식 (기본값: `leaders`)
- `--bucket-name`: S3 버킷 이름 (기본값: 환경 변수 `BUCKET`)

**실행 예시**:

```bash
pnpm run timing:update-s3 \
  --event-id 369364 \
  --api-key f1775607391b25d72cfdc021a8492089 \
  --listname "Online|Final" \
  --organizer-id winningeventsgroup \
  --event-id-db everybody-5k-10k-2025 \
  --event-name "Everybody 5k + 10k"
```

---

## 6. 결정 사항 확정 ✅

### 6.1 Contest 이름 매핑 ✅

**결정**: `groupFilters`에서 contest 이름 추출

**구현 방식**:

- `groupFilters` 배열에서 `Type: 1`인 항목의 `Values` 배열에서 contest 이름 추출
- 추출한 contest 이름을 소문자로 변환하여 파일명 생성 (예: `5K` → `5k.json`)
- Fallback: `groupFilters`에서 추출 실패 시 키에서 직접 추출 (`#1_5K` → `5K` → `5k.json`)

**이유**: `groupFilters`는 API 응답 기반이므로 더 안정적이고 신뢰할 수 있습니다.

### 6.2 필드 매핑 규칙 ✅

**결정**: 기본 필드만 매핑

**매핑 필드**:

- Place (`WithStatus([AutoRank.p])` → `race_placement`)
- Bib (`Bib` → `bib_num`)
- Name (`DisplayName` → `name`)
- Gender (추정: `MaleFemale` → `gender`)
- Age (`Age` → `age`)
- Pace (`Finish.PACE` → `avg_pace`)
- Chip Time (`Finish.CHIP` → `chip_time`)
- Clock Time (`Finish.GUN` → `clock_time`)

**추가 필드 처리**:

- 도시 정보 (`city`, `state`): API 응답에 없으므로 빈 문자열(`""`) 처리
- `profile_image_url`: 빈 문자열(`""`) 처리
- `countrycode`: `Nation.Flag`에서 추출 가능한 경우에만 포함, 없으면 빈 문자열
- Hidden 필드: `list.Fields[].ResponsiveHide` 값이 0이 아닌 경우 `hidden: true`

**DataFields 인덱스 매핑**:

- `DataFields[0] = "BIB"`이면 `row[0]`이 BIB 값임을 확인 완료
- 각 필드는 `DataFields` 배열의 인덱스를 기준으로 row 데이터 추출

### 6.3 결과 정렬 ✅

**결정**: 그룹 내 순서 유지, 그룹 간 순서는 API 응답 순서 유지

**구현 방식**:

- 각 contest의 모든 그룹(`#1_Female`, `#2_Male` 등)을 API 응답 순서대로 순회
- 각 그룹 내의 row 데이터는 기존 순서 유지 (각 그룹의 첫 번째 요소는 Place 순서)
- 그룹 간 순서는 API 응답의 키 순서 유지

**이유**: 기존 순서를 유지하여 데이터의 일관성을 보장하고, UI에서 기대하는 순서와 일치시킵니다.

### 6.4 에러 처리 ✅

**결정**: 부분 성공 방식 (각 contest별로 독립적으로 처리)

**구현 방식**:

- 각 contest별로 독립적으로 변환 및 업로드 처리
- 성공한 contest는 S3에 업로드
- 실패한 contest는 에러 로그만 기록하고 다음 contest 계속 처리
- 최종적으로 성공/실패 통계 출력
- S3 업로드 실패 시 지수 백오프 재시도 (최대 3회)

**이유**: 일부 contest만 실패해도 나머지 contest는 정상적으로 업로드하여 데이터 손실을 최소화합니다.

---

## 7. 환경 변수 설정

### 7.1 필수 환경 변수

기존 환경 변수 사용:

- `AWS_REGION`: AWS 리전
- `AWS_ACCESS_KEY_ID`: AWS 액세스 키
- `AWS_SECRET_ACCESS_KEY`: AWS 시크릿 키
- `BUCKET`: S3 버킷 이름 (기본값: `snap-race`)

---

## 8. 구현 단계

### Phase 1: 기반 구조 구축

- [ ] `apps/web/src/scripts/raceresult/update-timingdata-s3.ts` 파일 생성
- [ ] `utils/raceresult-timing-api.ts` 파일 생성
- [ ] `utils/timing-data-transformer.ts` 파일 생성
- [ ] `utils/s3-helpers.ts` 파일 생성
- [ ] TypeScript 설정 확인

### Phase 2: RaceResult API 연동

- [ ] RaceResult API 클라이언트 구현
- [ ] 에러 핸들링 및 재시도 로직 (지수 백오프 포함)
- [ ] 데이터 타입 정의

### Phase 3: 데이터 변환 로직

- [ ] Contest별 데이터 추출
- [ ] Headings 생성 로직 (`list.Fields` → mock headings)
- [ ] Results 배열 생성 (그룹 병합)
- [ ] Index.json 생성 로직

### Phase 4: S3 업로드

- [ ] S3 클라이언트 설정
- [ ] JSON 파일 업로드 함수
- [ ] 에러 핸들링 및 재시도 로직

### Phase 5: CLI 인터페이스

- [ ] 커맨드 라인 인자 파싱 (`yargs` 사용)
- [ ] 진행 상황 표시
- [ ] 통계 출력 (성공/실패 개수)

### Phase 6: 테스트 및 문서화

- [ ] 실제 데이터로 테스트
- [ ] 에러 시나리오 테스트
- [ ] 사용법 문서 작성

---

## 9. 예상 결과물

### 9.1 생성될 파일

```
apps/web/
├── src/
│   └── scripts/
│       └── raceresult/
│           ├── update-timingdata-s3.ts
│           └── utils/
│               ├── raceresult-timing-api.ts
│               ├── timing-data-transformer.ts
│               └── s3-helpers.ts
└── package.json                              # 스크립트 명령어 추가
```

### 9.2 package.json 스크립트 추가

```json
{
  "scripts": {
    "timing:update-s3": "tsx src/scripts/raceresult/update-timingdata-s3.ts"
  }
}
```

---

## 10. 실행 시나리오

### 10.1 기본 사용법

```bash
# 1. 의존성 설치
cd apps/web
pnpm install

# 2. 환경 변수 설정
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export BUCKET=snap-race

# 3. 스크립트 실행
pnpm run timing:update-s3 \
  --event-id 369364 \
  --api-key f1775607391b25d72cfdc021a8492089 \
  --listname "Online|Final" \
  --organizer-id winningeventsgroup \
  --event-id-db everybody-5k-10k-2025 \
  --event-name "Everybody 5k + 10k"
```

---

## 11. 리스크 및 완화 방안

### 11.1 API Rate Limiting

**리스크**: RaceResult API 호출 제한

**완화**:

- 요청 간 딜레이 추가
- 에러 발생 시 재시도 로직

### 11.2 데이터 형식 변경

**리스크**: API 응답 형식 변경 시 변환 로직 실패

**완화**:

- 타입 검증
- 필수 필드 확인
- 에러 로깅

### 11.3 S3 업로드 실패

**리스크**: 대량 데이터 업로드 시 실패

**완화**:

- 재시도 로직
- 부분 성공 처리
- 에러 로깅

---

## 12. 참고 자료

- [RaceResult API 문서](https://www.raceresult.com/) (공식 문서 확인 필요)
- [AWS S3 PutObject 문서](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)
- [AWS SDK for JavaScript v3 문서](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- 기존 구현 참고: `apps/web/src/scripts/raceresult/update-runners-table.ts`
- Mock 파일 참고: `apps/web/src/mock/`

---

## 변경 이력

| 날짜       | 작성자 | 변경 내용                                                           |
| ---------- | ------ | ------------------------------------------------------------------- |
| 2025-01-20 | Claude | 초안 작성 - 구현 계획 수립 완료                                     |
| 2025-01-20 | Claude | 결정 사항 확정 - Contest 매핑, 필드 매핑, 정렬, 에러 처리 방식 확정 |
