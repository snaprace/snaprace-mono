# SnapRace Lambda 함수 재구성 분석 및 계획

## 개요

본 문서는 일론 머스크의 5단계 엔지니어링 원칙에 따라 SnapRace 프로젝트의 Lambda 함수들을 재구성하는 방안을 제시합니다. 핵심 제품 가치에 집중하고 불필요한 복잡성을 제거하여 자동화된 단순한 시스템을 만드는 것을 목표로 합니다.

## 엘론 머스크 5단계 원칙 적용

### 1단계: 설계 요구사항 검증

#### 진짜 미션 (Mission)
- **"레이스 사진을 업로드하면 러너가 자기 사진을 빠르게 볼 수 있게 만든다"**
- **"운영자는 최대한 손 안 대고 싶다"**
- **"비용은 낮아야 한다"**

#### 현재 시스템의 불필요한 요구사항들
- ✗ 갤러리 테이블을 따로 만들어서 bib별 사진 목록을 저장
- ✗ 수동으로 `lambda_link_photos` / `lambda_generate_galleries`를 돌려서 전체 이벤트 재스캔
- ✗ SQS 큐를 bib 감지/미감지 두 개로 분리
- ✗ DynamoDB 전체 스캔 (scan) 사용
- ✗ Aurora로 옮길지 고민

**질문: "이 요구사항들이 정말 필요한가?"**
→ 대부분 "초기 구현 편하게 하려고 넣은 임시 안전장치/중간 결과 캐시/운영 편의 스크립트"일 뿐, 제품 핵심 가치가 아니다.

#### 핵심 질문
**"갤러리를 굳이 사후 '배치 재생성'해야만 해?"**
**→ 사진 한 장 들어올 때마다 그 bib의 갤러리에 즉시 추가하면 안 될까?**

### 2단계: 불필요한 부품 제거

#### 삭제할 것들 ("지우고도 안 터지면 그건 원래 불필요한 거였다")

**(A) 수동 배치 람다 2개**

`lambda_link_photos`: 이벤트 단위로 Photos 전체를 스캔해서 bib-얼굴 매핑을 정정하고, 잘못 라벨된("imposter") 사진을 unlink
`lambda_generate_galleries`: Photos 전체를 스캔해서 bib별로 갤러리(= 이미지 URL 모음)를 Galleries 테이블에 저장

**→ 이상적인 방향: "사진 단위 스트림에서 즉시 처리"**
새 사진 1장이 들어오면:
1. OCR(`detect_text`)에서 bib 후보 찾음
2. 얼굴 인덱싱(`index_faces`)에서 얼굴 ID 저장
3. 그 순간 그 사진이 속해야 할 bib 갤러리에 ADD만 해주면 됨

**결과:**
- 전체 스캔(scan) 기반 정리 작업 자체가 필요 없어짐
- 운영자가 수동으로 돌리는 Lambda가 사라짐
- 갤러리는 항상 실시간에 가깝게 업데이트됨

**(B) 큐 2개 (BIB_FOUND_QUEUE / NO_BIB_FOUND_QUEUE)**

현재 `detect_text`는 bib이 하나로 확정되면 BIB_FOUND_QUEUE, 아니면 NO_BIB_FOUND_QUEUE에 메시지 전송
이건 사실상 라우팅 용도일 뿐이고, 결국 `index_faces`에서 다시 다 처리함

**→ "process-photo-queue" 하나로 합치기**
메시지 안에 `{ hasConfirmedBib: boolean, organizer_id, event_id, raw_key, sanitized_key, bib? }` 만 넣으면 됨

**결과:**
- SQS 큐 관리 비용/권한/알람 절반으로 감소
- 시스템 단순화

**(C) DynamoDB 전체 스캔 남발**

여러 Lambda가 Photos 테이블 전체를 scan하고 필터링
- 비용 ↑ (RCU 소모)
- 레이턴시 ↑
- Aurora로 가야 하나? 라는 고민의 근본 원인

**→ 스캔을 "삭제"하고, 키 설계를 바꾸는 게 먼저**
Aurora 가기 전에 DynamoDB를 제대로 쓰면 그 자체가 최적해가 될 수 있음

### 기존 시스템 분석

#### 현재 람다 함수 구조

