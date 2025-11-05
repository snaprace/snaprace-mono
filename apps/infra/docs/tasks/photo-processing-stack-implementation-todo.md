# 📸 Photo Processing Stack 구현 TODO

> **작성일**: 2025-11-05  
> **목표**: Phase별 상세 구현 체크리스트  
> **참고 문서**: [photo-processing-stack-implementation-plan.md](../docs/photo-processing-stack-implementation-plan.md)

---

## 📋 전체 진행 현황

### ✅ 완료된 항목

- [x] S3 Bucket 생성 (`snaprace`)
- [x] DynamoDB 테이블 생성 (EventPhotos, PhotoBibIndex, RunnersV2)
- [x] 설계 문서 작성 및 최종 확정
- [x] **Common Layer 구현** (1.1-1.5 완료) ✅
  - [x] 1.1 타입 정의 (`types.ts`)
  - [x] 1.2 DynamoDB Helper (`dynamodb-helper.ts`)
  - [x] 1.3 Rekognition Helper (`rekognition-helper.ts`)
  - [x] 1.4 Bib Extractor (`bib-extractor.ts`)
  - [x] 1.5 환경 변수 Validator (`env-validator.ts`)

### ✅ 완료

- [x] **Phase 1: 핵심 워크플로우 완료** (Week 1-2) 🎉🎉🎉
  - [x] **Week 1 Part 1: Common Layer** (1.1-1.6) ✅
  - [x] **Week 1 Part 2: Starter Lambda** (2.1-2.7) ✅
  - [x] **Week 1 Part 3: Detect Text Lambda** (3.1-3.9) ✅
  - [x] **Week 1 Part 4: Index Faces Lambda** (4.1-4.9) ✅
  - [x] **Week 2 Part 1: DB Update Lambda** (5.1-5.7) ✅
  - [x] **Week 2 Part 2: Step Functions State Machine** (6.1-6.6) ✅
  - [x] **Week 2 Part 3: S3 Event Notification** (7.1-7.2) ✅
- [x] **Phase 2: 검색 API 구현 완료** (Week 3) 🎉🎉
  - [x] **API Gateway 설정** (1.1-1.3) ✅
  - [x] **Search by Bib Lambda** (2.1-2.6) ✅
  - [x] **Search by Selfie Lambda** (3.1-3.6) ✅

### ⏭️ 예정

- [ ] Phase 3: CDK 배포 및 E2E 테스트 (Week 4)

---

## 🎯 Phase 1: 핵심 워크플로우 (Week 1-2)

### Week 1: Common Layer & Starter & Detect Text Lambda

#### 1️⃣ Common Layer 정리 (`lambda/common-layer/`)

**목표**: 모든 Lambda에서 공유할 공통 로직 구성

- [x] **1.1 타입 정의 (`shared/types.ts`)** ✅
  - [x] `StepFunctionInput` 타입 정의
    ```typescript
    export interface StepFunctionInput {
      bucket: string;
      objectKey: string;
      organizer: string;
      eventId: string;
      uploadTimestamp: number;
      imageWidth?: number;
      imageHeight?: number;
    }
    ```
  - [x] `ProcessingStatus` enum 정의
    ```typescript
    export enum ProcessingStatus {
      PENDING = "PENDING",
      TEXT_DETECTED = "TEXT_DETECTED",
      FACES_INDEXED = "FACES_INDEXED",
      COMPLETED = "COMPLETED",
    }
    ```
  - [x] `EventPhoto` 인터페이스 정의
  - [x] `PhotoBibIndex` 인터페이스 정의
  - [x] `Runner` 인터페이스 정의
  - [x] 추가 타입 정의 (`DynamoDBGetItemResponse`, `DynamoDBQueryResponse`, `LambdaResponse`, `PhotoProcessingError`)

- [x] **1.2 DynamoDB Helper (`shared/dynamodb-helper.ts`)** ✅
  - [x] `getEventPhoto()` 함수 구현
    - EventPhotos 테이블에서 사진 조회
    - 에러 처리 (NotFound)
  - [x] `putEventPhoto()` 함수 구현
    - 멱등성 보장 (ConditionExpression)
  - [x] `updateEventPhoto()` 함수 구현
    - ProcessingStatus 업데이트
    - 동적 UpdateExpression 생성
  - [x] `queryPhotoBibIndex()` 함수 구현
    - EventBibKey로 쿼리
  - [x] `getRunner()` 함수 구현
    - Runners 테이블 조회
  - [x] `updateRunnerPhotoKeys()` 함수 구현
    - StringSet ADD 연산
  - [x] 추가 함수 구현
    - `batchPutPhotoBibIndex()` - 배치 인덱싱
    - `checkTableExists()` - 테이블 존재 확인
    - `batchGetEventPhotos()` - 배치 조회
    - Marshall/Unmarshall 헬퍼 함수

