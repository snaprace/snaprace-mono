# ARCHITECTURE.md

# SnapRace Photo Platform Architecture

본 문서는 SnapRace 이미지 파이프라인 및 조회 시스템의 **최신 아키텍처(Photographer/GSI2/RDB 통합 버전)**를 정의합니다.

- 업로드 → 전처리 → Rekognition → DynamoDB 인덱싱까지의 전체 흐름
- RDB(PostgreSQL)와 DynamoDB의 역할 분리
- Photographer / 사진-only 이벤트 지원

---

## 1. 하이레벨 개요

SnapRace는 러닝/레이스 이벤트의 사진을

- **bib 번호로 검색**
- **Selfie(얼굴)로 검색**
- **Photographer별 갤러리**

처럼 다양한 방식으로 찾을 수 있게 하는 서비스입니다.

이를 위해 백엔드는 다음 두 계층으로 구성됩니다.

1. **Truth Layer (RDB / PostgreSQL)**
   - organizers, events, event_runners
   - photographers, event_photographers

2. **Read-Optimized Layer (DynamoDB PhotoService)**
   - PHOTO: 사진 1장당 1레코드
   - BIB_INDEX: bib별 인덱스
   - GSI1: bib → 사진들
   - GSI2: photographer → 사진들

이미지 처리 파이프라인은 **S3 + SQS + Lambda + Step Functions + Rekognition + DynamoDB**로 구성됩니다.

---

## 2. 전체 아키텍처 다이어그램

```mermaid
flowchart LR
    subgraph Client
      Uploader["Photographer / Admin<br/>S3 Direct Upload"]
      Viewer["Web Client / Gallery"]
    end

    subgraph Storage
      S3[("S3 Bucket\n snaprace-images-{stage}")]
      RDB[("PostgreSQL / Supabase\n organizers / events / photographers / event_runners")]
      DDB[("DynamoDB\n PhotoService-{stage}")]
    end

    subgraph Processing
      SQS["SQS Queue\n ImageUpload"]
      L0["Lambda\n SFN Trigger"]
      SFN["Step Functions\n ImageProcessingWorkflow"]
      L1["Lambda\n Preprocess"]
      L2a["Lambda\n DetectText"]
      L2b["Lambda\n IndexFaces"]
      L3["Lambda\n Fanout DynamoDB"]
      Rek["Rekognition\n DetectText / IndexFaces / Collection"]
    end

    subgraph API
      Api["API Gateway + Lambda/Next.js API"]
    end

    Uploader -->|direct upload\n(+ S3 metadata: photographer-id)| S3
    S3 -->|ObjectCreated| SQS
    SQS --> L0 --> SFN

    SFN --> L1 --> L2a & L2b --> L3
    L2a --> Rek
    L2b --> Rek
    L3 --> DDB
    L3 -.-> RDB

    Viewer --> Api --> DDB
    Api --> RDB
```

---

## 3. 스토리지 레이어

### 3.1 S3 버킷 구조

- 버킷명: `snaprace-images-{stage}`

```text
s3://snaprace-images-{stage}/
└── {organizerId}/
    └── {eventId}/
        ├── raw/
        │   └── {originalFilename}
        └── processed/
            └── {ulid}.jpg
```

#### 예시

```text
s3://snaprace-images-prod/
└── snaprace-kr/
    └── seoul-marathon-2024/
        ├── raw/DSC_1234.jpg
        └── processed/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg
```

#### S3 업로드 메타데이터

Photographer가 있는 경우, 업로드 시 메타데이터에 photographer 정보를 포함합니다.

```text
x-amz-meta-photographer-id: ph_01ABCXYZ
x-amz-meta-source: photographer-upload
```

### 3.2 RDB (Truth Layer)

RDB 스키마는 `RDB_SCHEMA.md`에 상세 정의되어 있으며, 핵심 테이블은:

- `organizers` – 주최사 정보
- `events` – 이벤트 정보 (`display_mode`, `results_integration`, `photos_meta` 포함)
- `event_runners` – bib/결과 정보
- `photographers` – 포토그래퍼 프로필
- `event_photographers` – 이벤트↔포토그래퍼 N:N 관계

RDB는 **관리, 설정, 정산, 권한, 메타데이터**의 source-of-truth 입니다.

### 3.3 DynamoDB (PhotoService)

DynamoDB 테이블은 `DYNAMODB_SCHEMA.md`에 상세 정의되어 있으며, 핵심 개념은:

