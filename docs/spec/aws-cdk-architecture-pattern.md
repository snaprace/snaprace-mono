# AWS CDK 구조화된 패턴 설계 문서

## 개요

본 문서는 SnapRace 프로젝트의 AWS CDK 인프라 구성을 구조화된 패턴으로 설계하기 위한 가이드입니다. AWS Solutions Constructs를 활용하여 S3, Lambda, DynamoDB, SQS를 최소 단위로 구성하는 방법을 제시합니다.

## 설계 원칙

### 1. 구조화된 패턴 적용
- **AWS Solutions Constructs 활용**: 일반적인 아키텍처 패턴을 재사용 가능한 Construct로 구성
- **관심사 분리**: 각 리소스 타입별로 별도의 Construct 모듈 구성
- **최소 단위 구성**: 핵심 기능만 포함하여 복잡성 최소화

### 2. 최소 단위 구성 목표
- S3: 사진 저장 및 이벤트 트리거
- Lambda: 서버리스 함수 실행
- DynamoDB: 메타데이터 저장
- SQS: 비동기 메시지 큐

## 디렉토리 구조

```
apps/infra/
├── lib/
│   ├── constructs/              # 재사용 가능한 Construct 모듈
│   │   ├── storage/            # S3 관련 Constructs
│   │   │   └── photo-bucket.ts
│   │   ├── compute/            # Lambda 관련 Constructs
│   │   │   ├── base-lambda.ts
│   │   │   ├── detect-text-lambda.ts
│   │   │   ├── index-faces-lambda.ts
│   │   │   └── find-by-selfie-lambda.ts
│   │   ├── database/           # DynamoDB 관련 Constructs
│   │   │   ├── photos-table.ts
│   │   │   ├── photo-faces-table.ts
│   │   │   ├── runners-table.ts
│   │   │   └── events-table.ts
│   │   └── messaging/          # SQS 관련 Constructs
│   │       └── photo-queue.ts
│   ├── stacks/                 # CDK 스택 정의
│   │   └── snaprace-stack.ts
│   └── interfaces/             # 타입 정의
│       ├── storage.interface.ts
│       ├── compute.interface.ts
│       └── database.interface.ts
├── lambda/                     # Lambda 함수 소스 코드
│   ├── detect-text/
│   ├── index-faces/
│   └── find-by-selfie/
└── tests/                      # 테스트
    ├── unit/
    └── integration/
```

## AWS Solutions Constructs 패턴 활용

### 1. S3 + Lambda 패턴 (`aws-s3-lambda`)

**용도**: S3 버킷에 객체가 업로드될 때 Lambda 함수 트리거

**패키지 설치**:
```bash
npm install @aws-solutions-constructs/aws-s3-lambda
```

**구현 예시**:
```typescript
import { S3ToLambda } from '@aws-solutions-constructs/aws-s3-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';

// S3 버킷과 Lambda 함수를 함께 생성하고 연결
const s3ToLambda = new S3ToLambda(this, 'PhotoUploadTrigger', {
  lambdaFunctionProps: {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/detect-text'),
    timeout: cdk.Duration.minutes(5),
    memorySize: 512,
  },
  bucketProps: {
    versioned: false,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
  },
  eventSourceProps: {
    events: [s3.EventType.OBJECT_CREATED],
    filters: [{ prefix: '*/raw_photos/' }], // 경로 필터링
  },
});

// 생성된 리소스 접근
const photoBucket = s3ToLambda.s3Bucket;
const detectTextFunction = s3ToLambda.lambdaFunction;
```

**장점**:
- S3 이벤트 설정 자동화
- IAM 권한 자동 구성
- 최소한의 코드로 통합 구성

### 2. Lambda + DynamoDB 패턴 (`aws-lambda-dynamodb`)

**용도**: Lambda 함수가 DynamoDB 테이블에 읽기/쓰기 접근

**패키지 설치**:
```bash
npm install @aws-solutions-constructs/aws-lambda-dynamodb
```

**구현 예시**:
```typescript
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

// Lambda 함수와 DynamoDB 테이블을 함께 생성하고 연결
const lambdaToDynamoDB = new LambdaToDynamoDB(this, 'DetectTextToPhotos', {
  existingLambdaObj: detectTextFunction, // 앞서 생성한 Lambda 함수
  dynamoTableProps: {
    partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  },
  tablePermissions: 'ReadWrite', // 또는 'Read' 또는 'Write'
});

// 생성된 리소스 접근
const photosTable = lambdaToDynamoDB.dynamoTable;
```

**장점**:
- IAM 권한 자동 설정
- 최소한의 보일러플레이트 코드
- 권한 범위 명확히 제어 가능