- [x] **1.3 Rekognition Helper (`shared/rekognition-helper.ts`)** ✅
  - [x] `detectText()` 래퍼 함수 구현
    - 에러 처리 및 재시도 (지수 백오프)
  - [x] `detectFaces()` 래퍼 함수 구현
  - [x] `indexFaces()` 래퍼 함수 구현
  - [x] `searchFacesByImage()` 래퍼 함수 구현
  - [x] `ensureCollectionExists()` 함수 구현
    - Collection 존재 확인
    - 없으면 생성
    - 캐싱 처리
  - [x] 추가 유틸리티 함수
    - `isRekognitionRetryableError()` - 재시도 가능 에러 판단
    - `formatRekognitionError()` - 에러 메시지 포맷팅
    - Collection 캐시 관리 함수

- [x] **1.4 Bib Extractor (`shared/bib-extractor.ts`)** ✅
  - [x] 기존 `detect-text/index.ts`에서 함수 추출
  - [x] `extractBibNumbersFromText()` 함수 구현
    - 5단계 필터링: 숫자, 범위, 신뢰도, 워터마크, 크기
    - 설정 가능한 파라미터
  - [x] `isWatermarkArea()` 함수 구현
    - 좌하단/우하단 35% 영역 체크
    - 텍스트 크기 체크
  - [x] `loadValidBibsForEvent()` 함수 구현
    - Runners 테이블 조회
    - 에러 처리 (ResourceNotFoundException)
    - 제로 패딩 처리
  - [x] 추가 유틸리티 함수
    - `filterBibsByValidList()` - 유효한 Bib 필터링
    - `normalizeBibNumber()` - 제로 패딩 제거
    - `padBibNumber()` - 제로 패딩 추가
    - `isValidBibNumber()` - Bib 유효성 검증
    - `findBibMatches()` - 기존 로직 호환 함수

- [x] **1.5 환경 변수 Validator (`shared/env-validator.ts`)** ✅
  - [x] `validateEnv()` 함수 구현 (기존)
    - 필수 환경 변수 체크
    - 타입 검증
  - [x] `getPhotoProcessConfig()` 함수 추가
    - 환경 변수 파싱
    - 기본값 설정
    - PhotoProcessConfig 객체 반환
  - [x] Photo Processing 전용 인터페이스 추가
    - `PhotoProcessEnv` - 환경 변수 인터페이스
    - `PhotoProcessConfig` - 설정 객체 인터페이스
  - [x] 추가 유틸리티 함수
    - `parseBooleanEnv()` - 불리언 파싱
    - `validatePhotoProcessEnv()` - Photo Processing 검증

- [x] **1.6 Common Layer 배포** ✅
  - [x] `package.json` 업데이트
    - 필요한 의존성 추가 (@aws-sdk/client-dynamodb, @aws-sdk/client-rekognition 등)
    - build 스크립트 추가
  - [x] `tsconfig.json` 생성
    - TypeScript 컴파일 설정
  - [x] CDK Stack에 Layer 정의
    - LayerVersion 정의 with bundling
    - commonEnv 환경 변수 객체 정의
    - EventPhotos 테이블 키 수정 (pk/sk → EventKey/S3ObjectKey)

---

#### 2️⃣ Starter Lambda (`lambda/photo-process/starter-lambda/`) ✅

**목표**: S3 이벤트 수신 → EventPhotos 초기화 → Step Functions 실행

- [x] **2.1 프로젝트 구조 생성** ✅
  - [x] `index.ts` 생성
  - [x] `tsconfig.json` 생성 (Common Layer 참조)
  - [x] `package.json` 생성

- [x] **2.2 핵심 로직 구현** ✅
  - [x] S3Event 타입 정의 및 파싱
  - [x] S3 경로 파싱 로직
    - 정규식: `/^([^/]+)\/([^/]+)\/photos\/raw\/(.+)$/`
    - organizer, eventId, filename 추출
    - 유효성 검증
  - [x] URL 디코딩 처리
    - `decodeURIComponent()` 적용
    - `+` → 공백 변환

- [x] **2.3 멱등성 체크** ✅
  - [x] EventPhotos 테이블 조회
    - `getEventPhoto()` 호출
  - [x] ProcessingStatus 확인
    - PENDING이 아니면 스킵
    - 이미 처리 중이면 로그 출력

- [x] **2.4 EventPhotos 초기화** ✅
  - [x] DynamoDB PutItem
    - EventKey, S3ObjectKey 설정
    - UploadTimestamp 기록
    - ProcessingStatus = PENDING
  - [x] ConditionalCheckFailedException 에러 처리
    - Race condition 처리

