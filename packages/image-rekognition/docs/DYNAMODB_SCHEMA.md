# DYNAMODB_SCHEMA.md

# SnapRace DynamoDB Schema Documentation

본 문서는 SnapRace **PhotoService DynamoDB 단일 테이블 설계**의 최종 버전을 정의합니다.

- 테이블명: `PhotoService-{stage}`
- 파티션 키: `PK` (string)
- 정렬 키: `SK` (string)
- GSI1: BIB 검색용 (BIB_INDEX 전용)
- GSI2: Photographer 검색용 (PHOTO 전용)

엔티티 타입
- `PHOTO` – 사진 한 장에 대한 메타데이터 및 분석 결과
- `BIB_INDEX` – BIB 번호별 사진 색인용 경량 인덱스

DynamoDB는 **조회 최적화 계층(READ-optimized Layer)**이며, RDB(Postgres)는 Truth(organizers, events, photographers, event_runners)를 담당합니다.

---

## 1. 테이블 정의

```ts
const table = new dynamodb.Table(this, 'PhotoServiceTable', {
  tableName: `PhotoService-${stage}`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});

// GSI1: BIB 검색용 (BIB_INDEX 전용)
table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// GSI2: Photographer 검색용 (PHOTO 전용)
table.addGlobalSecondaryIndex({
  indexName: 'GSI2',
  partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

---

## 2. 파티션 키 설계 개요

### Base Table

- `PK = ORG#{orgId}#EVT#{eventId}`
- `SK`:
  - `PHOTO#{ulid}` → 사진 메타데이터 (PHOTO)
  - `BIB#{bib}#PHOTO#{ulid}` → bib 색인 (BIB_INDEX)

### GSI1 (BIB 검색용)
- `GSI1PK = EVT#{eventId}#BIB#{bib}`
- `GSI1SK = PHOTO#{ulid}`

### GSI2 (Photographer 검색용)
- `GSI2PK = PHOTOGRAPHER#{photographerId}`
- `GSI2SK = EVT#{eventId}#TIME#{createdAt ISO}`

---

## 3. 엔티티 타입 정의

### 3.1 PHOTO 엔티티

**한 장의 전처리된 사진**에 대한 메타데이터, Rekognition 분석 결과, photographer 정보를 저장합니다.

#### 키 구조

```text
PK: ORG#{orgId}#EVT#{eventId}
SK: PHOTO#{ulid}
```

#### 필드 예시

```json
{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "EntityType": "PHOTO",

  "ulid": "01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "orgId": "snaprace-kr",
  "eventId": "seoul-marathon-2024",

  "originalFilename": "DSC_1234.jpg",
  "rawKey": "snaprace-kr/seoul-marathon-2024/raw/DSC_1234.jpg",
  "processedKey": "snaprace-kr/seoul-marathon-2024/processed/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",
  "s3Uri": "s3://snaprace-images-prod/snaprace-kr/seoul-marathon-2024/processed/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",

  "dimensions": { "width": 3840, "height": 2160 },
  "format": "jpeg",
  "size": 2048576,

  "bibs": ["1234", "5678"],
  "bibCount": 2,
  "faceIds": [
    "face-aaa-1",
    "face-aaa-2"
  ],
  "faceCount": 2,

  // Photographer (denormalized from RDB photographers)
  "photographerId": "ph_01ABCXYZ",
  "photographerHandle": "studio_aaa",
  "photographerDisplayName": "Studio AAA",

  // GSI2: Photographer 기준 조회를 위한 인덱스 키
  "GSI2PK": "PHOTOGRAPHER#ph_01ABCXYZ",
  "GSI2SK": "EVT#seoul-marathon-2024#TIME#2024-11-09T10:30:00.000Z",

  "createdAt": "2024-11-09T10:30:00.000Z",
  "updatedAt": "2024-11-09T10:30:05.123Z"
}
```