- 단일 테이블: `PhotoService-{stage}`
- 엔티티 유형:
  - `PHOTO` – 사진 한 장에 대한 메타데이터 및 분석 결과
  - `BIB_INDEX` – bib별 인덱스 (경량)
- GSI:
  - GSI1 – bib → 사진 리스트
  - GSI2 – photographer → 사진 리스트

DynamoDB는 **갤러리/검색/뛰어난 조회 성능**을 위해 사용합니다.

---

## 4. 이벤트 처리 파이프라인 (업로드 → 인덱싱)

### 4.1 S3 Event → SQS

- 버킷에 `ObjectCreated` 이벤트 발생 시, SQS `ImageUpload` 큐에 메시지 전송
- JPEG/PNG/HEIC 등의 이미지 확장자로 필터링

```ts
['.jpg', '.jpeg', '.png', '.heic'].forEach((suffix) => {
  bucket.addEventNotification(
    s3.EventType.OBJECT_CREATED,
    new s3n.SqsDestination(imageUploadQueue),
    {
      prefix: '', // 또는 특정 organizer/event prefix
      suffix,
    },
  );
});
```

SQS 메시지는 S3 오브젝트 key, 버킷 이름, 사이즈 등을 포함합니다.

### 4.2 SFN Trigger Lambda (SQS → Step Functions)

- SQS를 폴링하며 메시지를 batch로 읽음
- 각 레코드에 대해 S3 object key를 파싱하여 `{orgId, eventId, rawKey}` 추출
- S3 HeadObject를 통해 `photographer-id` 등 메타데이터를 읽어 workflow input에 포함

```jsonc
{
  "orgId": "snaprace-kr",
  "eventId": "seoul-marathon-2024",
  "bucketName": "snaprace-images-prod",
  "rawKey": "snaprace-kr/seoul-marathon-2024/raw/DSC_1234.jpg",
  "photographerId": "ph_01ABCXYZ" // 없을 수 있음
}
```

### 4.3 Step Functions Workflow

자세한 상태 정의는 `STEP_FUNCTIONS_WORKFLOW.md` 참고.

기본 흐름:

1. **Preprocess (Lambda)**
   - S3 raw 이미지를 다운로드
   - 리사이즈/압축 (Sharp)
   - processed 경로에 업로드 (`processed/{ulid}.jpg`)
   - S3 metadata 복사 및 일부 정규화
   - 결과로 `processedKey`, `s3Uri`, `dimensions`, `photographerId` 등을 반환

2. **Parallel Analyze (DetectText / IndexFaces)**
   - DetectText Lambda: Rekognition DetectText 호출 → bib 후보 추출
   - IndexFaces Lambda: Rekognition IndexFaces 호출 → 컬렉션에 얼굴 인덱싱
     - Collection ID: `{orgId}-{eventId}` 규칙 사용
     - 없으면 CreateCollection → 멱등성 처리

3. **Fanout DynamoDB (Lambda)**
   - Preprocess + DetectText + IndexFaces 결과를 종합
   - bib 목록, faceId, S3 위치, photographerId 등을 기반으로
     - PHOTO 1개
     - BIB_INDEX (bib 개수만큼)
   - DynamoDB `PhotoService-{stage}`에 저장
   - 필요 시 RDB `photographers`에서 handle/displayName을 읽어 denormalize

---

## 5. Photographer 연동 설계

### 5.1 Truth: RDB

- `photographers`: 프로필, 인스타 핸들, 웹사이트 등
- `event_photographers`: 어떤 이벤트에 어떤 photographer가 참여하는지

Admin / Backoffice에서는:
- 이벤트 설정화면에서 event_photographers를 관리
- 업로드 UI에서는 **해당 이벤트에 등록된 photographer만 선택 가능**하게 구현

### 5.2 Data Flow: S3 → SFN → Dynamo

1. **Uploader**
   - FE/Admin에서 이벤트를 선택하면, RDB `event_photographers`를 조회해 dropdown 제공
   - 사용자가 선택한 `photographer_id`를 S3 업로드 메타데이터로 포함

2. **Preprocess Lambda**
   - S3 HeadObject로 `photographer-id` 읽음
   - state machine input / preprocess output에 포함

3. **Fanout DynamoDB Lambda**
   - `photographerId`가 존재한다면:
     - (옵션 A) 바로 RDB `photographers`에서 handle/displayName 조회
     - PHOTO 엔티티에 다음 정보 저장