- [x] **2.5 Step Functions 실행** ✅
  - [x] AWS SDK Step Functions 클라이언트 초기화
  - [x] StartExecution 호출
    - stateMachineArn 환경 변수에서 가져오기
    - input JSON 생성 (StepFunctionInput)
    - executionName 자동 생성
  - [x] 에러 처리
    - ExecutionAlreadyExists 예외 처리

- [x] **2.6 로깅** ✅
  - [x] Lambda Powertools Logger 적용
  - [x] 구조화된 로그 추가
    - 처리 시작
    - S3 경로 파싱 결과
    - Step Functions 실행 ARN
    - 에러 로그

- [x] **2.7 CDK Stack 통합** ✅
  - [x] Lambda Function 정의
  - [x] Common Layer 연결
  - [x] 환경 변수 설정
  - [x] IAM 권한 부여 (S3, DynamoDB)

- [ ] **2.8 단위 테스트 (선택적, 추후 진행)**
  - [ ] S3 경로 파싱 테스트
  - [ ] 멱등성 테스트
  - [ ] 에러 처리 테스트

---

#### 3️⃣ Detect Text Lambda (`lambda/photo-process/detect-text/`) ✅

**목표**: Rekognition DetectText → Bib 추출 → PhotoBibIndex 인덱싱

- [x] **3.1 프로젝트 구조 생성** ✅
  - [x] `index.ts` 생성
  - [x] `tsconfig.json` 생성 (Common Layer 참조)
  - [x] `package.json` 생성

- [x] **3.2 Rekognition DetectText 호출** ✅
  - [x] 입력 검증 (StepFunctionInput)
  - [x] DetectText Helper 호출
  - [x] 응답 파싱 (TextDetections 배열)
  - [x] 이미지 크기 추출 (입력 또는 기본값)

- [x] **3.3 Bib Number 추출 (5단계 필터링)** ✅
  - [x] Common Layer의 `extractBibNumbersFromText()` 사용
  - [x] 1단계: 숫자 필터링 (1-99999 범위)
  - [x] 2단계: 신뢰도 기반 필터링 (90%)
  - [x] 3단계: 워터마크 영역 제외 (하단 35%)
  - [x] 4단계: 크기 기반 필터링 (50px 이상)
  - [x] 5단계: 중복 제거 (Set)

- [x] **3.4 Runners 테이블로 검증 (선택적)** ✅
  - [x] Runners 테이블 설정 확인
  - [x] `loadValidBibsForEvent()` 호출
  - [x] `filterBibsByValidList()` 호출
  - [x] 에러 처리 (Runners 없으면 모든 Bib 사용)

- [x] **3.5 PhotoBibIndex 테이블 인덱싱** ✅
  - [x] `batchPutPhotoBibIndex()` Helper 호출
  - [x] Bib별로 인덱스 레코드 생성
  - [x] BatchWriteItem 실행 (최대 25개 배치)

- [x] **3.6 EventPhotos 테이블 업데이트** ✅
  - [x] `updateEventPhoto()` 호출
  - [x] DetectedBibs, ImageWidth, ImageHeight 저장
  - [x] ProcessingStatus = TEXT_DETECTED

- [x] **3.7 로깅** ✅
  - [x] Lambda Powertools Logger 사용
  - [x] 처리 시작/종료 로그
  - [x] 감지된 Bib 수, 필터링 결과
  - [x] 에러 로그

- [x] **3.8 반환값 구성 및 Idempotency** ✅
  - [x] StepFunctionInput에 detectedBibs, imageWidth, imageHeight 추가
  - [x] Idempotency 체크 (이미 TEXT_DETECTED 상태이면 스킵)
  - [x] 에러 발생 시 상태 유지

- [x] **3.9 CDK Stack 통합** ✅
  - [x] Lambda Function 정의
  - [x] Common Layer 연결
  - [x] 환경 변수 설정
  - [x] IAM 권한 부여 (S3, DynamoDB, Rekognition)

---

### Week 2: Index Faces & DB Update & Step Functions

#### 4️⃣ Index Faces Lambda (`lambda/photo-process/index-faces/`) ✅

**목표**: Rekognition Collection 생성 → IndexFaces → EventPhotos 업데이트

- [x] **4.1 프로젝트 구조 생성** ✅
  - [x] `index.ts` 생성
  - [x] `tsconfig.json` 생성
  - [x] `package.json` 생성

- [x] **4.2 조건부 IndexFaces (최적화)** ✅
  - [x] DetectFaces 사전 확인 (Common Layer Helper 사용)
  - [x] 얼굴 수 체크 (0개면 스킵)
  - [x] 로그 출력 및 조기 반환
  - [x] 얼굴 없을 경우 EventPhotos 업데이트

