# SnapRace 이미지 프로세싱 엔진(`image-rekognition`) 발표자료 초안 (기술 중심 / Notion용)

## 이 문서의 목적

- **대상**: SnapRace에서 사용한 기술을 잘 모르는 개발자(서버리스/AWS 경험이 적어도 이해 가능)
- **목표**: “왜 이런 아키텍처를 택했고, 코드에서 어떻게 구현했는지”를 **기술 선택의 이유/장단점**까지 포함해 설명
- **범위**: `packages/image-rekognition`(처리/인덱싱) + `packages/image-transform`(서빙/동적 변환) + 이를 소비하는 `apps/web` 연동 포인트

---

## 권장 발표 목차(슬라이드 흐름)

- **1. 문제 정의 & 요구사항**
- **2. 전체 아키텍처 한 장**
- **3. 파이프라인 데이터 플로우(업로드→처리→인덱싱→서빙)**
- **4. AWS CDK(IaC)로 인프라를 어떻게 묶었나**
- **5. Step Functions로 오케스트레이션(병렬/재시도/내결함성)**
- **6. DynamoDB 단일 테이블 설계(검색 패턴을 어떻게 만족?)**
- **7. Rekognition(DetectText/IndexFaces/SearchFacesByImage) 적용 포인트**
- **8. 이미지 전처리(Sharp) + UX 최적화(ThumbHash)**
- **9. Image Transform(동적 이미지 변환 + CloudFront 캐싱)**
- **10. 운영 관점: 비용/성능/모니터링/보안**
- **11. 트레이드오프 & 개선 로드맵**
- **12. 데모 시나리오 & Q&A**

---

## 발표 설정(결정된 조건)

- **발표 시간**: 30~45분(트레이드오프/운영까지 포함)
- **데모**: 웹 UI + AWS 콘솔(S3/SQS/Step Functions/Lambda/DynamoDB/CloudFront)
- **식별 정보(도메인/버킷 등)**: 노출 가능
- **얼굴 인식(셀카 검색)**: **기술 구현만** 다룸(정책/동의/보관기간 등 비기술 이슈는 범위 밖)
- **정량 지표**: **추정치(가정/계산식) 기반**으로 제시

---

## 0) 30~45분 발표 구성(추천 타임라인)

> 아래는 “슬라이드 + 발표자 노트” 기준 타임라인입니다. (데모 포함)

- **0~3분: 문제/목표**
  - 왜 이 파이프라인이 필요한지(업로드 스파이크, 검색 UX, 비용)
- **3~10분: 아키텍처 한 장 + 데이터 플로우**
  - S3→SQS→SFN→DDB, CloudFront + Image Transform 분리
- **10~20분: 파이프라인 구현 디테일**
  - CDK 구성(리소스 연결, 최소권한)
  - Step Functions(병렬, Retry/Catch, graceful degrade)
- **20~28분: 데이터 모델/조회 성능**
  - 단일 테이블 + GSI 설계, Query/BatchGet 패턴
- **28~35분: 운영/트레이드오프(성능·비용 추정치)**
  - 처리율/지연/비용 구조, 병목(TPS)과 제어 방식
- **35~43분: 데모(웹 UI + AWS 콘솔)**
  - 업로드→실행→저장→조회→서빙/캐시
- **43~45분: Q&A**

---

## 1) 문제 정의 & 요구사항

### 문제: “사진이 많아질수록 검색이 더 어려워진다”

- 대회 사진은 **수천~수십만 장** 규모로 늘어날 수 있음
- 사용자는 다음 방식으로 사진을 찾고 싶어함
  - **BIB(배번) 기반 검색**
  - **Selfie(얼굴) 기반 검색**
  - **Photographer(촬영자)별 갤러리**
  - **이벤트 전체 갤러리**
- 사진 업로드 직후 **자동으로 분석/인덱싱**되어야 UX가 좋아짐