#### 필드 정의 요약

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| PK | string | ✅ | `ORG#{orgId}#EVT#{eventId}` |
| SK | string | ✅ | `PHOTO#{ulid}` |
| EntityType | string | ✅ | `PHOTO` 고정 |
| ulid | string | ✅ | ULID (시간순 정렬 가능) |
| orgId | string | ✅ | Organizer ID (RDB organizers 참조) |
| eventId | string | ✅ | Event ID (RDB events 참조) |
| originalFilename | string | ✅ | 업로드 시 원본 파일명 |
| rawKey | string | ✅ | S3 raw 경로 |
| processedKey | string | ✅ | S3 processed 경로 |
| s3Uri | string | ✅ | `s3://...` 형태 URI |
| dimensions | object | ✅ | `{ width, height }` |
| format | string | ✅ | 이미지 포맷 (jpeg 등) |
| size | number | ✅ | 파일 크기 (bytes) |
| bibs | string[] | ✅ | 감지된 bib 번호 배열 |
| bibCount | number | ✅ | bib 개수 |
| faceIds | string[] | ✅ | Rekognition FaceId 목록 |
| faceCount | number | ✅ | 얼굴 개수 |
| photographerId | string | ⛔(optional) | 포토그래퍼 ID (RDB photographers) |
| photographerHandle | string | optional | RDB에서 가져온 insta handle (denormalize) |
| photographerDisplayName | string | optional | RDB에서 가져온 표시 이름 |
| GSI2PK | string | optional | `PHOTOGRAPHER#{photographerId}` |
| GSI2SK | string | optional | `EVT#{eventId}#TIME#{createdAt}` |
| createdAt | string | ✅ | ISO8601 생성 시간 |
| updatedAt | string | ✅ | ISO8601 갱신 시간 |

> 🔎 `photographer*` 필드는 **RDB Truth를 기반으로 한 캐시**이며, 변경 시 RDB → Dynamo 동기화가 필요합니다.

---

### 3.2 BIB_INDEX 엔티티

특정 bib 번호에 해당하는 사진들을 빠르게 찾기 위한 **경량 인덱스 레코드**입니다.

한 사진에 bib가 2개라면 BIB_INDEX 아이템은 2개 생성됩니다.

#### 키 구조

```text
Base Table
  PK: ORG#{orgId}#EVT#{eventId}
  SK: BIB#{bib}#PHOTO#{ulid}

GSI1
  GSI1PK: EVT#{eventId}#BIB#{bib}
  GSI1SK: PHOTO#{ulid}
```

#### 필드 예시

```json
{
  "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
  "SK": "BIB#1234#PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "EntityType": "BIB_INDEX",

  "GSI1PK": "EVT#seoul-marathon-2024#BIB#1234",
  "GSI1SK": "PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP",

  "ulid": "01HXY8FWZM5KJQD9K3Y6R8NZTP",
  "orgId": "snaprace-kr",
  "eventId": "seoul-marathon-2024",
  "bib": "1234",

  "createdAt": "2024-11-09T10:30:05.123Z"
}
```

#### 필드 정의 요약

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| PK | string | ✅ | `ORG#{orgId}#EVT#{eventId}` |
| SK | string | ✅ | `BIB#{bib}#PHOTO#{ulid}` |
| EntityType | string | ✅ | `BIB_INDEX` |
| GSI1PK | string | ✅ | `EVT#{eventId}#BIB#{bib}` |
| GSI1SK | string | ✅ | `PHOTO#{ulid}` |
| ulid | string | ✅ | 관련 PHOTO의 ULID |
| orgId | string | ✅ | Organizer ID |
| eventId | string | ✅ | Event ID |
| bib | string | ✅ | bib 번호 |
| createdAt | string | ✅ | ISO8601 생성 시간 |

> BIB_INDEX는 가능한 가볍게 유지하고, 상세 메타데이터는 항상 PHOTO에서 읽도록 설계합니다.

---

## 4. 쓰기 패턴

### 4.1 사진 한 장(PHOTO) + bib 2개 저장 흐름

1. Step Functions Fanout Lambda에서 Rekognition 결과와 S3 경로를 받음
2. `PHOTO` 아이템 1개 생성
3. bib 개수만큼 `BIB_INDEX` 아이템 생성

예시: bib `1234`, `5678`

- `PHOTO` → 1개
- `BIB_INDEX` → 2개 (각 bib당 1개)

```jsonc
// PHOTO (1개)
{
  "PK": "ORG#...#EVT#...",
  "SK": "PHOTO#01...",
  "EntityType": "PHOTO",
  "bibs": ["1234", "5678"],
  ...
}

// BIB_INDEX (2개)
{
  "PK": "ORG#...#EVT#...",
  "SK": "BIB#1234#PHOTO#01...",
  "EntityType": "BIB_INDEX",
  "GSI1PK": "EVT#...#BIB#1234",
  "GSI1SK": "PHOTO#01...",
  "ulid": "01...",
  "bib": "1234"
}
{
  "PK": "ORG#...#EVT#...",
  "SK": "BIB#5678#PHOTO#01...",
  "EntityType": "BIB_INDEX",
  "GSI1PK": "EVT#...#BIB#5678",
  "GSI1SK": "PHOTO#01...",
  "ulid": "01...",
  "bib": "5678"
}
```