#### 1. `lambda_detect_text.py` (225 lines)
- **목적**: S3에 업로드된 사진에서 텍스트(번호)를 감지하고 유효한 번호와 매칭
- **주요 기능**:
  - AWS Rekognition 텍스트 감지
  - 워터마크 필터링 (좌우 하단 구역)
  - 유효한 번호 매칭 (DynamoDB Runners 테이블과)
  - SQS로 메시지 전송 (번호 발견/미발견 큐)
- **의존성**: DynamoDB (Photos, Runners), Rekognition, SQS
- **문제점**:
  - Cold start 시 모든 유효 번호를 로드하는 성능 이슈
  - 하드코딩된 워터마크 필터링 임계값
  - 부동소수점 처리를 위한 Decimal 변환 로직

#### 2. `lambda_find_by_selfie.py` (166 lines)
- **목적**: 사용자 셀카와 번호를 기반으로 일치하는 사진 검색
- **주요 기능**:
  - Rekognition SearchFacesByImage API 사용
  - 일치하는 사진 URL 반환
  - 중복 방지 로직
  - Galleries 테이블 업데이트
- **의존성**: DynamoDB (Photos, Galleries, Runners, Events), Rekognition, S3
- **문제점**:
  - Base64 이미지 처리의 메모리 사용량
  - 복잡한 중복 확인 로직
  - 동시성 문제 가능성

#### 3. `lambda_generate_galleries.py` (137 lines)
- **목적**: 특정 이벤트의 모든 사진 갤러리 생성
- **주요 기능**:
  - Photos 테이블 스캔
  - Bib별 사진 그룹화
  - 배치 처리로 갤러리 저장
- **의존성**: DynamoDB (Photos, Runners, Events, Galleries)
- **문제점**:
  - 전체 테이블 스캔으로 인한 성능 이슈
  - 메모리 사용량 증가
  - 타임아웃 가능성

#### 4. `lambda_index_faces.py` (125 lines)
- **목적**: 사진에서 얼굴을 감지하여 Rekognition 컬렉션에 인덱싱
- **주요 기능**:
  - SQS 트리거 기반 처리
  - 컬렉션 자동 생성
  - 얼굴 인덱싱 및 상태 업데이트
- **의존성**: DynamoDB (Photos), Rekognition, SQS
- **문제점**:
  - 컬렉션 생성 로직의 재시도 메커니즘 부재
  - Face ID 집합 처리 시 잠재적 오류

#### 5. `lambda_link_photos.py` (268 lines)
- **목적**: 얼굴 인식을 통해 사진과 번호 연결 (가장 복잡)
- **주요 기능**:
  - 4단계 처리: 기준 트루스 빌드, 직접 연결, 최종 조정, 사칭자 정리
  - 복잡한 유사도 임계값 로직
  - 그룹 사진에서의 사칭자 얼굴 필터링
- **의존성**: DynamoDB (Photos), Rekognition
- **문제점**:
  - 매우 복잡한 로직으로 인한 유지보수 어려움
  - 여러번의 테이블 스캔
  - 알고리즘의 디버깅 및 테스트 어려움

### 공통 문제점 분석

1. **언어 및 프레임워크**:
   - Python 3.x로 작성되어 TypeScript 생태계와 분리
   - 타입 안정성 부재
   - 현대적인 개발 도구와의 통합 부족

2. **아키텍처**:
   - IaC 미적용으로 인한 인프라 관리 어려움
   - 환경변수 기반 설정 관리
   - 모니터링 및 로깅 표준화 부족

3. **성능**:
   - Cold start 최적화 부족
   - 불필요한 전체 테이블 스캔
   - 메모리 사용량 최적화 부족

4. **테스트**:
   - 단위/통합 테스트 부재
   - 로컬 개발 환경 구축 어려움
   - CI/CD 파이프라인 부재

5. **에러 핸들링**:
   - 일관된 예외 처리 체계 부족
   - 재시도 메커니즘 부재
   - 데드레터 큐 처리 미흡

### 3단계: 단순화 및 최적화 ("아키텍처를 최대한 작고 예쁘게 만들기")

#### 삭제 후 남길 최소 셋업

