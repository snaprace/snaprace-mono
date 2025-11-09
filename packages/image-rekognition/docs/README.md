# Image Rekognition CDK 프로젝트

## 📋 개요

본 프로젝트는 마라톤/달리기 대회 사진을 자동으로 분석하여 참가자별로 분류하는 이미지 인식 시스템입니다.

### 핵심 기능

1. **이미지 전처리**: 원본 이미지를 표준화하고 최적화
2. **BIB 번호 검출**: AWS Rekognition Text Detection으로 배번 인식
3. **얼굴 인덱싱**: AWS Rekognition Face Collection으로 얼굴 등록
4. **메타데이터 저장**: DynamoDB에 검색 가능한 형태로 저장

### 주요 기술 스택

- **Infrastructure**: AWS CDK (TypeScript)
- **Orchestration**: AWS Step Functions
- **Image Processing**: AWS Lambda + Sharp.js
- **AI/ML**: AWS Rekognition (DetectText, IndexFaces)
- **Storage**: Amazon S3, DynamoDB
- **Decoupling**: Amazon SQS

## 🏗️ 전체 워크플로우

```
[사진 업로드]
    ↓
[S3: raw/] → [S3 Event] → [SQS Queue]
    ↓
[Lambda: SFN Trigger]
    ↓
[Step Functions] ← 전체 오케스트레이션
    ↓
    ├─ Step 1: [Lambda: Preprocess]
    │   └─ ULID 생성, 리사이징, 포맷 변환
    │   └─ 저장: S3 processed/{ulid}.jpg
    ↓
    ├─ Step 2: [Parallel 병렬 실행]
    │   ├─ [Lambda: Detect Text] → BIB 번호 추출
    │   └─ [Lambda: Index Faces] → 얼굴 등록
    ↓
    └─ Step 3: [Lambda: Fanout DynamoDB]
        ├─ PHOTO 아이템 저장 (원본 메타데이터)
        └─ BIB_INDEX 아이템 N개 저장 (BIB별 색인)
```

## 📁 프로젝트 구조

```
packages/image-rekognition/
├── bin/
│   └── image-rekognition.ts          # CDK 앱 엔트리포인트
├── lib/
│   └── image-rekognition-stack.ts    # 메인 스택 (인프라 정의)
├── src/                               # Lambda 런타임 코드
│   ├── preprocess/                    # 전처리 Lambda
│   │   └── index.ts
│   ├── detect-text/                   # BIB 검출 Lambda
│   │   └── index.ts
│   ├── index-faces/                   # 얼굴 인덱싱 Lambda
│   │   └── index.ts
│   ├── fanout-dynamodb/               # DynamoDB 저장 Lambda
│   │   └── index.ts
│   └── sfn-trigger/                   # Step Functions 트리거 Lambda
│       └── index.ts
├── docs/                              # 설계 문서
│   ├── README.md                      # 이 파일
│   ├── ARCHITECTURE.md                # 아키텍처 상세
│   ├── LAMBDA_FUNCTIONS.md            # Lambda 구현 스펙
│   ├── DYNAMODB_SCHEMA.md             # DynamoDB 스키마
│   └── DEPLOYMENT.md                  # 배포 가이드
├── test/
│   └── image-rekognition.test.ts
├── package.json
└── tsconfig.json
```

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

CDK 컨텍스트 또는 환경 변수로 다음 값들을 설정합니다:

```bash
export AWS_REGION=ap-northeast-2
export STAGE=dev
export ORG_ID=your-org-id
export EVENT_ID=your-event-id
```

### 3. CDK 배포

```bash
# 처음 배포하는 경우 (Bootstrap 필요)
npx cdk bootstrap

# 스택 배포
npx cdk deploy
```

> 💡 **Rekognition Collection은 자동 생성됩니다**  
> 첫 이미지 업로드 시 `{orgId}-{eventId}` 형식의 Collection이 자동으로 생성됩니다.  
> 수동 생성이 필요하지 않습니다!

## 📚 상세 문서

- [아키텍처 상세](./ARCHITECTURE.md) - 전체 시스템 아키텍처 및 AWS 리소스
- [Lambda 함수 구현 스펙](./LAMBDA_FUNCTIONS.md) - 각 Lambda의 입출력 및 로직
- [DynamoDB 스키마](./DYNAMODB_SCHEMA.md) - 테이블 설계 및 쿼리 패턴
- [배포 및 운영](./DEPLOYMENT.md) - 배포, 모니터링, 트러블슈팅

## 🔑 핵심 설계 원칙

### 1. 안정성 (Reliability)

- **SQS 디커플링**: 대량 업로드 시 Step Functions 실행 한도 보호
- **Step Functions 오케스트레이션**: 각 단계별 재시도 및 에러 핸들링
- **멱등성**: 동일한 입력에 대해 여러 번 실행해도 안전

### 2. 확장성 (Scalability)

- **병렬 처리**: BIB 검출과 얼굴 인덱싱 동시 실행
- **Lambda 자동 스케일링**: 트래픽에 따라 자동으로 확장
- **SQS 버퍼링**: 대량 요청을 안정적으로 처리

### 3. 비용 최적화 (Cost Optimization)

- **표준화된 이미지**: 전처리를 통해 Rekognition 비용 절감
- **리사이징**: 불필요하게 큰 이미지 처리 방지
- **S3 Intelligent-Tiering**: 액세스 패턴에 따라 자동으로 최적 스토리지 클래스 전환
  - 원본 이미지는 90-180일 후 Archive Tier로 자동 이동
  - 최대 95% 스토리지 비용 절감 가능

### 4. 추적성 (Traceability)

- **ULID 기반 식별**: 시간 순서가 있는 고유 ID
- **S3 URI**: ExternalImageId로 원본 추적 가능
- **Step Functions 실행 히스토리**: 전체 워크플로우 추적

## 🔍 주요 제약사항 및 고려사항

### AWS Rekognition 제약

- **이미지 크기**: 최대 15MB, 최소 80x80px
- **이미지 해상도**: 최대 4096px (긴 변 기준)
- **얼굴 크기**: 최소 40x40px (전체 이미지의 일정 비율)
- **지원 포맷**: JPEG, PNG (전처리에서 JPEG로 통일)

### Step Functions 제약

- **페이로드 크기**: 최대 256KB
- **실행 시간**: 최대 1년 (본 프로젝트는 ~수 분 이내)
- **동시 실행**: 계정당 기본 한도 확인 필요

### DynamoDB 설계

- **단일 테이블 설계**: PhotoService 테이블 사용
- **복합 키**: PK, SK로 계층적 데이터 표현
- **GSI**: BIB 기반 검색을 위한 GSI1

## 📞 문의 및 지원

프로젝트 관련 문의사항은 팀 슬랙 채널 또는 이슈 트래커를 이용해주세요.

## 📄 라이선스

Internal Use Only