---

## 5. 조회 패턴 (쿼리 예시)

### 5.1 이벤트 전체 사진 조회 (관리자/갤러리 기본)

```ts
const params = {
  TableName: 'PhotoService-prod',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': 'ORG#snaprace-kr#EVT#seoul-marathon-2024',
    ':sk': 'PHOTO#',
  },
  ScanIndexForward: false, // 최신순
};
```

### 5.2 BIB 번호로 사진 검색 (GSI1 + BIB_INDEX)

```ts
const params = {
  TableName: 'PhotoService-prod',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :gsi1pk',
  ExpressionAttributeValues: {
    ':gsi1pk': 'EVT#seoul-marathon-2024#BIB#1234',
  },
  ScanIndexForward: false,
};

// 결과: 해당 bib의 BIB_INDEX 아이템 목록
// ulid를 사용해 PHOTO 아이템을 BatchGet으로 가져오거나,
// processedKey/s3Uri를 이용해 바로 이미지 렌더링
```

### 5.3 Photographer 기준 사진 조회 (GSI2 + PHOTO)

```ts
const params = {
  TableName: 'PhotoService-prod',
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'PHOTOGRAPHER#ph_01ABCXYZ',
  },
  ScanIndexForward: false, // 최신순
};

// 결과: 해당 photographer가 촬영한 모든 PHOTO 아이템
```

특정 이벤트 + 특정 photographer로 좁히려면:

```ts
const params = {
  TableName: 'PhotoService-prod',
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :evt)',
  ExpressionAttributeValues: {
    ':pk': 'PHOTOGRAPHER#ph_01ABCXYZ',
    ':evt': 'EVT#seoul-marathon-2024#',
  },
};
```

---

## 6. RDB와의 관계

- `orgId`, `eventId` → RDB의 `organizers.organizer_id`, `events.event_id` 참조
- `photographerId` → RDB의 `photographers.photographer_id` 참조
- Runner/bib ↔ PHOTO 매핑은 RDB `event_runners`와 논리적으로 연결되지만, Dynamo에서는 bib 문자열만 저장

**Truth vs Cache**
- Truth: RDB (`organizers`, `events`, `event_runners`, `photographers`, `event_photographers`)
- Dynamo: 조회 최적화를 위한 캐시/인덱스 (PHOTO, BIB_INDEX)

---

## 7. 비용 및 크기 추정 (간단 버전)

### PHOTO 아이템 (대략)
- 평균 약 1 KB

### BIB_INDEX 아이템
- 평균 약 0.4~0.6 KB (경량 설계 기준)

사진 10,000장, bib 평균 2개일 때:
- PHOTO: 10,000 × 1 KB = 10 MB
- BIB_INDEX: 20,000 × 0.5 KB = 10 MB
- 총 ≈ 20 MB (저장비 매우 저렴)

쓰기
- 사진 1장당 PutItem 3회 (PHOTO 1 + BIB_INDEX 평균 2)
- 월 10,000장 기준: 30,000 write → On-Demand 기준 비용 미미

---

## 8. 운영/확장 포인트

- 이벤트 단위 파티션 (`PK = ORG#...#EVT#...`)으로 파티션 핫스팟 가능성 줄이기
- GSI1, GSI2는 **쿼리 패턴에 정확히 맞춰 설계**했기 때문에 Scan 없이 Query만 사용
- 새 기능(예: 얼굴 검색, 구간별 사진 등)이 필요할 경우:
  - PHOTO 엔티티에 속성 추가
  - 필요하면 새로운 GSI 추가
  - BIB_INDEX 구조는 가능한 단순하게 유지

---

## 9. 변경 이력

| 버전 | 내용 |
|------|------|
| 1.0 | PHOTO / BIB_INDEX 기본 스키마 정의, GSI1 추가 |
| 2.0 | Photographer 지원을 위한 PHOTO.photographer*, GSI2 추가 |
| 2.1 | BIB_INDEX를 경량 인덱스로 단순화, 조회 패턴 정리 |
| 2.2 | RDB 연동 규칙 및 Truth/Cache 역할 분리 명시 |

---

본 문서는 SnapRace Image Pipeline의 DynamoDB 설계를 정의하며,
`RDB_SCHEMA.md`, `ARCHITECTURE.md`, `LAMBDA_FUNCTIONS.md`, `STEP_FUNCTIONS_WORKFLOW.md` 와 함께 사용됩니다.