### 시스템 요구사항(기술 선택에 영향을 준 제약)

- **비동기/내결함성**: 업로드는 순간적으로 몰릴 수 있고, 일부 사진 처리가 실패해도 전체 시스템은 계속 동작해야 함
- **확장성**: 대회별 트래픽 편차가 크므로, “평소엔 저렴하고 필요할 때만 자동 확장”이 유리
- **검색 성능**: 갤러리/검색 API는 **Scan이 아니라 Query 중심**으로 빠르게 응답해야 함
- **비용 최적화**: 이미지 저장/서빙/변환/분석 비용을 구조적으로 줄여야 함

---

## 2) 전체 아키텍처(한 장 설명)

### 한 문장 요약

- `image-rekognition`은 **“업로드된 사진을 분석해 검색 가능한 인덱스(DynamoDB)를 만드는 엔진”**
- `image-transform`은 **“같은 S3 이미지를 화면 크기에 맞게 동적으로 변환(WebP 등)하고 CDN으로 캐싱해 서빙하는 레이어”**

### 아키텍처 개요(핵심 경로)

- **업로드/처리**: S3 → SQS → Lambda(SFN Trigger) → Step Functions(전처리 + 병렬 분석) → DynamoDB(PhotoService)
- **서빙**: CloudFront(커스텀 도메인 `images.snap-race.com`) + `image-transform`(Serverless Image Handler 계열)
- **조회**: `apps/web`(Next.js) → (tRPC/서버) → DynamoDB Query/BatchGet + Selfie Search Lambda Invoke

---

## 3) 데이터 플로우(업로드→처리→인덱싱→서빙)

### 3.1 S3 키 구조(스냅레이스 규칙)

- 버킷: `snaprace-images`
- 키:

```text
{orgId}/{eventId}/raw/{originalFilename}
{orgId}/{eventId}/processed/{ulid}.jpg
```

### 3.2 업로드 직후(이벤트 기반 파이프라인 시작)

- S3 `ObjectCreated` 이벤트 → SQS로 전달
- SQS는 “버퍼/완충재” 역할 (스파이크 트래픽을 흡수하고, 재시도/정리 경로(DLQ)를 제공)

### 3.3 Step Functions 워크플로우(핵심 처리)

- **Preprocess**: 이미지 회전/리사이즈/압축 + ThumbHash 생성 + processed 저장
- **Parallel**:
  - **DetectText**: Rekognition OCR로 bib 후보 추출
  - **IndexFaces**: Rekognition 컬렉션에 얼굴 인덱싱
- **Fanout**: 결과를 모아 DynamoDB에 `PHOTO` + `BIB_INDEX` 저장

### 3.4 서빙(동적 변환 + 캐싱)

- Next.js `next/image`는 커스텀 로더(`apps/web/src/lib/image-loader.ts`)를 통해
  - “원본 키”를
  - `image-transform`가 이해하는 **Base64(JSON) 요청**으로 변환해 호출
  - 반환 이미지는 **WebP + 리사이즈된 결과**이며 CloudFront가 캐싱

---

## 4) AWS CDK (IaC) — 왜/어떻게 썼나

### 개념(초심자용): AWS CDK

- **AWS CDK**는 인프라를 콘솔에서 클릭으로 만들지 않고, 코드(TypeScript 등)로 정의하여 **CloudFormation**으로 배포하는 IaC 도구
- 장점은 “인프라 구성의 재현/리뷰/버전관리/자동화”

### SnapRace에서의 구현 포인트

- `packages/image-rekognition/lib/image-rekognition-stack.ts`가 한 스택에서 다음을 생성/연결
  - S3 버킷(`snaprace-images`)
  - SQS + DLQ
  - Lambda들(전처리/텍스트/얼굴/팬아웃/트리거/셀카검색)
  - Step Functions 상태 머신
  - DynamoDB 테이블(`PhotoService`) + GSI1/GSI2
  - 최소 권한(Least privilege) IAM 정책