```jsonc
{
  "photographerId": "ph_01ABCXYZ",
  "photographerHandle": "studio_aaa",
  "photographerDisplayName": "Studio AAA",
  "GSI2PK": "PHOTOGRAPHER#ph_01ABCXYZ",
  "GSI2SK": "EVT#seoul-marathon-2024#TIME#2024-11-09T10:30:00.000Z"
}
```

이렇게 하면 갤러리/검색 API는 **DynamoDB에서 PHOTO만 조회**해도 insta/이름 정보를 바로 사용할 수 있습니다.

### 5.3 Photographer 프로필 변경 시 동기화

Photographer의 인스타 핸들이나 표시 이름이 바뀌면:

1. Admin이 RDB `photographers` 테이블을 수정
2. API 서버가 `PHOTOGRAPHER_UPDATED` 메시지를 큐/토픽에 발행
3. Sync Worker가 GSI2로 해당 photographerId의 PHOTO 아이템들을 조회
4. `UpdateItem`으로 `photographerHandle`, `photographerDisplayName`을 일괄 갱신

이 시나리오는 `RDB = Truth`, `Dynamo = Cache/Index` 구조를 반영합니다.

---

## 6. 조회 경로 (Gallery / Search API)

### 6.1 이벤트 전체 사진 (Event Gallery)

- 요청: `GET /events/{eventId}/photos`
- 동작:
  - PK = `ORG#{orgId}#EVT#{eventId}`
  - `begins_with(SK, 'PHOTO#')`로 PHOTO만 조회

```ts
await docClient.query({
  TableName: 'PhotoService-prod',
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: {
    ':pk': 'ORG#snaprace-kr#EVT#seoul-marathon-2024',
    ':sk': 'PHOTO#',
  },
  ScanIndexForward: false,
});
```

### 6.2 bib 기반 검색

- 요청: `GET /events/{eventId}/photos?bib=1234`
- 동작:
  - GSI1에서 `GSI1PK = EVT#{eventId}#BIB#{bib}`로 BIB_INDEX 조회
  - 필요시 PHOTO를 BatchGet (또는 BIB_INDEX에 최소 메타만 넣고 바로 렌더)

### 6.3 Photographer 기반 검색

- 요청: `GET /events/{eventId}/photos?photographerId=ph_01ABCXYZ`
- 동작:
  - GSI2에서 `GSI2PK = PHOTOGRAPHER#{photographerId}`
  - `begins_with(GSI2SK, 'EVT#{eventId}#')` 조건으로 필터링

갤러리 UI에서는 Photographer 필터, bib 검색, 일반 전체 보기 등의 모드를 조합해서 사용합니다.

---

## 7. IAM 및 보안

### 7.1 Lambda 역할 최소 권한

- Preprocess Lambda
  - `s3:GetObject`, `s3:PutObject`
- DetectText Lambda
  - `rekognition:DetectText`, `s3:GetObject`
- IndexFaces Lambda
  - `rekognition:IndexFaces`, `rekognition:CreateCollection`, `rekognition:DescribeCollection`, `s3:GetObject`
- Fanout DynamoDB Lambda
  - `dynamodb:PutItem` (PhotoService 테이블)
  - (옵션) `rds-data:ExecuteStatement` 또는 Supabase/RDS 조회 권한 (photographers)

### 7.2 S3 접근 통제

- 업로드는 presigned URL 또는 인증된 uploader만 허용
- 공개 이미지는 CloudFront를 통해 서빙, S3는 직접 노출하지 않음

---

## 8. 모니터링 및 알람

- SQS 큐 깊이: 처리 지연/백로그 감시
- Step Functions 실패 횟수: 알람 설정
- Lambda 에러율 / Duration: 병목 및 장애 탐지
- DynamoDB Throttle (RCU/WCU): 인덱스/쿼리 튜닝 지표

예시:

- Step Functions 실패 5회 이상 → 알람
- DLQ 메시지 존재 → 알람

---

## 9. 요약

이 아키텍처는 다음을 만족하도록 설계되었습니다.

- 대규모 이벤트(수만~수십만 장 사진)를 처리 가능한 비동기 파이프라인
- bib / 얼굴 / photographer 기준의 다양한 검색 패턴을 빠르게 처리
- RDB와 DynamoDB의 역할을 명확히 분리하여 관리(Truth)와 조회(Read)를 최적화
- Photographer 기반 사진-only 이벤트까지 유연하게 지원

세부 구현은 각 문서(RDB_SCHEMA.md, DYNAMODB_SCHEMA.md, LAMBDA_FUNCTIONS.md, STEP_FUNCTIONS_WORKFLOW.md, DEPLOYMENT.md)를 참고하여 진행합니다.