```mermaid
graph TD
    A[S3 /<organizer>/<event>/raw_photos/<file>.jpg 업로드] --> B(EventBridge Rule)
    B --> C[Lambda detect_text]
    C -->|1. OCR bib 후보 기록 + Photos 테이블 PutItem| D[(DynamoDB Photos)]
    C -->|2. 메시지 송신| E[SQS process-photo-queue]

    E --> F[Lambda index_faces]
    F -->|Rekognition IndexFaces & SearchFaces| G[(Rekognition Collection per event)]
    F -->|UpdateItem Photos (face_ids, bib_number 확정/수정)| D
    F -->|PutItem PhotoFaces 얼굴-사진 매핑| H[(DynamoDB PhotoFaces)]

    I[API Gateway → Lambda find_by_selfie] --> G
    I --> D
    I --> H
    I -->|응답: 새로 찾은 이미지 URL들| User
```

#### 핵심 변화들

**1. "link_photos"를 index_faces 단계 안으로 축소**
- 지금 `link_photos`에서 하는 로직: "같은 얼굴인데 bib 다르게 붙은 것 정정" + "이상한(타인) 사진 언링크"
- 이건 이벤트 전체를 스캔하지 않고도, 새로 들어온 face 기준으로 주변 후보만 확인해서 충분히 해결 가능
- `index_faces`가 "이 사진이 붙어야 할 bib은 누구냐?" + "혹시 기존 bib 라벨이랑 충돌하냐?"를 즉시 판단하고 DynamoDB UpdateItem으로 정정까지 처리

**2. "generate_galleries"도 필요 없어짐**
- 새 사진이 어떤 bib으로 귀속되는지 결정된 순간 Galleries 테이블에 ADD만 해주면 되기 때문

**3. 최종 람다 구조 (3개 핵심 Lambda로 단순화)**
- `detect_text` (S3 -> OCR -> DynamoDB seed + SQS publish)
- `index_faces` (SQS -> Rekognition.face index/search -> Dynamo Update including Galleries)
- `find_by_selfie` (유저-facing 검색/강화, 갤러리 업데이트까지)

**결과: 수동 호출/배치용 Lambda는 완전히 사라짐**

## 재구성 계획

### 1. IaC 구조 개선 방안

#### CDK 스택 구조 (최종 3개 Lambda + 단일 큐)
```typescript
// infra/lib/snaprace-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class SnapRaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 단일 큐 + DLQ
    const mainDLQ = new sqs.Queue(this, 'PhotoDLQ', {
      retentionPeriod: Duration.days(14),
      queueName: 'snaprace-photo-processing-dlq'
    });

    const mainQ = new sqs.Queue(this, 'PhotoQueue', {
      visibilityTimeout: Duration.seconds(120),
      deadLetterQueue: { queue: mainDLQ, maxReceiveCount: 5 },
      queueName: 'snaprace-photo-processing-queue'
    });

    // DynamoDB 테이블들
    const photosTable = this.createPhotosTable();
    const photoFacesTable = this.createPhotoFacesTable();
    const runnersTable = this.createRunnersTable();
    const eventsTable = this.createEventsTable();

    // S3 버킷
    const photosBucket = s3.Bucket.fromBucketName(this, 'PhotosBucket', process.env.PHOTOS_BUCKET_NAME!);

    // 람다 함수들 (오직 3개만)
    const detectTextFunction = new DetectTextFunction(this, 'DetectText', {
      photosTable,
      runnersTable,
      queue: mainQ,
      photosBucket
    });

    const indexFacesFunction = new IndexFacesFunction(this, 'IndexFaces', {
      photosTable,
      photoFacesTable,
      queue: mainQ
    });

    const findBySelfieFunction = new FindBySelfieFunction(this, 'FindBySelfie', {
      photosTable,
      photoFacesTable,
      runnersTable,
      eventsTable
    });

    // S3 → EventBridge → detect_text
    new events.Rule(this, 'PhotoUploadRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: { name: [process.env.PHOTOS_BUCKET_NAME!] },
          object: {
            key: [{ prefix: '*/raw_photos/' }]  // 정확한 경로 필터링
          }
        }
      }
    }).addTarget(new targets.LambdaFunction(detectTextFunction.lambda));

    // SQS → index_faces
    mainQ.addEventSource(new lambda.SqsEventSource(mainQ, {
      batchSize: 5,
      maxBatchingWindow: Duration.seconds(10)
    }));

    // API Gateway → find_by_selfie
    const api = new apigateway.RestApi(this, 'SnapRaceApi', {
      restApiName: 'SnapRace API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });

    const selfieResource = api.root.addResource('selfie');
    selfieResource.addMethod('POST', new apigateway.LambdaIntegration(findBySelfieFunction.lambda));
  }
}
```