### 기술 선택 이유

- **개발 속도**: 로컬에서 TypeScript로 인프라+코드를 같이 다루기 쉬움
- **리뷰/협업**: PR에서 인프라 변경이 코드로 보임
- **반복 배포**: 이벤트별/환경별 확장을 염두에 둔 패턴(추후 stage 분리)과 잘 맞음

### 장단점/주의점(AWS CDK)

- **장점**: 재현성/자동화/모듈화, 실수 감소
- **단점**: CloudFormation 추상화로 인해 “실제 생성 리소스”가 바로 안 보일 수 있음 → `cdk diff`/스택 템플릿 확인 필요
- **주의**: `image-rekognition` 스택은 현재 `RemovalPolicy.DESTROY`가 포함되어 있어, 운영 환경 적용 전 정책 점검이 필요

---

## 5) Step Functions — 왜 오케스트레이션이 필요한가

### 개념(초심자용): Step Functions

- Step Functions는 “여러 작업(Lambda 등)을 **순서/병렬/분기/재시도/실패 처리** 규칙으로 묶어주는 워크플로 엔진”
- 핵심은 “복잡한 처리 흐름을 코드가 아니라 **상태 머신**으로 다루고, 실행 이력을 시각적으로 추적”하는 것

### SnapRace 워크플로우(실제 구성)

- 정의: `ImageProcessingWorkflow`
- 흐름: `Preprocess → Parallel(DetectText, IndexFaces) → MergeResults → FanoutDynamoDB`

### 내결함성 설계(중요)

- **하드 실패(중단)**: 전처리/팬아웃 실패는 데이터 정합성에 영향이 크므로 `Fail`로 종료
- **그레이스풀 디그레이드(계속 진행)**:
  - DetectText가 실패해도 “bibs=[]”로 대체(배번 검색만 불가)
  - IndexFaces가 실패해도 “faceIds=[]”로 대체(Selfie 검색만 불가)
- **스로틀링 대응**: Rekognition 호출은 TPS 제한이 있어 `ThrottlingException` 등에 대해 지터 포함 재시도 전략을 둠

### 장단점(기술 선택 관점)

- **장점**
  - 병렬 실행/재시도/실패 경로가 선언적으로 관리됨(운영 중 디버깅이 쉬움)
  - Lambda 간 “직접 호출 체인” 대비 흐름이 명확하고 변경이 쉬움
- **단점**
  - 상태 전이/실행 로그에 따른 비용이 추가됨
  - 입력/출력 스키마가 커질수록 관리가 어려워짐 → `resultSelector/resultPath`로 축소가 필요

---

## 6) DynamoDB — 검색을 위해 ‘단일 테이블 + GSI’로 설계한 이유

### 개념(초심자용): DynamoDB

- DynamoDB는 “키 기반”으로 매우 빠르게 조회하는 NoSQL
- 관계형 DB처럼 조인/복잡 쿼리가 강점은 아니므로, **처음부터 조회 패턴에 맞춘 키 설계**가 핵심

### SnapRace의 핵심 쿼리 패턴

- 이벤트 전체 갤러리(최신순 페이지네이션)
- BIB로 사진 검색
- Photographer(인스타 핸들)로 사진 검색

### 데이터 모델: `PhotoService` 단일 테이블

- 엔티티 2종
  - `PHOTO`: 사진 1장 메타데이터(키/크기/ThumbHash/분석결과)
  - `BIB_INDEX`: “bib → 사진” 역색인(경량)
- 키 설계
  - Base PK: `ORG#{orgId}#EVT#{eventId}`
  - `PHOTO` SK: `PHOTO#{ulid}`
  - `BIB_INDEX` SK: `BIB#{bib}#PHOTO#{ulid}`
  - GSI1: `EVT#{eventId}#BIB#{bib}` → 해당 bib의 사진 목록
  - GSI2: `PHOTOGRAPHER#{instagramHandle}` → 촬영자별 사진 목록