### 3. SQS + Lambda 패턴 (`aws-sqs-lambda`)

**용도**: SQS 큐 메시지가 Lambda 함수를 트리거

**패키지 설치**:
```bash
npm install @aws-solutions-constructs/aws-sqs-lambda
```

**구현 예시**:
```typescript
import { SqsToLambda } from '@aws-solutions-constructs/aws-sqs-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';

// SQS 큐와 Lambda 함수를 함께 생성하고 연결
const sqsToLambda = new SqsToLambda(this, 'PhotoProcessingQueue', {
  lambdaFunctionProps: {
    runtime: lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset('lambda/index-faces'),
    timeout: cdk.Duration.minutes(5),
    memorySize: 512,
  },
  queueProps: {
    visibilityTimeout: cdk.Duration.seconds(120),
    deadLetterQueue: {
      queue: deadLetterQueue, // DLQ 설정
      maxReceiveCount: 5,
    },
  },
  sqsEventSourceProps: {
    batchSize: 5,
    maxBatchingWindow: cdk.Duration.seconds(10),
  },
});

// 생성된 리소스 접근
const photoQueue = sqsToLambda.sqsQueue;
const indexFacesFunction = sqsToLambda.lambdaFunction;
```

**장점**:
- DLQ 자동 구성 옵션
- 배치 처리 설정 자동화
- 이벤트 소스 매핑 자동 생성

### 4. Lambda + SQS 패턴 (`aws-lambda-sqs`)

**용도**: Lambda 함수가 SQS 큐에 메시지 전송

**패키지 설치**:
```bash
npm install @aws-solutions-constructs/aws-lambda-sqs
```

**구현 예시**:
```typescript
import { LambdaToSqs } from '@aws-solutions-constructs/aws-lambda-sqs';

// Lambda 함수에서 SQS 큐로 메시지 전송 권한 부여
const lambdaToSqs = new LambdaToSqs(this, 'DetectTextToQueue', {
  existingLambdaObj: detectTextFunction,
  existingQueueObj: photoQueue, // 앞서 생성한 큐
  sqsQueueProps: {}, // 새 큐 생성 시 사용
  queuePermissions: ['Send'], // 또는 ['Send', 'Receive']
});
```

**장점**:
- 메시지 전송 권한 자동 설정
- Dead Letter Queue 연동 옵션
- 배치 전송 최적화 옵션

## 구조화된 Construct 모듈 설계

### 1. Storage Construct (`lib/constructs/storage/photo-bucket.ts`)

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { S3ToLambda } from '@aws-solutions-constructs/aws-s3-lambda';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PhotoBucketProps {
  detectTextFunction: lambda.Function;
  bucketName?: string;
}

export class PhotoBucket extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly s3ToLambda: S3ToLambda;

  constructor(scope: Construct, id: string, props: PhotoBucketProps) {
    super(scope, id);

    // Solutions Construct 사용
    this.s3ToLambda = new S3ToLambda(this, 'PhotoUploadTrigger', {
      existingLambdaObj: props.detectTextFunction,
      bucketProps: {
        bucketName: props.bucketName,
        versioned: false,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
      },
      eventSourceProps: {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{ prefix: '*/raw_photos/' }],
      },
    });

    this.bucket = this.s3ToLambda.s3Bucket;
  }
}
```

### 2. Database Construct (`lib/constructs/database/photos-table.ts`)

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { LambdaToDynamoDB } from '@aws-solutions-constructs/aws-lambda-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PhotosTableProps {
  lambdaFunctions: lambda.Function[];
  tableName?: string;
}

export class PhotosTable extends Construct {
  public readonly table: dynamodb.Table;
  public readonly lambdaToDynamoDBs: LambdaToDynamoDB[];

  constructor(scope: Construct, id: string, props: PhotosTableProps) {
    super(scope, id);

    // DynamoDB 테이블 먼저 생성
    this.table = new dynamodb.Table(this, 'PhotosTable', {
      tableName: props.tableName || 'snaprace-photos',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: true,
    });

    // GSI 추가
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // 각 Lambda 함수에 권한 부여
    this.lambdaToDynamoDBs = props.lambdaFunctions.map((fn, index) => {
      return new LambdaToDynamoDB(this, `LambdaToDynamoDB${index}`, {
        existingLambdaObj: fn,
        existingTableObj: this.table,
        tablePermissions: 'ReadWrite',
      });
    });
  }
}
```