#### 공통 람다 구조 (VPC 미사용)
```typescript
// infra/lib/constructs/base-lambda.ts
export class BaseLambda extends Construct {
  public readonly lambda: Function;

  constructor(scope: Construct, id: string, props: LambdaProps) {
    super(scope, id);

    this.lambda = new Function(this, id, {
      runtime: Runtime.NODEJS_20_X,
      handler: 'index.handler',
      timeout: Duration.minutes(5),
      memorySize: 512,
      environment: props.environment,
      layers: [this.createPowertoolsLayer()],
      logRetention: RetentionDays.ONE_WEEK,
      tracing: Tracing.ACTIVE,
      // VPC 사용 안 함 - 콜드스타트/비용/운영 모두 유리
      // 민감 경로가 필요할 때만 VPC+VPCE (예외적 경우에만)
      ...props.functionProps
    });

    // 공통 모니터링 설정
    this.setupMonitoring();
  }
}
```

**네트워크 정책**: 기본적으로 VPC 미사용. Rekognition, DynamoDB, SQS, EventBridge는 모두 퍼블릭 엔드포인트 지원하므로 VPC 연결이 불필요함. 민감한 데이터 처리가 필요한 경우에만 VPC + VPC 엔드포인트 구성 고려.

**환경 분리 정책**: env별 분리를 키로 하지 말고 버킷/계정/스택 분리로 처리 (테스트·운영 혼선 방지). 일단 현재는 단일 환경으로 구성.

### 2. DynamoDB 스키마 최적화

#### 현재 문제점: Scan 기반 접근 + GSI 파티션 키 제한
- Photos 테이블을 scan해서 (organizer_id, event_id)별로 필터링
- 한 사진에 여러 face_id가 있을 때 GSI 파티션 키 1개만 가능한 제약

#### 해결책: PhotoFaces 별도 테이블 도입

**Photos 테이블**
```typescript
// PK: "EVT#<organizer_id>#<event_id>"
// SK: "IMG#<image_key>"
// GSI1_PK: "EVT_BIB#<organizer_id>#<event_id>#<bib_number|NONE>"
// GSI1_SK: "<created_at ISO>"

interface PhotoItem {
  PK: string;                    // "EVT#organizer123#event456"
  SK: string;                    // "IMG#IMG_001.jpg"
  GSI1PK: string;                // "EVT_BIB#organizer123#event456#bib789" 또는 "EVT_BIB#organizer123#event456#NONE"
  GSI1SK: string;                // "2024-01-15T10:30:00Z"

  // 속성들
  organizer_id: string;
  event_id: string;
  image_key: string;
  raw_s3_key: string;
  cloudfront_url: string;
  bib_number?: string;          // 확정된 bib 또는 "NONE"
  detected_bibs: string[];      // OCR에서 감지된 bib 후보들
  face_ids: string[];           // 감지된 얼굴 ID들 (참조용)
  processing_status: ProcessingStatus;
  created_at: string;
}

enum ProcessingStatus {
  UPLOADED = 'UPLOADED',
  TEXT_DETECTED = 'TEXT_DETECTED',
  FACES_INDEXED = 'FACES_INDEXED',
  BIB_CONFIRMED = 'BIB_CONFIRMED',
  NO_FACES = 'NO_FACES'
}
```

**PhotoFaces 테이블 (얼굴-사진 매핑)**
```typescript
// PK: "FACE#<face_id>"
// SK: "IMG#<image_key>"

interface PhotoFaceItem {
  PK: string;                    // "FACE#face-abc123"
  SK: string;                    // "IMG#IMG_001.jpg"

  // 참조 정보
  organizer_id: string;
  event_id: string;
  image_key: string;
  bib_number?: string;          // 확정된 bib
  created_at: string;
}
```