### 쓰기 패턴(팬아웃)

- 사진 1장 처리 결과로
  - `PHOTO` 1개
  - bib 개수만큼 `BIB_INDEX` N개
- `BatchWriteItem` 단위(최대 25개)를 맞추고, `UnprocessedItems`는 재시도(백오프)

### 장단점/주의점(DynamoDB)

- **장점**
  - 조회가 대부분 `Query`로 끝남(Scan 회피)
  - 이벤트 트래픽이 커도 서버 관리 없이 확장
- **단점**
  - 스키마가 “조회 패턴에 강하게 결합” → 새로운 검색 요구가 생기면 인덱스 추가/백필이 필요
- **주의**
  - GSI 설계가 잘못되면 쓰기 비용/백필 시간이 커질 수 있음
  - `BatchGet`은 순서를 보장하지 않으므로(코드에서 재정렬 필요) `BIB_INDEX`로 얻은 ulid 순서를 다시 맞추는 로직이 필요

---

## 7) Rekognition — 어떤 API를 어떻게 썼나

### 개념(초심자용): Amazon Rekognition

- Rekognition은 AWS가 제공하는 “관리형 이미지 분석(ML) API”
- 모델 학습/서빙을 직접 하지 않고, API 호출로 기능을 사용(대신 호출 비용/쿼터/정확도 트레이드오프 존재)

### SnapRace 사용 API

- **DetectText**: 배번(OCR) 추출
- **IndexFaces**: 이벤트별 컬렉션에 얼굴 임베딩 저장
- **SearchFacesByImage**: 셀카 업로드 → 매칭되는 얼굴이 있는 사진 찾기

### 구현 포인트(코드 기준)

- BIB 추출 규칙(`packages/image-rekognition/lambda/detect-text/bib-detector.ts`)
  - 패턴: `3~6자리 숫자`, 필요시 `A1234` 같은 접두사 패턴도 지원
  - 최소 신뢰도: `90%`
  - 제외: `0000` 등 오탐 가능성이 큰 값
- 얼굴 컬렉션
  - CollectionId: `{orgId}-{eventId}`
  - 컬렉션 없으면 IndexFaces 실패 → 그때만 CreateCollection 후 재시도(Optimistic)

### 장단점

- **장점**
  - ML 인프라/모델 운영 없이 빠르게 기능 구현
  - 이벤트/트래픽 증가에 대응하기 쉬움
- **단점**
  - OCR/얼굴 인식은 “조명/각도/화질/가림”에 의해 정확도가 흔들림
  - 쿼터(특히 TPS)와 비용이 구조적인 제약 → SQS/StepFunctions 재시도/동시성 제어가 필수
  - 얼굴 인식은 기술적으로도 **오탐/미탐**, **유사도 임계치 튜닝**, **컬렉션 관리(이벤트 단위)** 같은 운영 난이도가 존재
  - (정책/동의/보관기간 등 비기술 이슈는 본 발표 범위 밖)

---

## 8) 이미지 전처리(Sharp) + UX 최적화(ThumbHash)

### 왜 전처리가 필요했나

- 업로드 원본은 해상도/포맷/회전(EXIF)/용량이 제각각 → 분석(Rekognition)과 서빙에 불리
- “분석용 + 서빙용”으로 **일관된 processed 버전**을 만들어 두면 이후 단계가 단순해짐

### Preprocess Lambda 구현 요약

- 입력: `rawKey`(S3) + 메타(예: `instagram-handle`)
- 처리:
  - `sharp(...).rotate()`로 EXIF 기반 자동 회전
  - 본 이미지: `width=2048`, `jpeg quality=90`, `mozjpeg=true`, `fit=inside`
  - **ThumbHash 생성**: 100×100으로 축소 후 RGBA → ThumbHash → base64
  - S3 업로드 시 태그/메타데이터 저장(`folder=processed`, `thumb-hash`, `original-key`, `ulid`)