### 3. Messaging Construct (`lib/constructs/messaging/photo-queue.ts`)

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsToLambda } from '@aws-solutions-constructs/aws-sqs-lambda';
import { LambdaToSqs } from '@aws-solutions-constructs/aws-lambda-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export interface PhotoQueueProps {
  consumerFunction: lambda.Function;
  producerFunctions?: lambda.Function[];
  queueName?: string;
}

export class PhotoQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly sqsToLambda: SqsToLambda;
  public readonly lambdaToSqsList: LambdaToSqs[];

  constructor(scope: Construct, id: string, props: PhotoQueueProps) {
    super(scope, id);

    // DLQ 생성
    this.deadLetterQueue = new sqs.Queue(this, 'PhotoDLQ', {
      retentionPeriod: cdk.Duration.days(14),
      queueName: `${props.queueName || 'snaprace-photo-processing'}-dlq`,
    });

    // Solutions Construct로 SQS + Lambda 통합
    this.sqsToLambda = new SqsToLambda(this, 'PhotoProcessingQueue', {
      existingLambdaObj: props.consumerFunction,
      queueProps: {
        queueName: props.queueName || 'snaprace-photo-processing-queue',
        visibilityTimeout: cdk.Duration.seconds(120),
        deadLetterQueue: {
          queue: this.deadLetterQueue,
          maxReceiveCount: 5,
        },
      },
      sqsEventSourceProps: {
        batchSize: 5,
        maxBatchingWindow: cdk.Duration.seconds(10),
      },
    });

    this.queue = this.sqsToLambda.sqsQueue;

    // Producer Lambda 함수들에 메시지 전송 권한 부여
    if (props.producerFunctions) {
      this.lambdaToSqsList = props.producerFunctions.map((fn, index) => {
        return new LambdaToSqs(this, `LambdaToSqs${index}`, {
          existingLambdaObj: fn,
          existingQueueObj: this.queue,
          queuePermissions: ['Send'],
        });
      });
    }
  }
}
```

### 4. Compute Construct (`lib/constructs/compute/base-lambda.ts`)

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface BaseLambdaProps {
  functionName: string;
  code: lambda.Code;
  handler: string;
  timeout?: cdk.Duration;
  memorySize?: number;
  environment?: { [key: string]: string };
  runtime?: lambda.Runtime;
}

export class BaseLambda extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: BaseLambdaProps) {
    super(scope, id);

    this.function = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      runtime: props.runtime || lambda.Runtime.NODEJS_20_X,
      handler: props.handler,
      code: props.code,
      timeout: props.timeout || cdk.Duration.minutes(5),
      memorySize: props.memorySize || 512,
      environment: props.environment,
      logRetention: logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      // VPC 미사용 (기본 정책)
    });
  }
}
```

## 최종 스택 구성 (`lib/stacks/snaprace-stack.ts`)

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseLambda } from '../constructs/compute/base-lambda';
import { PhotoBucket } from '../constructs/storage/photo-bucket';
import { PhotosTable } from '../constructs/database/photos-table';
import { PhotoQueue } from '../constructs/messaging/photo-queue';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class SnapRaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Lambda 함수들 생성
    const detectTextFunction = new BaseLambda(this, 'DetectTextLambda', {
      functionName: 'snaprace-detect-text',
      code: lambda.Code.fromAsset('lambda/detect-text'),
      handler: 'index.handler',
      environment: {
        PHOTOS_TABLE_NAME: 'snaprace-photos',
        RUNNERS_TABLE_NAME: 'snaprace-runners',
        QUEUE_URL: 'PLACEHOLDER', // 나중에 업데이트
      },
    }).function;

    const indexFacesFunction = new BaseLambda(this, 'IndexFacesLambda', {
      functionName: 'snaprace-index-faces',
      code: lambda.Code.fromAsset('lambda/index-faces'),
      handler: 'index.handler',
      environment: {
        PHOTOS_TABLE_NAME: 'snaprace-photos',
        PHOTO_FACES_TABLE_NAME: 'snaprace-photo-faces',
      },
    }).function;

    const findBySelfieFunction = new BaseLambda(this, 'FindBySelfieLambda', {
      functionName: 'snaprace-find-by-selfie',
      code: lambda.Code.fromAsset('lambda/find-by-selfie'),
      handler: 'index.handler',
      environment: {
        PHOTOS_TABLE_NAME: 'snaprace-photos',
        PHOTO_FACES_TABLE_NAME: 'snaprace-photo-faces',
      },
    }).function;

    // 2. DynamoDB 테이블 생성 및 Lambda 연결
    const photosTable = new PhotosTable(this, 'PhotosTable', {
      lambdaFunctions: [detectTextFunction, indexFacesFunction, findBySelfieFunction],
      tableName: 'snaprace-photos',
    });

    // 3. SQS 큐 생성 및 Lambda 연결
    const photoQueue = new PhotoQueue(this, 'PhotoQueue', {
      consumerFunction: indexFacesFunction,
      producerFunctions: [detectTextFunction],
      queueName: 'snaprace-photo-processing',
    });

    // 환경 변수 업데이트
    detectTextFunction.addEnvironment('QUEUE_URL', photoQueue.queue.queueUrl);

    // 4. S3 버킷 생성 및 Lambda 연결
    const photoBucket = new PhotoBucket(this, 'PhotoBucket', {
      detectTextFunction,
      bucketName: `snaprace-photos-${this.account}-${this.region}`,
    });
  }
}
```

## 패키지 의존성

### 필수 패키지 설치

```bash
# AWS Solutions Constructs 패키지들
npm install @aws-solutions-constructs/aws-s3-lambda
npm install @aws-solutions-constructs/aws-lambda-dynamodb
npm install @aws-solutions-constructs/aws-sqs-lambda
npm install @aws-solutions-constructs/aws-lambda-sqs