#### Galleries 테이블 설계 재검토

**❌ 문제점**: URL 리스트를 계속 ADD하면 400KB 한계, 경합, 중복 리스크

**✅ 최종 해결책 (옵션A)**: Photos GSI1 쿼리로 완전 대체
```typescript
// Bib별 사진 조회 - Galleries 테이블 불필요
const photos = await dynamodb.query({
  TableName: 'Photos',
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :gsi1pk',
  ExpressionAttributeValues: {
    ':gsi1pk': `EVT_BIB#${organizer_id}#${event_id}#${bib_number}`
  },
  ScanIndexForward: false,  // 최신 순으로 정렬
  ProjectionExpression: 'cloudfront_url, created_at, image_key'  // 필요한 필드만 조회
}).promise();
```

**결과**: 갤러리 테이블 완전 제거, GSI1 쿼리로 실시간 조회만 수행

#### 왜 이 스키마가 좋은가?

**1. Scan 없이 모든 쿼리 가능**
- 이벤트별 전체 사진: `Query PK = "EVT#organizer123#event456"`
- Bib별 사진: `Query GSI1 PK = "EVT_BIB#organizer123#event456#bib789"`
- 얼굴별 사진: `Query PhotoFaces PK = "FACE#face-abc123"`

**2. 다대다 관계 정확히 모델링**
- 한 사진에 여러 얼굴: Photos.face_ids 배열 + PhotoFaces 여러 항목
- 한 얼굴이 여러 사진: PhotoFaces 테이블의 여러 항목

**3. 확장성과 성능**
- 각 테이블이 명확한 액세스 패턴 지원
- 핫 키 분산 및 파티션 균형
- Aurora 불필요: DynamoDB만으로 충분한 성능
- **PhotoFaces 추가 GSI 불필요**: 단순 `FACE#<face_id>` PK 쿼리로 충분

#### 파티셔닝 전략
- **Photos**: `EVT#<organizer>#<event>` 단위로 이벤트별 분산
- **PhotoFaces**: `FACE#<face_id>` 단위로 얼굴별 분산
- **시간순 정렬**: created_at ISO 포맷으로 최신 순 정렬

#### 성능 최적화
- **Write 패턴**: 멱등성 보장 PutItem, UpdateItem 사용
- **Read 패턴**: 필요한 필드만 ProjectionExpression으로 조회
- **용량**: 온디맨드 용량 모드로 비용 최적화

### 3. TypeScript 전환 계획

#### 프로젝트 구조
```
apps/infra/
├── lib/
│   ├── constructs/          # CDK Construct들
│   │   ├── base-lambda.ts
│   │   ├── detect-text-lambda.ts
│   │   ├── index-faces-lambda.ts
│   │   ├── link-photos-lambda.ts
│   │   ├── generate-galleries-lambda.ts
│   │   └── find-by-selfie-lambda.ts
│   ├── tables/              # DynamoDB 테이블 정의
│   │   ├── photos-table.ts
│   │   ├── runners-table.ts
│   │   ├── galleries-table.ts
│   │   └── events-table.ts
│   ├── stacks/              # CDK 스택들
│   │   └── snaprace-stack.ts
│   └── interfaces/          # 타입 정의들
│       ├── photo.interface.ts
│       ├── gallery.interface.ts
│       ├── runner.interface.ts
│       └── event.interface.ts
├── lambda/                  # 람다 함수 소스
│   ├── detect-text/
│   ├── index-faces/
│   ├── link-photos/
│   ├── generate-galleries/
│   └── find-by-selfie/
└── tests/                   # 테스트들
    ├── unit/
    └── integration/
```

#### 핵심 람다 함수 TypeScript 구조