- 출력: `processedKey`, `dimensions`, `thumbHash`, `ulid` 등

### ThumbHash를 쓰는 이유(프론트 UX)

- `apps/web/src/utils/thumbhash.ts`에서 `thumbHashToDataURL`로 blur placeholder를 만들어
  - **갤러리 스크롤 시 로딩 체감 감소**
  - 네트워크가 느린 모바일에서 UX 개선

---

## 9) Image Transform — “동적 변환 + CDN 캐싱”으로 서빙 비용/속도 최적화

### 무엇인가(프로젝트 기준)

- `packages/image-transform`는 AWS Solutions의 **Dynamic Image Transformation for Amazon CloudFront**(Serverless Image Handler 계열)을 포함
- 핵심 아이디어:
  - 원본 이미지는 S3에 1개만 저장
  - 요청 시점에 Lambda(Sharp)로 필요한 크기/포맷(WebP 등)으로 변환
  - CloudFront가 변환 결과를 캐싱해서 다음 요청은 빠르고 저렴

### SnapRace에서의 실제 사용 방식

- Next.js `next/image` 커스텀 로더(`apps/web/src/lib/image-loader.ts`)
  - `src`(S3 key)를 “Base64(JSON)” 요청으로 바꿔서 Image Handler로 호출
  - 예: `toFormat=webp`, `resize.width=요청 width`, `quality=75`
- SEO 이미지(OG/Twitter 카드)도 같은 방식으로 변환 URL을 만들어 사용
  - `apps/web/src/server/utils/metadata.ts`

### 장단점(선택 이유)

- **장점**
  - 디바이스/뷰포트별 최적 사이즈(WebP)로 내려서 **대역폭 절감**
  - 썸네일/다중 사이즈를 미리 만들어 저장하지 않아도 됨(스토리지 절감, 운영 단순화)
  - CloudFront 캐시 히트가 올라가면 지연/비용이 급격히 좋아짐
- **단점**
  - 최초 요청은 “변환 비용 + 지연”이 발생(캐시 미스 페널티)
  - 변환 파라미터를 외부 입력으로 받는 구조라면 **요청 검증/제한**이 중요(DoS/비용 폭증 방지)

---

## 10) 운영 관점 체크리스트(비용/성능/모니터링/보안)

### 비용 최적화 포인트(코드에 반영된 것)

- S3 Lifecycle + 태그 기반 전환
  - `raw`: `folder=raw` 태그를 보장하고, 비용이 낮은 스토리지 클래스로 빠르게 전환
  - `processed`: `folder=processed` 태그로 Intelligent-Tiering 적용
- Step Functions 로그 비용 절감
  - 로그 레벨을 `ERROR`, 실행 데이터 미포함으로 설정

### 성능/안정성 포인트

- Rekognition TPS 제약을 고려해 **SQS 이벤트 소스 `maxConcurrency`로 전체 처리율을 제어**
- DetectText/IndexFaces는 실패 시 Fallback으로 “부분 기능 저하”를 선택

### 추정 성능 지표(가정 기반)

> **주의**: 아래 수치는 “코드에 포함된 동시성/타임아웃 설정 + 일반적인 처리 특성”을 바탕으로 한 **추정치**입니다. 실제 값은 이미지 해상도/대회 환경/캐시 히트율에 따라 달라집니다.

- **파이프라인 병목 가정**
  - Rekognition **DetectText TPS가 병목**(코드 코멘트에도 “DetectText 5 TPS”를 기준으로 설명)
  - Trigger Lambda는 SQS 이벤트 소스에서 `maxConcurrency=10`으로 Step Functions 실행을 시작(전체 동시 처리량을 상한으로 제어)
