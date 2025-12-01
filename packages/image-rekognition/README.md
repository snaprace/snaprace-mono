# Image Rekognition & Processing Service

`image-rekognition` 패키지는 SnapRace의 핵심 이미지 처리 파이프라인을 담당합니다. S3에 업로드된 레이스 사진을 자동으로 분석하여 배번(Bib Number)을 추출하고 얼굴을 인덱싱한 뒤, 검색 가능한 형태로 DynamoDB에 저장합니다.

## 🏗 아키텍처 (Architecture)

이 서비스는 **S3 + SQS + Lambda + Step Functions + Rekognition**을 활용한 이벤트 기반 서버리스 아키텍처로 구성되어 있습니다.

```mermaid
flowchart LR
    Upload[S3 Upload] --> SQS[SQS Queue]
    SQS --> Trigger[Lambda: SfnTrigger]
    Trigger --> SFN[Step Functions Workflow]
    
    subgraph SFN [Image Processing Workflow]
        Pre[Preprocess\n(Resize/Optimize)]
        
        subgraph Parallel [Parallel Analysis]
            Detect[DetectText\n(Bib Detection)]
            Index[IndexFaces\n(Face Indexing)]
        end
        
        Fanout[Fanout to DynamoDB]
    end
    
    Pre --> Parallel
    Parallel --> Fanout
    Fanout --> DDB[(DynamoDB)]
```

### 주요 컴포넌트

1.  **S3 Bucket (`snaprace-images`)**
    *   레이스 사진의 원본(`raw/`)과 처리된 이미지(`processed/`)를 저장합니다.
    *   `ObjectCreated` 이벤트를 통해 SQS에 메시지를 발행합니다.
    *   Intelligent-Tiering을 통해 스토리지 비용을 최적화합니다.

2.  **SQS (`ImageUploadQueue`) & Lambda (`SfnTrigger`)**
    *   비동기 처리를 위한 버퍼 역할을 합니다.
    *   S3 이벤트를 수신하여 Step Functions 워크플로우를 시작합니다.
    *   Photographer ID 등 메타데이터를 파싱하여 워크플로우 입력으로 전달합니다.

3.  **Step Functions (`ImageProcessingWorkflow`)**
    *   이미지 처리의 전체 흐름을 오케스트레이션합니다.
    *   오류 처리(Retry/Catch) 및 병렬 실행을 관리합니다.

4.  **Amazon Rekognition**
    *   **DetectText**: 이미지에서 텍스트를 감지하여 배번을 추출합니다.
    *   **IndexFaces/SearchFaces**: 얼굴을 감지하고 컬렉션에 인덱싱하여 셀카 검색을 지원합니다.

5.  **DynamoDB (`PhotoService`)**
    *   분석된 데이터를 Single Table Design으로 저장합니다.
    *   배번 검색(GSI1) 및 Photographer 검색(GSI2)을 위한 인덱스를 제공합니다.

---

## 🔄 상세 워크플로우 (Workflow Details)

이미지 처리는 Step Functions 상태 머신을 통해 다음 단계로 진행됩니다:

### 1. 전처리 (Preprocess)
*   **Lambda**: `PreprocessFunction`
*   S3에서 원본 이미지를 다운로드합니다.
*   `sharp` 라이브러리를 사용하여 웹 최적화된 사이즈로 리사이즈 및 압축합니다.
*   처리된 이미지를 S3 `processed/` 경로에 업로드합니다.
*   이미지 크기(width, height), 썸네일 해시 등을 계산합니다.

### 2. 병렬 분석 (Parallel Analysis)
두 가지 분석 작업이 동시에 수행됩니다.

*   **Bib 감지 (DetectText)**
    *   **Lambda**: `DetectTextFunction`
    *   Rekognition `DetectText` API를 호출합니다.
    *   숫자 패턴을 분석하여 유효한 배번 후보를 추출합니다.
    *   실패 시(예: API 스로틀링)에도 워크플로우가 중단되지 않도록 Fallback 처리됩니다.

*   **얼굴 인덱싱 (IndexFaces)**
    *   **Lambda**: `IndexFacesFunction`
    *   Rekognition `IndexFaces` API를 호출하여 얼굴 특징 벡터를 추출하고 컬렉션에 저장합니다.
    *   `{orgId}-{eventId}` 형식의 Collection ID를 사용합니다.

### 3. 데이터 저장 (Fanout to DynamoDB)
*   **Lambda**: `FanoutDynamoDBFunction`
*   전처리 및 분석 결과를 취합합니다.
*   DynamoDB에 사진 메타데이터(`PHOTO` 엔티티)를 저장합니다.
*   감지된 배번마다 인덱스 레코드(`BIB_INDEX` 엔티티)를 생성하여 역색인을 구성합니다.
*   Photographer 정보가 있는 경우 해당 정보를 포함하여 저장합니다.

---

## 💾 데이터 모델 (DynamoDB Schema)

`PhotoService` 테이블은 Single Table Design을 따릅니다.

| Entity | PK | SK | GSI1 (Bib) | GSI2 (Photographer) |
|---|---|---|---|---|
| **Photo** | `ORG#{orgId}#EVT#{eventId}` | `PHOTO#{ulid}` | - | `PHOTOGRAPHER#{id}` |
| **Bib Index** | `ORG#{orgId}#EVT#{eventId}` | `BIB#{bib}#PHOTO#{ulid}` | `EVT#{eventId}#BIB#{bib}` | - |

*   **PK**: 조직 및 이벤트 기준으로 파티셔닝
*   **GSI1**: 특정 이벤트의 특정 배번이 포함된 모든 사진 조회
*   **GSI2**: 특정 사진작가가 촬영한 사진 조회

---

## 🛠 개발 및 배포 (Development)

### 사전 요구사항
*   Node.js v20+
*   pnpm
*   AWS CLI configured

### 명령어

```bash
# 의존성 설치
pnpm install

# CDK 코드 빌드
pnpm run build

# 테스트 실행
pnpm run test

# 인프라 배포
npx cdk deploy
```

### 디렉토리 구조

*   `lib/`: CDK 스택 정의 (`ImageRekognitionStack`)
*   `lambda/`: 각 단계별 Lambda 함수 소스 코드
*   `docs/`: 상세 설계 문서 및 다이어그램

더 자세한 내용은 `docs/` 디렉토리의 [ARCHITECTURE.md](./docs/ARCHITECTURE.md) 및 [STEP_FUNCTIONS_WORKFLOW.md](./docs/STEP_FUNCTIONS_WORKFLOW.md)를 참고하세요.