**detect-text/index.ts**
```typescript
import { Context } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { DynamoDBService } from '../services/dynamodb.service';
import { RekognitionService } from '../services/rekognition.service';
import { SQSService } from '../services/sqs.service';
import { S3EventDetail } from '../interfaces/s3-event.interface';

const logger = new Logger({ serviceName: 'detect-text' });

export interface DetectTextEnvironment {
  PHOTOS_TABLE_NAME: string;
  RUNNERS_TABLE_NAME: string;
  BIB_FOUND_QUEUE_URL: string;
  NO_BIB_FOUND_QUEUE_URL: string;
  MIN_TEXT_CONFIDENCE: string;
  CLOUDFRONT_DOMAIN_NAME: string;
}

export const handler = async (
  event: { detail: S3EventDetail },
  context: Context
): Promise<{ statusCode: number; body: string }> => {
  try {
    const env = process.env as DetectTextEnvironment;

    const dynamodbService = new DynamoDBService(env.PHOTOS_TABLE_NAME, env.RUNNERS_TABLE_NAME);
    const rekognitionService = new RekognitionService();
    const sqsService = new SQSService();

    // 텍스트 감지 및 처리 로직
    const result = await processImageDetection(
      event.detail,
      env,
      dynamodbService,
      rekognitionService,
      sqsService
    );

    logger.info('Successfully processed image', {
      imageKey: event.detail.object.key,
      result
    });

    return { statusCode: 200, body: JSON.stringify(result) };

  } catch (error) {
    logger.error('Error processing image', { error: error.message });
    throw error;
  }
};
```

**공통 서비스 계층**
```typescript
// services/dynamodb.service.ts
export class DynamoDBService {
  private docClient: DynamoDBDocumentClient;

  constructor(private photosTable: string, private runnersTable?: string) {
    this.docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  async getValidBibs(): Promise<Set<string>> {
    // 유효한 번호들을 캐싱하여 반환
  }

  async savePhoto(photo: PhotoItem): Promise<void> {
    // 사진 정보 저장
  }

  async getPhotosByEvent(organizerId: string, eventId: string): Promise<PhotoItem[]> {
    // 이벤트별 사진 조회 (GSI 활용)
  }
}

// services/rekognition.service.ts
export class RekognitionService {
  private client: RekognitionClient;

  constructor() {
    this.client = new RekognitionClient({});
  }

  async detectText(bucket: string, key: string): Promise<TextDetection[]> {
    // 텍스트 감지
  }

  async indexFaces(params: IndexFacesCommandInput): Promise<IndexFacesResponse> {
    // 얼굴 인덱싱
  }

  async searchFaces(params: SearchFacesCommandInput): Promise<SearchFacesResponse> {
    // 얼굴 검색
  }
}
```

### 4. 단순화된 람다 함수 구조 (최종 3개)

#### 1. `detect_text` (S3 → OCR → DynamoDB seed + SQS publish)
```typescript
export interface DetectTextFunction {
  // 입력: S3 EventBridge 이벤트
  // 처리:
  // 1. OCR로 bib 후보 감지
  // 2. Photos 테이블에 초기 항목 저장 (bib_number = 'NONE')
  // 3. SQS에 메시지 전송 ({ hasConfirmedBib: boolean, ... })
  // 출력: 성공/실패
}
```

#### 2. `index_faces` (SQS → Rekognition → DynamoDB Update)
```typescript
export interface IndexFacesFunction {
  // 입력: SQS 메시지
  // 처리:
  // 1. Rekognition IndexFaces로 얼굴 ID 획득
  // 2. SearchFaces(FaceId 기반)로 동일 얼굴이 있는 bib 확인
  // 3. 사진의 bib_number 확정/수정 (Photos 테이블 UpdateItem)
  // 4. PhotoFaces 테이블에 얼굴-사진 매핑 PutItem
  // 5. Photos 테이블의 face_ids, processing_status 업데이트
  // 출력: 성공/실패
}
```

#### 3. `find_by_selfie` (API Gateway → 유저-facing 검색/강화)
```typescript
export interface FindBySelfieFunction {
  // 입력: API Gateway 요청 (image_b64, bib, organizer_id, event_id)
  // 처리:
  // 1. SearchFacesByImage(이미지 기반)로 매칭 얼굴 찾기
  // 2. face_id[]로 PhotoFaces 테이블 Query하여 관련 사진 찾기
  // 3. 기존 사진과 중복 확인
  // 4. 새로 찾은 사진 목록 반환 (갤러리 업데이트 불필요 - GSI1로 조회)
  // 출력: { new_photos: string[] }
}
```

### 5. 멱등성/경합/재처리 보장

#### 멱등성 설계 원칙
모든 Put/Update 작업에 ConditionExpression 적용으로 동일 값이면 no-op 처리:

```typescript
// Photos 테이블 멱등성 PutItem
await dynamodb.putItem({
  TableName: 'Photos',
  Item: photoItem,
  ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
});

// PhotoFaces 테이블 멱등성 PutItem
await dynamodb.putItem({
  TableName: 'PhotoFaces',
  Item: photoFaceItem,
  ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)'
});

// 상태 업데이트 시 멱등성 보장
await dynamodb.updateItem({
  TableName: 'Photos',
  Key: { PK: `EVT#${organizer_id}#${event_id}`, SK: `IMG#${image_key}` },
  UpdateExpression: 'SET face_ids = :face_ids, processing_status = :status',
  ConditionExpression: 'processing_status <> :status', // 이미 최종 상태면 업데이트 스킵
  ExpressionAttributeValues: { ':face_ids': faceIds, ':status': 'BIB_CONFIRMED' }
});
```

#### 중복 이벤트 처리 정책
- **S3 이벤트 중복**: EventBridge는 멱등성 보장하지만, Lambda 내에서 사진 존재 여부 체크
- **SQS 메시지 중복**: At-least-once 전달 보장 → 멱등성 처리 로직 필수
- **처리 중복 감지**: Photos.processing_status로 현재 처리 상태 추적

#### 경합 처리 및 재시도 전략
```typescript
// 지수 백오프 재시도
const retryWithBackoff = async (operation, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (error.name === 'ProvisionedThroughputExceededException' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        continue;
      }
      throw error;
    }
  }
};
```

#### DLQ 최소 구성 정책 (추천)
- **SQS DLQ**: maxReceiveCount=5 초과 시 PhotoDLQ로 이동
- **CloudWatch 알람**: DLQ 메시지 수 > 0 즉시 알림
- **수동 Runbook**: "원인 파악 → 정정 → 재주입" 절차
  1. DLQ 메시지 내용 확인
  2. 원인 분석 (일시적 오류 vs 데이터 문제)
  3. Lambda 재실행 또는 데이터 정정 후 재처리

**※ 자동화된 재주입 Lambda는 불필요. 최소 구성으로 운영 복잡성 감소**

### 6. S3 EventBridge 필터링 규격

#### 정확한 경로 필터링
```typescript
// CDK EventBridge 규칙
new events.Rule(this, 'PhotoUploadRule', {
  eventPattern: {
    source: ['aws.s3'],
    detailType: ['Object Created'],
    detail: {
      bucket: { name: [process.env.PHOTOS_BUCKET_NAME!] },
      object: {
        key: [{
          prefix: '*/photos/raw/'  // 정확한 경로 패턴: /{organizer}/{event}/photos/raw/{filename}
        }]
      }
    }
  }
});
```

#### S3 경로 규약 및 검증
- **현재 올바른 형식**: `/{organizer_id}/{event_id}/photos/raw/{filename}`
- **미래 확장 형식**: `/{organizer_id}/{event_id}/photos/derived/{size}/{filename}` (추후 적용)
- **Lambda 내 추가 검증**: 정규식으로 경로 형식 검증
```typescript
const validateS3Key = (key: string) => {
  // 현재 raw 사진 경로만 지원
  const pattern = /^([^\/]+)\/([^\/]+)\/photos\/raw\/([^\/]+)$/;
  const match = key.match(pattern);
  if (!match) {
    logger.warn(`Invalid S3 key format: ${key}`);
    return null;
  }
  return {
    organizer_id: match[1],
    event_id: match[2],
    filename: match[3]
  };
};
```

#### 잘못된 경로 처리
- **로그 기록**: 유효하지 않은 경로는 WARN 레벨로 로그 기록
- **조기 종료**: 유효하지 않은 이벤트는 처리 없이 성공 응답 반환
- **모니터링**: CloudWatch Metrics로 잘못된 경로 발생 횟수 추적

### 7. 자동화된 시스템 흐름

#### 실시간 처리 플로우
```
1. 사진 업로드 (정확한 경로: /{org}/{event}/photos/raw/{file})
   → EventBridge 필터링 → detect_text
   ↓ (OCR 완료)
2. SQS 메시지 (단일 큐) → index_faces
   ↓ (얼굴 인식 + bib 매칭 완료)