- [x] **4.3 Rekognition Collection 생성/확인** ✅
  - [x] Collection ID 생성 (prefix-organizer-eventId)
  - [x] `ensureCollectionExists()` Helper 호출
  - [x] 캐싱 처리 (Common Layer에서 구현)
  - [x] 에러 처리

- [x] **4.4 IndexFaces 호출** ✅
  - [x] `indexFaces()` Helper 호출
  - [x] ExternalImageId에 S3 경로 사용
  - [x] MaxFaces, QualityFilter 설정
  - [x] FaceRecords 파싱 (FaceId 배열 추출)
  - [x] UnindexedFaces 로깅 (디버깅용)

- [x] **4.5 그룹 사진 감지** ✅
  - [x] isGroupPhoto 플래그 계산
    - detectedBibs > 1 && faceIds > 1
  - [x] 로그 출력

- [x] **4.6 EventPhotos 테이블 업데이트** ✅
  - [x] `updateEventPhoto()` Helper 호출
  - [x] FaceIds, isGroupPhoto 저장
  - [x] ProcessingStatus = FACES_INDEXED

- [x] **4.7 로깅** ✅
  - [x] Lambda Powertools Logger 사용
  - [x] 처리 시작/종료 로그
  - [x] 감지된 얼굴 수, Collection ID
  - [x] 그룹 사진 여부
  - [x] 에러 로그

- [x] **4.8 반환값 구성 및 Idempotency** ✅
  - [x] StepFunctionInput에 faceIds 추가
  - [x] Idempotency 체크 (FACES_INDEXED 상태면 스킵)
  - [x] 에러 발생 시 이전 상태 유지

- [x] **4.9 CDK Stack 통합** ✅
  - [x] Lambda Function 정의
  - [x] Common Layer 연결
  - [x] 환경 변수 설정
  - [x] IAM 권한 부여 (S3, DynamoDB, Rekognition)

---

#### 5️⃣ DB Update Lambda (`lambda/photo-process/db-update/`) ✅

**목표**: Runners 테이블 PhotoKeys 업데이트 (StringSet ADD)

- [x] **5.1 프로젝트 구조 생성** ✅
  - [x] `index.ts` 생성
  - [x] `tsconfig.json` 생성
  - [x] `package.json` 생성

- [x] **5.2 Runners 테이블 존재 여부 확인** ✅
  - [x] `checkTableExists()` Helper 사용
  - [x] 환경 변수 설정 확인
  - [x] 테이블 없을 경우 SKIPPED 처리
  - [x] 경고 로그 출력

- [x] **5.3 각 Bib Number에 대해 PhotoKeys 업데이트** ✅
  - [x] 루프 처리 (감지된 Bib별로)
  - [x] `updateRunnerPhotoKeys()` Helper 호출 (StringSet ADD)
  - [x] 개별 에러 처리
    - Bib가 Runners에 없어도 계속 진행
    - 경고 로그만 출력
  - [x] 성공/실패한 Bib 목록 수집

- [x] **5.4 EventPhotos 최종 상태 업데이트** ✅
  - [x] ProcessingStatus = COMPLETED
  - [x] 모든 경우에 COMPLETED 처리
    - Runners 업데이트 성공 시
    - Runners 테이블 없을 시
    - Bib 없을 시

- [x] **5.5 로깅** ✅
  - [x] Lambda Powertools Logger 사용
  - [x] 처리 시작/종료 로그
  - [x] 업데이트한 Bib 수
  - [x] 개별 Bib 업데이트 결과
  - [x] 에러 로그

- [x] **5.6 반환값 구성 및 Idempotency** ✅
  - [x] DbUpdateResult 타입 정의
  - [x] updatedBibs, runnersTableStatus 반환
  - [x] Idempotency 체크 (COMPLETED 상태면 스킵)

- [x] **5.7 CDK Stack 통합** ✅
  - [x] Lambda Function 정의
  - [x] Common Layer 연결
  - [x] 환경 변수 설정
  - [x] IAM 권한 부여 (DynamoDB DescribeTable, ReadWrite)

---

#### 6️⃣ Step Functions State Machine (`lib/photo-processing-stack.ts`) ✅

**목표**: Lambda 체인 오케스트레이션

- [x] **6.1 Lambda 함수 정의 (CDK)** ✅
  - [ ] Common Layer 정의
    ```typescript
    const commonLayer = new lambda.LayerVersion(this, "CommonLayer", {
      code: lambda.Code.fromAsset("lambda/common-layer"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    });
    ```
  - [ ] Starter Lambda 정의
    - Runtime, Handler, Code
    - 환경 변수 설정
    - Layer 첨부
    - 메모리: 128MB
    - 타임아웃: 1분
  - [ ] Detect Text Lambda 정의
    - 메모리: 512MB
    - 타임아웃: 2분
  - [ ] Index Faces Lambda 정의
    - 메모리: 512MB
    - 타임아웃: 2분
  - [ ] DB Update Lambda 정의
    - 메모리: 128MB
    - 타임아웃: 1분