- **처리율(throughput) 추정**
  - 사진 1장 end-to-end 처리 시간이 **3~5초**라고 가정하면
  - 동시 10개 처리 시 평균 완료율은 대략 **초당 2~3장(분당 120~180장)** 수준
  - 단, DetectText TPS(예: 5 TPS)나 IndexFaces TPS, SQS 백로그, 재시도에 의해 하향될 수 있음
- **지연(latency) 추정(사진 1장 기준)**
  - Preprocess(Sharp) + Rekognition 2종 + DynamoDB fanout 합산으로 **수 초 단위**가 일반적
  - “업로드 직후 갤러리에 보이는 시간”은 SQS 백로그/캐시/프론트 polling 전략에 따라 변동

### 추정 비용 구조(계산식 중심)

> 비용은 AWS 가격이 변할 수 있으므로, 발표에서는 “**구성 요소별 과금 단위 + 계산식 + 예시**”로 설명하는 게 안전합니다.

- **Rekognition**
  - 사진 1장당: `DetectText 1회 + IndexFaces 1회` (Selfie 검색은 사용자 행동 기반으로 별도)
  - 월 비용(추정) = 월 처리 사진 수 × (DetectText 단가 + IndexFaces 단가)
  - 참고: [Amazon Rekognition Pricing](https://aws.amazon.com/rekognition/pricing/)
- **Lambda**
  - 호출 수: (전처리 1 + 텍스트 1 + 얼굴 1 + fanout 1) × 사진 수 + (trigger는 SQS 메시지 수)
  - 비용(추정) = Σ(함수별 호출 수 × 평균 실행시간 × 메모리) + 요청 수
  - 참고: [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- **Step Functions(Standard)**
  - 사진 1장당 전이 수는 대략 다음 수준(정상 경로 기준):
    - Preprocess(Task) → Parallel(내부에 2 Task) → Merge(Pass) → Fanout(Task) → 종료
  - 월 비용(추정) = 월 실행 수 × (사진당 상태 전이 수) × (전이 단가)
  - 참고: [AWS Step Functions Pricing](https://aws.amazon.com/step-functions/pricing/)
- **DynamoDB(On-Demand)**
  - 사진 1장당 쓰기: `PHOTO 1` + `BIB_INDEX = bib 개수`
  - 월 쓰기 요청(추정) = 사진 수 × (1 + 평균 bib 개수)
  - 참고: [Amazon DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- **S3**
  - 저장은 `raw`와 `processed`가 분리되며, 수명주기 전환으로 비용 최적화
  - 참고: [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)
- **CloudFront / Image Transform**
  - 캐시 미스 시 변환(Lambda/Sharp) 비용이 들고, 캐시 히트가 높아질수록 CloudFront 전송비/요청비 중심으로 이동
  - 참고: [Amazon CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
  - 솔루션 문서: [Dynamic Image Transformation for Amazon CloudFront](https://aws.amazon.com/solutions/implementations/dynamic-image-transformation-for-amazon-cloudfront/)

### 모니터링/알람(운영 필수)

- **SQS**
  - `ApproximateNumberOfMessagesVisible` 상승: 처리 지연(백로그) 신호
  - DLQ 메시지 > 0: 파이프라인이 “지속 실패” 중임을 의미
- **Step Functions**
  - `ExecutionsFailed` / `ExecutionsTimedOut` 알람
  - 특정 State(DetectText/IndexFaces) 재시도 급증은 Rekognition 쿼터/서비스 이슈 신호
- **Lambda**
  - ErrorRate, Duration p95, Throttle
  - 전처리(Sharp) Duration 증가: 입력 이미지 크기/포맷 변화 또는 런타임 이슈
- **DynamoDB**
  - On-demand라도 Throttling/Hot partition 징후 체크(특정 이벤트가 과도한 트래픽일 때)

### 보안(기술 관점)

- S3는 퍼블릭 차단 + CloudFront(OAC)로만 접근(버킷 직접 공개 금지)
- 업로드 CORS/AllowedOrigin은 운영에서 제한하는 것이 안전(현재 스택에 TODO 존재)
- 최소 권한 원칙: 각 Lambda에 필요한 `s3:*`, `rekognition:*`, `dynamodb:*`, `states:StartExecution`만 부여
- (얼굴 검색/컬렉션은 민감 기능이므로) 호출 경로/API 인증/로그 마스킹 등은 운영에서 강화 권장(정책 이슈는 범위 밖)

---

## 11) 트레이드오프 & 개선 로드맵(발표에서 “성숙도”를 보여주는 파트)

### 현재 설계의 트레이드오프

- Step Functions를 “사진 1장당 1 실행”으로 두면 단순하지만, 실행 수가 많아지면 비용/모니터링 부담 증가
- S3 이벤트가 prefix 필터링이 어려워(키가 `{org}/{event}/raw/...`) processed 업로드도 SQS로 들어올 수 있음 → Trigger에서 필터링(낭비 vs 단순함)
- 인프라가 현재 “고정 이름/RemovalPolicy.DESTROY” 등 운영 친화적이지 않은 값이 섞여 있음(스테이징/운영 분리 필요)
- Rekognition 쿼터(TPS)가 병목이 되기 쉬움 → “동시성 상한”과 “재시도 전략”이 곧 처리율/비용을 결정
- Image Transform은 캐시 히트가 낮은 구간(초기/특정 이벤트 직후)에 비용/지연이 커질 수 있음 → 캐시 전략이 중요

### 추천 개선(우선순위 아이디어)

- **환경 분리(dev/prod)**: 버킷/테이블 이름, 제거 정책, 로그 보존, 알람을 환경별로 분리
- **CloudFront 배포 ID 하드코딩 제거**: OAC/SourceArn을 파이프라인에서 자동 주입하도록 개선
- **재처리(리프로세싱) UX/툴**: 특정 이벤트/특정 사진만 다시 Step Functions를 돌리는 운영 도구
- **정확도 튜닝**: 이벤트별 배번 규칙(BIB_PATTERNS), 임계치(MIN_CONFIDENCE, FaceMatchThreshold) 운영 설정화
- **멱등성/중복 처리 강화**: S3/SQS는 at-least-once 특성이 있으므로(중복 메시지 가능) “이미 처리된 rawKey”를 조건부로 스킵하는 설계 보강(예: DynamoDB ConditionExpression/처리상태)
- **대규모 백로그 대응**: 이벤트 단위로 처리 우선순위(우선 처리 큐) 또는 “재처리 전용 큐” 분리
- **Image Transform 운영 가이드 확정**: 캐시 키/TTL, 허용 변환 파라미터 whitelist, 요청 크기 제한, WAF 적용 등

---

## 12) 데모 시나리오(노션 발표에서 바로 쓰기 좋게)

> 목표: “웹에서 일어나는 일”과 “AWS에서 실제로 무엇이 실행되는지”를 1:1로 연결해서 보여주기

### 데모 0: 사전 준비(1분)

- 이벤트/조직 ID 확인(예: `snaprace-kr`, `seoul-marathon-2024`)
- S3 버킷: `snaprace-images`
- CloudFront 도메인: `images.snap-race.com`

### 데모 1: 업로드→처리(웹 UI + 콘솔)

- **웹 UI**
  - 업로더(또는 관리자)에서 사진 업로드(경로: `{orgId}/{eventId}/raw/...`)
- **AWS 콘솔**
  - S3: 업로드된 객체의 **Key/Metadata/Tag** 확인
    - raw는 Trigger Lambda에서 `folder=raw` 태그 보정
  - SQS: `ImageUploadQueue`에서 메시지 유입 확인(큐 depth 변화)
  - Step Functions: `ImageProcessingWorkflow` 실행 생성 확인
    - Graph에서 Preprocess → Parallel(DetectText/IndexFaces) → Fanout 흐름 시각화
  - CloudWatch Logs:
    - Preprocess 로그(ulid, resized size, width/height)
    - DetectText/IndexFaces 에러/재시도(Throttling 시나리오를 언급)
  - DynamoDB: `PhotoService`에서
    - `PHOTO#ulid` 아이템 1개 생성 확인
    - bib가 있다면 `BIB_INDEX` 아이템 N개 생성 확인

### 데모 2: 갤러리 UX(ThumbHash 확인)

- **웹 UI**
  - 이벤트 갤러리 접속 → 스크롤하며 blur placeholder(ThumbHash) 체감 보여주기
- **AWS 콘솔**
  - DynamoDB `PHOTO`에 `thumbHash`가 저장된 것을 확인
  - (옵션) Next.js 네트워크 탭에서 이미지 요청 패턴 확인

### 데모 3: Selfie 검색(기술 데모)

- **웹 UI**
  - 셀카 업로드 → 결과 사진 리스트 렌더
- **AWS 콘솔**
  - (가능하면) SearchBySelfie Lambda 로그에서
    - Rekognition SearchFacesByImage 호출
    - DynamoDB GSI1(Query) + BatchGet 흐름 확인
  - 결과에 `similarity`로 정렬되는 것을 보여주기

### 데모 4: Image Transform(동적 변환 + 캐시)

- **웹 UI**
  - 같은 사진을 다른 viewport(모바일/데스크톱)에서 열어 “요청 width가 달라지는 상황”을 연출
  - 네트워크 탭에서 `NEXT_PUBLIC_IMAGE_HANDLER_URL/{base64}` 형태 요청 확인
- **AWS 콘솔**
  - CloudFront: 캐시 히트/미스(가능하면 Metrics) 확인
  - (옵션) Image handler Lambda 로그/지표로 “캐시 미스 시 변환 비용”을 설명

---

## 13) 코드/문서 레퍼런스(발표 준비용)

- **CDK 스택**: `packages/image-rekognition/lib/image-rekognition-stack.ts`
- **워크플로 문서**: `packages/image-rekognition/docs/STEP_FUNCTIONS_WORKFLOW.md`
- **DynamoDB 설계**: `packages/image-rekognition/docs/DYNAMODB_SCHEMA.md`
- **Lambda 구현**
  - 전처리: `packages/image-rekognition/lambda/preprocess/index.ts`
  - 배번 추출: `packages/image-rekognition/lambda/detect-text/index.ts`
  - 배번 규칙: `packages/image-rekognition/lambda/detect-text/bib-detector.ts`
  - 얼굴 인덱싱: `packages/image-rekognition/lambda/index-faces/index.ts`
  - DynamoDB 팬아웃: `packages/image-rekognition/lambda/fanout-dynamodb/index.ts`
  - 트리거: `packages/image-rekognition/lambda/sfn-trigger/index.ts`
  - 셀카 검색: `packages/image-rekognition/lambda/search-by-selfie/index.ts`
- **프론트 연동**
  - 이미지 로더: `apps/web/src/lib/image-loader.ts`
  - ThumbHash 디코더: `apps/web/src/utils/thumbhash.ts`
  - Photo URL 유틸: `apps/web/src/utils/photo.ts`

---

### 참고(공식/신뢰할 만한 문서 링크)

- [AWS CDK v2 Developer Guide](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS Step Functions Developer Guide](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html)
- [Amazon DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [Amazon Rekognition Developer Guide](https://docs.aws.amazon.com/rekognition/latest/dg/what-is.html)
- [Dynamic Image Transformation for Amazon CloudFront (AWS Solutions)](https://aws.amazon.com/solutions/implementations/dynamic-image-transformation-for-amazon-cloudfront/)
- [AWS Step Functions Pricing](https://aws.amazon.com/step-functions/pricing/)
- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [Amazon Rekognition Pricing](https://aws.amazon.com/rekognition/pricing/)
- [Amazon DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [Amazon CloudFront Pricing](https://aws.amazon.com/cloudfront/pricing/)