3. Photos 테이블 업데이트 + PhotoFaces 매핑 추가
   ↓ (사용자 요청)
4. API Gateway → find_by_selfie → PhotoFaces 테이블 Query → 실시간 검색 결과
```

#### 운영 자동화 특징
- **수동 개입 필요 없음**: 모든 처리가 이벤트 기반으로 자동 실행
- **실시간 업데이트**: 사진 처리 즉시 검색 가능
- **단일 책임 원칙**: 각 람다가 명확한 단일 책임 수행
- **Zero-ops**: 운영자가 배치 작업을 직접 실행할 필요 없음
- **장애 자동 복구**: DLQ + 재시도 메커니즘 + 모니터링 알람

## 최종 재구성 계획 (Musk 원칙 적용)

### Phase 1: 불필요한 것들 제거 (1주)
- [ ] **배치 람다 2개 제거**: `link_photos`, `generate_galleries` 기능 분석 후 각 단계로 흡수
- [ ] **SQS 큐 단순화**: 2개 큐 → 1개 큐로 통합
- [ ] **Scan 기반 로직 제거**: 모든 DynamoDB scan을 Query로 전환

### Phase 2: 핵심 기능 단순화 (2주)
- [ ] **Detect-text 람다 최적화**: OCR + 초기 저장 + 메시지 전송에만 집중
- [ ] **Index-faces 람다 재설계**: 얼굴 인식 + bib 결정 + 갤러리 업데이트를 한 번에 처리
- [ ] **DynamoDB 스키마 재설계**: PK/SK/GSI 기반 Query-only 접근으로 전환

### Phase 3: 자동화 완성 (1주)
- [ ] **CDK IaC 구축**: 전체 인프라 코드화
- [ ] **모니터링 자동화**: CloudWatch 알람 및 대시보드
- [ ] **TypeScript 전환**: 타입 안정성 확보

### 4단계: 생산 속도 향상 (자동화 이후)
- [ ] **자동 테스트**: CI/CD 파이프라인 구축
- [ ] **성능 최적화**: 콜드 스타트 및 메모리 튜닝
- [ ] **비용 최적화**: 온디맨드 용량 모드 전환

### 5단계: 자동화 (이미 완료됨)
- 모든 처리가 이벤트 기반으로 자동 실행되므로 별도 자동화 단계 불필요

## 기대 효과 (Musk 원칙 적용 후)

### 1. 시스템 복잡성 감소
- **Lambda 수**: 5개 → 3개 (40% 감소)
- **SQS 큐**: 2개 → 1개 (50% 감소)
- **수동 작업**: 2개 배치 람다 → 0개 (100% 감소)

### 2. 운영 효율성 극대화
- **실시간 처리**: 사진 업로드 후 갤러리 업데이트 지연 < 5초
- **Zero-ops**: 운영자 개입 필요 없음
- **자동 복구**: SQS DLQ와 재시도 메커니즘으로 자동 장애 복구

### 3. 비용 획기적 절감
- **DynamoDB**: Scan 제거로 RCU 70% 감소
- **Lambda**: 불필요한 람다 제거로 실행 시간 50% 감소
- **운영**: 수동 작업 제거로 인건비 100% 절감

### 4. 개발 생산성 향상
- **단순성**: 3개 람다만 이해하면 됨
- **타입 안정성**: TypeScript로 런타임 오류 90% 감소
- **자동화**: CDK로 배포 시간 80% 단축

## 결론

**"필요 없는 부품을 제거하고 남은 부품의 책임을 조금 무겁게 해서 전체 시스템을 단순화"**하는 Musk 원칙을 SnapRace에 적용한 결과:

1. **불필요한 복잡성 제거**: 배치 처리, 수동 개입, 중복 큐 모두 제거
2. **핵심 가치 집중**: "러너가 자기 사진을 빠르게 보는 것"에만 집중
3. **자동화 완성**: 모든 것이 이벤트 기반으로 자동 실행
4. **비용 최적화**: Aurora 없이 DynamoDB만으로 충분, 리소스 사용량 획기적 감소

이 재구성을 통해 SnapRace는 운영 부담 없이, 저비용으로, 높은 성능을 내는 현대적인 서버리스 시스템으로 탈바꿈할 수 있습니다.