- [x] **6.2 IAM 권한 설정** ✅
  - [x] Starter Lambda
    - S3 읽기 권한
    - DynamoDB 읽기/쓰기 (EventPhotos)
    - Step Functions StartExecution
  - [x] Detect Text Lambda
    - Rekognition DetectText
    - DynamoDB 읽기/쓰기 (EventPhotos, PhotoBibIndex, RunnersV2)
  - [x] Index Faces Lambda
    - Rekognition DetectFaces, IndexFaces, DescribeCollection, CreateCollection
    - DynamoDB 읽기/쓰기 (EventPhotos)
  - [x] DB Update Lambda
    - DynamoDB 읽기/쓰기 (RunnersV2)
    - DynamoDB DescribeTable

- [x] **6.3 Step Functions Tasks 정의** ✅
  - [x] Detect Text Task (LambdaInvoke)
  - [x] Index Faces Task (LambdaInvoke)
  - [x] DB Update Task (LambdaInvoke)
  - [x] outputPath: "$.Payload" 설정
  - [x] retryOnServiceExceptions: true

- [x] **6.4 State Machine 정의** ✅
  - [x] Definition 체인 구성 (detectTextTask → indexFacesTask → dbUpdateTask)
  - [x] State Machine 생성
  - [x] Timeout: 5분
  - [x] X-Ray tracing 활성화
  - [x] Starter Lambda에 STATE_MACHINE_ARN 전달

- [x] **6.5 CloudWatch Logs 설정** ✅
  - [x] Log Group 생성 (/aws/stepfunctions/photo-processing)
  - [x] Retention: 1주일
  - [x] State Machine에 로깅 설정
    - LogLevel.ALL
    - includeExecutionData: true

- [x] **6.6 Outputs 추가** ✅
  - [x] StateMachineArn export
  - [x] PhotosBucketName export

---

#### 7️⃣ S3 Event Notification (`lib/photo-processing-stack.ts`) ✅

**목표**: S3 업로드 → Starter Lambda 트리거

- [x] **7.1 S3 Event Notification 설정** ✅
  - [x] EventType: OBJECT_CREATED
  - [x] LambdaDestination으로 Starter Lambda 연결
  - [x] Prefix/Suffix 필터 (Starter Lambda에서 경로 검증)
  - [x] Output 추가 (EventNotificationStatus)

- [x] **7.2 Starter Lambda에 S3 권한** ✅
  - [x] S3 읽기 권한 부여 (이미 설정됨)
  - [x] S3 Event 수신 권한 (자동 부여됨)

---

#### 8️⃣ CDK 배포 및 테스트

**목표**: 전체 워크플로우 E2E 테스트

- [ ] **8.1 환경 변수 설정**
  - [ ] 공통 환경 변수 객체 생성
    ```typescript
    const commonEnv = {
      AWS_REGION: this.region,
      STAGE: "dev",
      LOG_LEVEL: "INFO",
      PHOTOS_BUCKET: photosBucket.bucketName,
      EVENT_PHOTOS_TABLE: eventPhotosTable.tableName,
      PHOTO_BIB_INDEX_TABLE: photoBibIndexTable.tableName,
      RUNNERS_TABLE: runnersTable.tableName,
      REKOGNITION_COLLECTION_PREFIX: "snaprace",
      // ... 필터링 설정 등
    };
    ```
  - [ ] 각 Lambda에 적용

- [ ] **8.2 CDK 빌드**
  - [ ] TypeScript 컴파일
    ```bash
    cd apps/infra
    npm run build
    ```
  - [ ] 에러 수정

- [ ] **8.3 CDK 배포**
  - [ ] Synth 확인
    ```bash
    cdk synth
    ```
  - [ ] Deploy 실행
    ```bash
    cdk deploy
    ```
  - [ ] 배포 확인

- [ ] **8.4 E2E 테스트**
  - [ ] 테스트 이미지 업로드
    ```bash
    aws s3 cp test-image.jpg s3://snaprace/testorg/testevent/photos/raw/test1.jpg
    ```
  - [ ] Step Functions 실행 확인
    - AWS Console → Step Functions
    - 실행 상태 확인
  - [ ] EventPhotos 테이블 확인
    - ProcessingStatus = FACES_INDEXED
    - DetectedBibs 배열
    - FaceIds 배열
  - [ ] PhotoBibIndex 테이블 확인
    - Bib별 레코드 생성 확인
  - [ ] Runners 테이블 확인
    - PhotoKeys StringSet 업데이트 확인
  - [ ] CloudWatch Logs 확인
    - 각 Lambda 로그
    - 에러 없음 확인