# 또는 모든 패키지 한번에 설치
npm install @aws-solutions-constructs/aws-s3-lambda \
            @aws-solutions-constructs/aws-lambda-dynamodb \
            @aws-solutions-constructs/aws-sqs-lambda \
            @aws-solutions-constructs/aws-lambda-sqs
```

### package.json 예시

```json
{
  "dependencies": {
    "aws-cdk-lib": "2.215.0",
    "constructs": "^10.0.0",
    "@aws-solutions-constructs/aws-s3-lambda": "^2.40.0",
    "@aws-solutions-constructs/aws-lambda-dynamodb": "^2.40.0",
    "@aws-solutions-constructs/aws-sqs-lambda": "^2.40.0",
    "@aws-solutions-constructs/aws-lambda-sqs": "^2.40.0"
  }
}
```

## 패턴 선택 가이드

### 언제 Solutions Constructs를 사용할까?

**사용 권장 상황**:
- ✅ 표준적인 AWS 서비스 통합 패턴 구현
- ✅ 빠른 프로토타이핑 및 MVP 개발
- ✅ IAM 권한 설정 자동화가 필요한 경우
- ✅ 코드 중복 제거 및 일관성 유지

**직접 구현 권장 상황**:
- ⚠️ 복잡한 커스텀 로직이 필요한 경우
- ⚠️ 세밀한 제어가 필요한 경우
- ⚠️ 성능 최적화가 중요한 경우

### 패턴 조합 전략

1. **최소 단위로 시작**: 각 패턴을 독립적으로 구성
2. **점진적 통합**: 필요한 경우에만 패턴들을 연결
3. **명확한 책임**: 각 Construct가 단일 책임만 수행
4. **재사용성**: 공통 패턴은 Construct로 추출

## 모범 사례

### 1. 리소스 네이밍
- 일관된 네이밍 컨벤션 사용
- 환경별 구분자 포함 (dev, staging, prod)
- 리소스 타입 명시

### 2. 환경 변수 관리
- 하드코딩 지양
- CDK Context 사용
- 환경별 설정 분리

### 3. 보안
- 최소 권한 원칙 적용
- Secrets Manager 활용
- 암호화 활성화

### 4. 모니터링
- CloudWatch Logs 자동 설정
- X-Ray 트레이싱 활성화
- 알람 설정

### 5. 비용 최적화
- 온디맨드 용량 모드 활용 (DynamoDB)
- Lambda 메모리 최적화
- 불필요한 리소스 제거

## 참고 자료

- [AWS Solutions Constructs 공식 문서](https://docs.aws.amazon.com/ko_kr/solutions/latest/constructs/welcome.html)
- [aws-s3-lambda 패턴](https://docs.aws.amazon.com/ko_kr/solutions/latest/constructs/aws-s3-lambda.html)
- [aws-lambda-dynamodb 패턴](https://docs.aws.amazon.com/ko_kr/solutions/latest/constructs/aws-lambda-dynamodb.html)
- [aws-sqs-lambda 패턴](https://docs.aws.amazon.com/ko_kr/solutions/latest/constructs/aws-sqs-lambda.html)
- [aws-lambda-sqs 패턴](https://docs.aws.amazon.com/ko_kr/solutions/latest/constructs/aws-lambda-sqs.html)

## 다음 단계

1. **Construct 모듈 구현**: 위 설계에 따라 각 Construct 모듈 구현
2. **테스트 작성**: 단위 테스트 및 통합 테스트 작성
3. **문서화**: 각 Construct의 사용법 문서화
4. **CI/CD 통합**: 배포 파이프라인 구성