- [ ] **8.5 문제 해결**
  - [ ] 로그 분석
  - [ ] 에러 수정
  - [ ] 재배포
  - [ ] 재테스트

---

## 🔍 Phase 2: 검색 API (Week 3) ✅

### 목표

- ✅ API Gateway 구성
- ✅ Bib 검색 Lambda 구현
- ✅ Selfie 검색 Lambda 구현

### TODO

#### 1️⃣ API Gateway 설정 (`lib/photo-processing-stack.ts`) ✅

- [x] **1.1 REST API 생성** ✅
  - [x] RestApi 정의 (SnapRace Photo Search API)
  - [x] Stage: prod, X-Ray tracing 활성화
  - [x] CloudWatch Logs 활성화 (INFO level)

- [x] **1.2 CORS 설정** ✅
  - [x] allowOrigins: localhost:3000, snap-race.com
  - [x] allowMethods: GET, POST, OPTIONS
  - [x] allowHeaders: 표준 헤더 + Authorization
  - [x] allowCredentials: false

- [x] **1.3 리소스 구조 생성** ✅
  - [x] `/search` 리소스
  - [x] `/search/bib` 리소스 (GET)
  - [x] `/search/selfie` 리소스 (POST)

---

#### 2️⃣ Bib 검색 Lambda (`lambda/search-api/search-by-bib/`) ✅

- [x] **2.1 프로젝트 구조 생성** ✅
  - [x] `index.ts` (148줄)
  - [x] `tsconfig.json`
  - [x] `package.json`

- [x] **2.2 입력 검증** ✅
  - [x] Query Parameters 파싱 (organizer, eventId, bibNumber)
  - [x] 환경 변수 검증
  - [x] 필수 파라미터 체크
  - [x] bibNumber 숫자 형식 검증

- [x] **2.3 Runners 테이블 우선 조회 (최적화)** ✅
  - [ ] GetItem 호출
    ```typescript
    const runner = await dynamodb.getItem({
      TableName: process.env.RUNNERS_TABLE!,
      Key: {
        pk: `ORG#${organizer}#EVT#${eventId}`,
        sk: `BIB#${bibNumber}`,
      },
    });
    ```
  - [ ] PhotoKeys 확인
    - 있으면 바로 반환 (빠름)
  - [ ] 에러 처리
    - ResourceNotFoundException → PhotoBibIndex 사용

- [ ] **2.4 PhotoBibIndex 쿼리 (Fallback)**
  - [ ] Query 호출
    ```typescript
    const result = await dynamodb.query({
      TableName: process.env.PHOTO_BIB_INDEX_TABLE!,
      KeyConditionExpression: "EventBibKey = :key",
      ExpressionAttributeValues: {
        ":key": `ORG#${organizer}#EVT#${eventId}#BIB#${bibNumber}`,
      },
    });
    ```
  - [ ] S3ObjectKey 배열 추출

- [ ] **2.5 응답 포맷팅**
  - [ ] 응답 구조
    ```typescript
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        photos: photoKeys,
        total: photoKeys.length,
      }),
    };
    ```
  - [ ] 에러 응답 처리
    - 400: 잘못된 요청
    - 404: 사진 없음
    - 500: 서버 에러

- [ ] **2.6 API Gateway 통합**
  - [ ] Lambda 함수 정의 (CDK)
  - [ ] API Gateway 메서드 연결
    ```typescript
    const searchBibResource = api.root.addResource("search").addResource("bib");
    searchBibResource.addMethod("GET", new apigateway.LambdaIntegration(searchByBibLambda));
    ```
  - [ ] IAM 권한 설정
    - DynamoDB 읽기 (RunnersV2, PhotoBibIndex)

---

#### 3️⃣ Selfie 검색 Lambda (`lambda/search-api/search-by-selfie/`)

- [ ] **3.1 프로젝트 구조 생성**
  - [ ] `index.ts` 생성
  - [ ] `tsconfig.json` 생성
  - [ ] `package.json` 생성

- [ ] **3.2 입력 검증**
  - [ ] Request Body 파싱
    - organizer
    - eventId
    - selfieImage (base64)
  - [ ] 유효성 검증
    - 필수 필드 체크
    - base64 디코딩

- [ ] **3.3 SearchFacesByImage 호출**
  - [ ] Collection ID 생성
    ```typescript
    const collectionId = `${organizer}-${eventId}`;
    ```
  - [ ] API 호출
    ```typescript
    const result = await rekognition.searchFacesByImage({
      CollectionId: collectionId,
      Image: { Bytes: selfieImageBytes },
      MaxFaces: 50,
      FaceMatchThreshold: 90,
    });
    ```
  - [ ] FaceMatches 파싱
    - ExternalImageId 추출 (= S3ObjectKey)
    - Similarity 점수 포함
  - [ ] 에러 처리
    - InvalidParameterException
    - ResourceNotFoundException (Collection 없음)

- [ ] **3.4 Runners 자동 업데이트 (선택적)**
  - [ ] 각 사진의 DetectedBibs 조회
    ```typescript
    for (const photoKey of photoKeys) {
      const photo = await getEventPhoto(organizer, eventId, photoKey);
      photo.DetectedBibs?.forEach((bib) => bibsToUpdate.add(bib));
    }
    ```
  - [ ] Runners.PhotoKeys 업데이트
    ```typescript
    for (const bib of bibsToUpdate) {
      await dynamodb.updateItem({
        TableName: process.env.RUNNERS_TABLE!,
        Key: {
          pk: `ORG#${organizer}#EVT#${eventId}`,
          sk: `BIB#${bib}`,
        },
        UpdateExpression: "ADD PhotoKeys :keys",
        ExpressionAttributeValues: {
          ":keys": dynamodb.createSet(photoKeys),
        },
      });
    }
    ```

- [ ] **3.5 응답 포맷팅**
  - [ ] 응답 구조
    ```typescript
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        photos: photoMatches.map((m) => ({
          objectKey: m.objectKey,
          similarity: m.similarity,
        })),
        total: photoMatches.length,
      }),
    };
    ```
  - [ ] 에러 응답 처리

- [ ] **3.6 API Gateway 통합**
  - [ ] Lambda 함수 정의 (CDK)
  - [ ] API Gateway 메서드 연결
    ```typescript
    const searchSelfieResource = api.root.addResource("search").addResource("selfie");
    searchSelfieResource.addMethod("POST", new apigateway.LambdaIntegration(searchBySelfieLambda));
    ```
  - [ ] IAM 권한 설정
    - Rekognition SearchFacesByImage
    - DynamoDB 읽기/쓰기 (EventPhotos, RunnersV2)

---

#### 4️⃣ API 테스트

- [ ] **4.1 Bib 검색 API 테스트**
  - [ ] Postman/curl로 테스트
    ```bash
    curl "https://api-id.execute-api.region.amazonaws.com/prod/search/bib?organizer=testorg&eventId=testevent&bibNumber=100"
    ```
  - [ ] 응답 확인
    - photos 배열
    - total 수
  - [ ] 에러 케이스 테스트
    - 존재하지 않는 Bib
    - 잘못된 파라미터

- [ ] **4.2 Selfie 검색 API 테스트**
  - [ ] Postman/curl로 테스트
    ```bash
    curl -X POST https://api-id.execute-api.region.amazonaws.com/prod/search/selfie \
      -H "Content-Type: application/json" \
      -d '{"organizer":"testorg","eventId":"testevent","selfieImage":"base64..."}'
    ```
  - [ ] 응답 확인
    - photos 배열 (similarity 포함)
    - total 수
  - [ ] Runners 업데이트 확인
  - [ ] 에러 케이스 테스트
    - 얼굴 없는 이미지
    - Collection 없음

- [ ] **4.3 CORS 테스트**
  - [ ] localhost:3000에서 API 호출
  - [ ] snap-race.com에서 API 호출 (배포 후)
  - [ ] OPTIONS 프리플라이트 확인

---

## 🔧 Phase 3: Runners 통합 최적화 (Week 4, 선택적)

### 목표

- Runners 테이블 PhotoKeys 최적화
- 그룹 사진 처리 검증

### TODO

#### 1️⃣ Runners 테이블 데이터 확인

- [ ] **1.1 현재 PhotoKeys 타입 확인**
  - [ ] DynamoDB Console에서 확인
  - [ ] List인지 StringSet인지 확인

- [ ] **1.2 마이그레이션 필요 여부 판단**
  - [ ] List → StringSet 변환 필요하면 스크립트 작성
  - [ ] 데이터 백업

#### 2️⃣ 그룹 사진 처리 검증

- [ ] **2.1 그룹 사진 업로드 테스트**
  - [ ] 2명 이상이 찍힌 사진 업로드
  - [ ] Bib 2개 이상 감지 확인
  - [ ] EventPhotos.isGroupPhoto = true 확인

- [ ] **2.2 클라이언트 분리 표시**
  - [ ] API 응답에 isGroupPhoto 플래그 포함
  - [ ] Web 앱에서 "함께 찍힌 사진" 섹션 구분

#### 3️⃣ Selfie 검색 결과 Runners 반영 검증

- [ ] **3.1 Selfie 검색 후 Runners 확인**
  - [ ] Selfie로 사진 검색
  - [ ] 해당 Bib의 Runners.PhotoKeys 확인
  - [ ] 새로운 사진이 추가되었는지 확인

- [ ] **3.2 중복 추가 방지 확인**
  - [ ] 동일 Selfie로 여러 번 검색
  - [ ] PhotoKeys에 중복이 없는지 확인 (StringSet 특성)

---

## 📊 Phase 4: 모니터링 및 최적화 (Week 5, 선택적)

### 목표

- CloudWatch 모니터링 구성
- Lambda 성능 최적화
- 비용 최적화

### TODO

#### 1️⃣ CloudWatch 모니터링

- [ ] **1.1 Custom Metrics 설정**
  - [ ] Lambda에 Metrics 추가

    ```typescript
    import { Metrics } from "@aws-lambda-powertools/metrics";

    const metrics = new Metrics({ namespace: "PhotoProcessing" });
    metrics.addMetric("BibsDetected", MetricUnits.Count, detectedBibs.length);
    ```

  - [ ] 각 Lambda에 적용

- [ ] **1.2 CloudWatch Alarms 생성**
  - [ ] Lambda 에러율 알람 (> 5%)
  - [ ] Step Functions 실패 알람 (> 10건)
  - [ ] Rekognition API 제한 알람
  - [ ] DynamoDB 스로틀링 알람
  - [ ] Lambda Duration 알람 (> 60초)

- [ ] **1.3 SNS Topic 생성 및 구독**
  - [ ] SNS Topic 생성
  - [ ] 이메일 구독 추가
  - [ ] Alarms와 연결

#### 2️⃣ Lambda 성능 최적화

- [ ] **2.1 메모리 크기 조정**
  - [ ] 각 Lambda의 CloudWatch Logs 분석
  - [ ] 최대 메모리 사용량 확인
  - [ ] 적절한 크기로 조정 (과다 할당 방지)

- [ ] **2.2 Cold Start 최소화**
  - [ ] Provisioned Concurrency 고려
  - [ ] Keep-warm 전략 (선택적)

- [ ] **2.3 동시성 설정**
  - [ ] Reserved Concurrency 설정 (필요 시)
  - [ ] Burst 트래픽 대응

#### 3️⃣ 비용 최적화

- [ ] **3.1 DynamoDB On-Demand 모드 확인**
  - [ ] 현재 설정 확인
  - [ ] On-Demand vs Provisioned 비교

- [ ] **3.2 Rekognition 호출 수 모니터링**
  - [ ] Custom Metric 확인
  - [ ] 불필요한 호출 제거

- [ ] **3.3 S3 Lifecycle Policy 설정**
  - [ ] raw 사진 보관 기간 설정
  - [ ] Glacier 전환 정책
  - [ ] 삭제 정책

#### 4️⃣ 문서화

- [ ] **4.1 API 문서 작성**
  - [ ] Swagger/OpenAPI 스펙 작성
  - [ ] Endpoint 설명
  - [ ] 요청/응답 예시

- [ ] **4.2 운영 매뉴얼 작성**
  - [ ] 배포 가이드
  - [ ] 트러블슈팅 가이드
  - [ ] 모니터링 가이드

---

## 📌 참고 사항

### 환경 변수 체크리스트

모든 Lambda에 다음 환경 변수가 설정되어 있는지 확인:

```bash
AWS_REGION
STAGE
LOG_LEVEL
PHOTOS_BUCKET
EVENT_PHOTOS_TABLE
PHOTO_BIB_INDEX_TABLE
RUNNERS_TABLE (선택적)
REKOGNITION_COLLECTION_PREFIX
STATE_MACHINE_ARN (Starter Lambda만)
BIB_NUMBER_MIN
BIB_NUMBER_MAX
WATERMARK_FILTER_ENABLED
WATERMARK_AREA_THRESHOLD
MIN_TEXT_HEIGHT_PX
MIN_TEXT_CONFIDENCE
MIN_FACE_CONFIDENCE
MAX_FACES_PER_PHOTO
```

### 유용한 명령어

```bash
# CDK 빌드
cd apps/infra
npm run build

# CDK Synth
cdk synth

# CDK Deploy
cdk deploy

# Lambda 로그 확인
aws logs tail /aws/lambda/function-name --follow

# Step Functions 실행 확인
aws stepfunctions list-executions --state-machine-arn <arn>

# DynamoDB 테이블 조회
aws dynamodb scan --table-name EventPhotos --max-items 10

# S3 테스트 업로드
aws s3 cp test-image.jpg s3://snaprace/testorg/testevent/photos/raw/test1.jpg
```

---

**작성일**: 2025-11-05  
**최종 업데이트**: 2025-11-05  
**상태**: 구현 준비 완료
