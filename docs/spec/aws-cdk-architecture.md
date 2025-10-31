# SnapRace AWS CDK 아키텍처 설계

## 목차
1. [개요](#개요)
2. [AWS Solutions Constructs 패턴](#aws-solutions-constructs-패턴)
3. [프로젝트 구조](#프로젝트-구조)
4. [Construct 설계 원칙](#construct-설계-원칙)
5. [핵심 Construct 구현](#핵심-construct-구현)
6. [구현 가이드](#구현-가이드)
7. [배포 전략](#배포-전략)

## 개요

### 설계 목표
- **최소 단위 구성**: S3, Lambda, DynamoDB, SQS를 재사용 가능한 최소 단위로 분리
- **구조화된 패턴**: AWS Solutions Constructs 기반 모범 사례 적용
- **타입 안정성**: TypeScript로 인프라 코드 작성
- **운영 단순화**: Zero-ops를 목표로 자동화된 시스템 구축

### 핵심 서비스 구성
```
┌─────────────────────────────────────────────────────────────┐
│                     SnapRace Stack                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐  │
│  │   S3     │──▶│  Lambda  │──▶│ DynamoDB │   │  SQS   │  │
│  │ Bucket   │   │ Functions│   │  Tables  │◀──│ Queue  │  │
│  └──────────┘   └──────────┘   └──────────┘   └────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## AWS Solutions Constructs 패턴

### 사용할 패턴

#### 1. S3 to Lambda (EventBridge)
- **목적**: S3 객체 생성 시 Lambda 자동 트리거
- **패턴**: `aws-s3-lambda` 또는 EventBridge 기반 커스텀 패턴
- **사용 사례**: 사진 업로드 시 OCR 처리

#### 2. Lambda to DynamoDB
- **목적**: Lambda에서 DynamoDB 테이블 읽기/쓰기
- **패턴**: IAM 권한 자동 설정 및 환경변수 주입
- **사용 사례**: 사진 메타데이터 저장

#### 3. Lambda to SQS
- **목적**: Lambda에서 SQS 메시지 발행
- **패턴**: `aws-lambda-sqs` 
- **사용 사례**: 비동기 얼굴 인덱싱 작업 큐잉

#### 4. SQS to Lambda
- **목적**: SQS 메시지 기반 Lambda 트리거
- **패턴**: Event Source Mapping 자동 설정
- **사용 사례**: 큐에서 얼굴 인덱싱 작업 처리

### Solutions Constructs 장점
- ✅ **보안 기본값**: 최소 권한 원칙(Least Privilege) 자동 적용
- ✅ **Well-Architected**: AWS Well-Architected Framework 준수
- ✅ **코드 간결화**: 반복적인 보일러플레이트 제거
- ✅ **오류 방지**: 일반적인 설정 실수 방지

## 프로젝트 구조

```
apps/infra/
├── bin/
│   └── infra.ts                    # CDK 앱 진입점
├── lib/
│   ├── stacks/
│   │   └── snaprace-stack.ts       # 메인 스택
│   ├── constructs/
│   │   ├── storage/
│   │   │   ├── photos-bucket.construct.ts
│   │   │   └── tables.construct.ts
│   │   ├── compute/
│   │   │   ├── base-function.construct.ts
│   │   │   ├── detect-text.construct.ts
│   │   │   ├── index-faces.construct.ts
│   │   │   └── find-by-selfie.construct.ts
│   │   ├── messaging/
│   │   │   └── photo-queue.construct.ts
│   │   └── api/
│   │       └── rest-api.construct.ts
│   ├── config/
│   │   ├── environment.ts          # 환경별 설정
│   │   └── constants.ts            # 상수 정의
│   └── interfaces/
│       ├── photo.interface.ts
│       ├── runner.interface.ts
│       └── event.interface.ts
├── lambda/
│   ├── shared/                     # 공유 레이어
│   │   ├── services/
│   │   │   ├── dynamodb.service.ts
│   │   │   ├── rekognition.service.ts
│   │   │   ├── sqs.service.ts
│   │   │   └── s3.service.ts
│   │   ├── utils/
│   │   │   ├── logger.ts
│   │   │   └── validators.ts
│   │   └── types/
│   │       └── index.ts
│   ├── detect-text/
│   │   ├── index.ts
│   │   ├── handler.ts
│   │   └── package.json
│   ├── index-faces/
│   │   ├── index.ts
│   │   ├── handler.ts
│   │   └── package.json
│   └── find-by-selfie/
│       ├── index.ts
│       ├── handler.ts
│       └── package.json
├── test/
│   ├── unit/
│   │   ├── constructs/
│   │   └── lambda/
│   └── integration/
│       └── stack.test.ts
├── cdk.json
├── package.json
└── tsconfig.json
```

## Construct 설계 원칙

### 1. Single Responsibility (단일 책임)
각 Construct는 하나의 명확한 책임만 가짐
```typescript
// ❌ 나쁜 예: 모든 것을 한 Construct에
export class EverythingConstruct extends Construct {
  // S3, Lambda, DynamoDB, SQS 모두 포함
}

// ✅ 좋은 예: 책임별로 분리
export class PhotosBucketConstruct extends Construct { }
export class PhotoQueueConstruct extends Construct { }
export class DetectTextFunctionConstruct extends Construct { }
```

### 2. Composability (조합성)
작은 Construct를 조합하여 큰 시스템 구성
```typescript
export class SnapRaceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // 작은 Construct들을 조합
    const storage = new StorageConstruct(this, 'Storage');
    const messaging = new MessagingConstruct(this, 'Messaging');
    const compute = new ComputeConstruct(this, 'Compute', {
      storage,
      messaging
    });
  }
}
```

### 3. Configuration over Code (설정 우선)
하드코딩 대신 설정으로 관리
```typescript
// config/environment.ts
export interface EnvironmentConfig {
  stage: 'dev' | 'staging' | 'prod';
  region: string;
  photosBucketName: string;
  rekognitionMinConfidence: number;
  lambdaTimeout: Duration;
  lambdaMemorySize: number;
}

export const getConfig = (stage: string): EnvironmentConfig => {
  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      stage: 'dev',
      region: 'ap-northeast-2',
      photosBucketName: 'snaprace-photos-dev',
      rekognitionMinConfidence: 80,
      lambdaTimeout: Duration.seconds(30),
      lambdaMemorySize: 512
    },
    prod: {
      stage: 'prod',
      region: 'ap-northeast-2',
      photosBucketName: 'snaprace-photos-prod',
      rekognitionMinConfidence: 90,
      lambdaTimeout: Duration.minutes(5),
      lambdaMemorySize: 1024
    }
  };
  return configs[stage];
};
```

### 4. Least Privilege (최소 권한)
필요한 최소한의 IAM 권한만 부여
```typescript
// Lambda에 특정 테이블과 작업만 허용
table.grantReadWriteData(lambdaFunction);  // ✅ 특정 테이블만
// vs
lambdaFunction.role?.addManagedPolicy(
  ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess')
);  // ❌ 모든 테이블 접근
```

## 핵심 Construct 구현

### 1. Storage Construct

#### DynamoDB Tables
```typescript
// lib/constructs/storage/tables.construct.ts
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export interface TablesConstructProps {
  stage: string;
}

export class TablesConstruct extends Construct {
  public readonly photosTable: dynamodb.Table;
  public readonly photoFacesTable: dynamodb.Table;
  public readonly runnersTable: dynamodb.Table;
  public readonly eventsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: TablesConstructProps) {
    super(scope, id);

    // Photos 테이블: 사진 메타데이터
    this.photosTable = new dynamodb.Table(this, 'PhotosTable', {
      tableName: `snaprace-photos-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stage === 'prod' 
        ? RemovalPolicy.RETAIN 
        : RemovalPolicy.DESTROY,
      pointInTimeRecovery: props.stage === 'prod',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // GSI1: Bib별 사진 조회
    this.photosTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING
      },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // PhotoFaces 테이블: 얼굴-사진 매핑
    this.photoFacesTable = new dynamodb.Table(this, 'PhotoFacesTable', {
      tableName: `snaprace-photo-faces-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stage === 'prod'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY
    });

    // Runners 테이블: 참가자 정보
    this.runnersTable = new dynamodb.Table(this, 'RunnersTable', {
      tableName: `snaprace-runners-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stage === 'prod'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY
    });

    // Events 테이블: 이벤트 정보
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: `snaprace-events-${props.stage}`,
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: props.stage === 'prod'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY
    });
  }
}
```

#### S3 Bucket
```typescript
// lib/constructs/storage/photos-bucket.construct.ts
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy, Duration } from 'aws-cdk-lib';

export interface PhotosBucketConstructProps {
  stage: string;
  cloudfrontOai?: string;
}

export class PhotosBucketConstruct extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: PhotosBucketConstructProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, 'PhotosBucket', {
      bucketName: `snaprace-photos-${props.stage}`,
      
      // 보안 설정
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // 버전 관리 (운영 환경만)
      versioned: props.stage === 'prod',
      
      // 수명 주기 정책
      lifecycleRules: [
        {
          id: 'DeleteOldVersions',
          enabled: true,
          noncurrentVersionExpiration: Duration.days(30)
        }
      ],
      
      // CORS 설정 (웹 업로드용)
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST
          ],
          allowedOrigins: ['*'],  // 실제 운영 시 특정 도메인으로 제한
          allowedHeaders: ['*'],
          maxAge: 3000
        }
      ],
      
      // EventBridge 알림 활성화
      eventBridgeEnabled: true,
      
      // 삭제 정책
      removalPolicy: props.stage === 'prod'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.stage !== 'prod'
    });
  }
}
```

### 2. Messaging Construct

```typescript
// lib/constructs/messaging/photo-queue.construct.ts
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Duration } from 'aws-cdk-lib';

export interface PhotoQueueConstructProps {
  stage: string;
}

export class PhotoQueueConstruct extends Construct {
  public readonly queue: sqs.Queue;
  public readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: PhotoQueueConstructProps) {
    super(scope, id);

    // Dead Letter Queue
    this.dlq = new sqs.Queue(this, 'PhotoDLQ', {
      queueName: `snaprace-photo-dlq-${props.stage}`,
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });

    // Main Queue
    this.queue = new sqs.Queue(this, 'PhotoQueue', {
      queueName: `snaprace-photo-queue-${props.stage}`,
      
      // 타임아웃 설정 (Lambda timeout보다 6배 길게)
      visibilityTimeout: Duration.seconds(180),
      
      // 배치 처리 설정
      receiveMessageWaitTime: Duration.seconds(20),  // Long polling
      
      // DLQ 설정
      deadLetterQueue: {
        queue: this.dlq,
        maxReceiveCount: 5  // 5번 실패 시 DLQ로 이동
      },
      
      // 보안
      encryption: sqs.QueueEncryption.SQS_MANAGED
    });
  }
}
```

### 3. Compute Construct

#### Base Lambda Function
```typescript
// lib/constructs/compute/base-function.construct.ts
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Duration } from 'aws-cdk-lib';
import * as path from 'path';

export interface BaseFunctionProps {
  functionName: string;
  handler: string;
  codePath: string;
  environment?: Record<string, string>;
  timeout?: Duration;
  memorySize?: number;
  stage: string;
}

export class BaseFunctionConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: BaseFunctionProps) {
    super(scope, id);

    this.function = new lambda.Function(this, id, {
      functionName: `snaprace-${props.functionName}-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: props.handler,
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../../lambda', props.codePath)
      ),
      
      // 성능 설정
      timeout: props.timeout || Duration.seconds(30),
      memorySize: props.memorySize || 512,
      
      // 환경 변수
      environment: {
        STAGE: props.stage,
        NODE_ENV: 'production',
        LOG_LEVEL: props.stage === 'prod' ? 'info' : 'debug',
        ...props.environment
      },
      
      // 로깅 설정
      logRetention: props.stage === 'prod'
        ? logs.RetentionDays.ONE_MONTH
        : logs.RetentionDays.ONE_WEEK,
      
      // X-Ray 추적
      tracing: lambda.Tracing.ACTIVE,
      
      // 동시 실행 제한 (비용 관리)
      reservedConcurrentExecutions: props.stage === 'prod' ? 100 : 10,
      
      // 재시도 설정
      retryAttempts: 2
    });

    // Powertools 레이어 추가 (옵션)
    if (props.stage === 'prod') {
      const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
        this,
        'PowertoolsLayer',
        `arn:aws:lambda:${process.env.CDK_DEFAULT_REGION}:094274105915:layer:AWSLambdaPowertoolsTypeScript:latest`
      );
      this.function.addLayers(powertoolsLayer);
    }
  }
}
```

#### Detect Text Function
```typescript
// lib/constructs/compute/detect-text.construct.ts
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import { BaseFunctionConstruct } from './base-function.construct';

export interface DetectTextConstructProps {
  stage: string;
  photosBucket: s3.IBucket;
  photosTable: dynamodb.ITable;
  runnersTable: dynamodb.ITable;
  queue: sqs.IQueue;
}

export class DetectTextConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: DetectTextConstructProps) {
    super(scope, id);

    const baseFunction = new BaseFunctionConstruct(this, 'DetectTextFunction', {
      functionName: 'detect-text',
      handler: 'index.handler',
      codePath: 'detect-text',
      timeout: Duration.seconds(30),
      memorySize: 512,
      stage: props.stage,
      environment: {
        PHOTOS_TABLE_NAME: props.photosTable.tableName,
        RUNNERS_TABLE_NAME: props.runnersTable.tableName,
        QUEUE_URL: props.queue.queueUrl,
        PHOTOS_BUCKET_NAME: props.photosBucket.bucketName,
        MIN_TEXT_CONFIDENCE: '80'
      }
    });

    this.function = baseFunction.function;

    // 권한 부여
    props.photosBucket.grantRead(this.function);
    props.photosTable.grantWriteData(this.function);
    props.runnersTable.grantReadData(this.function);
    props.queue.grantSendMessages(this.function);

    // Rekognition 권한
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:DetectText'],
      resources: ['*']
    }));
  }
}
```

#### Index Faces Function
```typescript
// lib/constructs/compute/index-faces.construct.ts
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import { BaseFunctionConstruct } from './base-function.construct';

export interface IndexFacesConstructProps {
  stage: string;
  photosTable: dynamodb.ITable;
  photoFacesTable: dynamodb.ITable;
  queue: sqs.IQueue;
}

export class IndexFacesConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: IndexFacesConstructProps) {
    super(scope, id);

    const baseFunction = new BaseFunctionConstruct(this, 'IndexFacesFunction', {
      functionName: 'index-faces',
      handler: 'index.handler',
      codePath: 'index-faces',
      timeout: Duration.seconds(60),
      memorySize: 1024,
      stage: props.stage,
      environment: {
        PHOTOS_TABLE_NAME: props.photosTable.tableName,
        PHOTO_FACES_TABLE_NAME: props.photoFacesTable.tableName
      }
    });

    this.function = baseFunction.function;

    // SQS 이벤트 소스 연결
    this.function.addEventSource(new lambdaEventSources.SqsEventSource(props.queue, {
      batchSize: 5,
      maxBatchingWindow: Duration.seconds(10),
      reportBatchItemFailures: true
    }));

    // 권한 부여
    props.photosTable.grantReadWriteData(this.function);
    props.photoFacesTable.grantWriteData(this.function);

    // Rekognition 권한
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'rekognition:IndexFaces',
        'rekognition:SearchFaces',
        'rekognition:CreateCollection',
        'rekognition:DescribeCollection'
      ],
      resources: ['*']
    }));
  }
}
```

#### Find By Selfie Function
```typescript
// lib/constructs/compute/find-by-selfie.construct.ts
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Duration } from 'aws-cdk-lib';
import { BaseFunctionConstruct } from './base-function.construct';

export interface FindBySelfieConstructProps {
  stage: string;
  photosTable: dynamodb.ITable;
  photoFacesTable: dynamodb.ITable;
  runnersTable: dynamodb.ITable;
  eventsTable: dynamodb.ITable;
}

export class FindBySelfieConstruct extends Construct {
  public readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: FindBySelfieConstructProps) {
    super(scope, id);

    const baseFunction = new BaseFunctionConstruct(this, 'FindBySelfieFunction', {
      functionName: 'find-by-selfie',
      handler: 'index.handler',
      codePath: 'find-by-selfie',
      timeout: Duration.seconds(30),
      memorySize: 1024,
      stage: props.stage,
      environment: {
        PHOTOS_TABLE_NAME: props.photosTable.tableName,
        PHOTO_FACES_TABLE_NAME: props.photoFacesTable.tableName,
        RUNNERS_TABLE_NAME: props.runnersTable.tableName,
        EVENTS_TABLE_NAME: props.eventsTable.tableName
      }
    });

    this.function = baseFunction.function;

    // 권한 부여
    props.photosTable.grantReadData(this.function);
    props.photoFacesTable.grantReadData(this.function);
    props.runnersTable.grantReadData(this.function);
    props.eventsTable.grantReadData(this.function);

    // Rekognition 권한
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:SearchFacesByImage'],
      resources: ['*']
    }));
  }
}
```

### 4. API Construct

```typescript
// lib/constructs/api/rest-api.construct.ts
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Duration } from 'aws-cdk-lib';

export interface RestApiConstructProps {
  stage: string;
  findBySelfieFunction: lambda.IFunction;
}

export class RestApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: RestApiConstructProps) {
    super(scope, id);

    this.api = new apigateway.RestApi(this, 'SnapRaceApi', {
      restApiName: `snaprace-api-${props.stage}`,
      description: 'SnapRace Photo Search API',
      
      // 배포 설정
      deployOptions: {
        stageName: props.stage,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: props.stage !== 'prod'
      },
      
      // CORS 설정
      defaultCorsPreflightOptions: {
        allowOrigins: props.stage === 'prod'
          ? ['https://snaprace.com']  // 실제 도메인으로 교체
          : apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token'
        ],
        maxAge: Duration.hours(1)
      },
      
      // API 키 설정 (선택)
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER
    });

    // /selfie 엔드포인트
    const selfieResource = this.api.root.addResource('selfie');
    selfieResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(props.findBySelfieFunction, {
        proxy: true,
        timeout: Duration.seconds(29)
      }),
      {
        apiKeyRequired: props.stage === 'prod'
      }
    );

    // API 키 생성 (운영 환경)
    if (props.stage === 'prod') {
      const apiKey = this.api.addApiKey('SnapRaceApiKey', {
        apiKeyName: `snaprace-api-key-${props.stage}`
      });

      const plan = this.api.addUsagePlan('UsagePlan', {
        name: `snaprace-usage-plan-${props.stage}`,
        throttle: {
          rateLimit: 100,
          burstLimit: 200
        },
        quota: {
          limit: 10000,
          period: apigateway.Period.DAY
        }
      });

      plan.addApiKey(apiKey);
      plan.addApiStage({
        stage: this.api.deploymentStage
      });
    }
  }
}
```

### 5. Main Stack

```typescript
// lib/stacks/snaprace-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { TablesConstruct } from '../constructs/storage/tables.construct';
import { PhotosBucketConstruct } from '../constructs/storage/photos-bucket.construct';
import { PhotoQueueConstruct } from '../constructs/messaging/photo-queue.construct';
import { DetectTextConstruct } from '../constructs/compute/detect-text.construct';
import { IndexFacesConstruct } from '../constructs/compute/index-faces.construct';
import { FindBySelfieConstruct } from '../constructs/compute/find-by-selfie.construct';
import { RestApiConstruct } from '../constructs/api/rest-api.construct';
import { getConfig } from '../config/environment';

export interface SnapRaceStackProps extends cdk.StackProps {
  stage: string;
}

export class SnapRaceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SnapRaceStackProps) {
    super(scope, id, props);

    const config = getConfig(props.stage);

    // 1. Storage Layer
    const tables = new TablesConstruct(this, 'Tables', {
      stage: props.stage
    });

    const photosBucket = new PhotosBucketConstruct(this, 'PhotosBucket', {
      stage: props.stage
    });

    // 2. Messaging Layer
    const photoQueue = new PhotoQueueConstruct(this, 'PhotoQueue', {
      stage: props.stage
    });

    // 3. Compute Layer
    const detectText = new DetectTextConstruct(this, 'DetectText', {
      stage: props.stage,
      photosBucket: photosBucket.bucket,
      photosTable: tables.photosTable,
      runnersTable: tables.runnersTable,
      queue: photoQueue.queue
    });

    const indexFaces = new IndexFacesConstruct(this, 'IndexFaces', {
      stage: props.stage,
      photosTable: tables.photosTable,
      photoFacesTable: tables.photoFacesTable,
      queue: photoQueue.queue
    });

    const findBySelfie = new FindBySelfieConstruct(this, 'FindBySelfie', {
      stage: props.stage,
      photosTable: tables.photosTable,
      photoFacesTable: tables.photoFacesTable,
      runnersTable: tables.runnersTable,
      eventsTable: tables.eventsTable
    });

    // 4. API Layer
    const api = new RestApiConstruct(this, 'RestApi', {
      stage: props.stage,
      findBySelfieFunction: findBySelfie.function
    });

    // 5. Event Routing
    // S3 Upload → EventBridge → detect_text Lambda
    const photoUploadRule = new events.Rule(this, 'PhotoUploadRule', {
      ruleName: `snaprace-photo-upload-${props.stage}`,
      description: 'Trigger Lambda when photo is uploaded to S3',
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['Object Created'],
        detail: {
          bucket: {
            name: [photosBucket.bucket.bucketName]
          },
          object: {
            key: [{ prefix: '' }, { suffix: '' }].map(pattern => ({
              ...pattern,
              wildcard: '*/photos/raw/*'
            }))
          }
        }
      }
    });

    photoUploadRule.addTarget(
      new targets.LambdaFunction(detectText.function, {
        maxEventAge: cdk.Duration.hours(2),
        retryAttempts: 2
      })
    );

    // 6. Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
      description: 'API Gateway endpoint URL',
      exportName: `snaprace-api-url-${props.stage}`
    });

    new cdk.CfnOutput(this, 'PhotosBucketName', {
      value: photosBucket.bucket.bucketName,
      description: 'Photos S3 bucket name',
      exportName: `snaprace-photos-bucket-${props.stage}`
    });

    new cdk.CfnOutput(this, 'QueueUrl', {
      value: photoQueue.queue.queueUrl,
      description: 'Photo processing queue URL',
      exportName: `snaprace-queue-url-${props.stage}`
    });
  }
}
```

## 구현 가이드

### 1. 초기 설정

```bash
# 프로젝트 루트에서
cd apps/infra

# 의존성 설치
pnpm install

# CDK 부트스트랩 (최초 1회만)
pnpm cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 2. 환경 설정

```typescript
// config/environment.ts
export interface EnvironmentConfig {
  stage: 'dev' | 'staging' | 'prod';
  region: string;
  account: string;
  photosBucketName: string;
  rekognitionMinConfidence: number;
  lambdaTimeout: Duration;
  lambdaMemorySize: number;
}

export const getConfig = (stage: string): EnvironmentConfig => {
  const baseConfig = {
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
    account: process.env.CDK_DEFAULT_ACCOUNT || ''
  };

  const configs: Record<string, EnvironmentConfig> = {
    dev: {
      ...baseConfig,
      stage: 'dev',
      photosBucketName: 'snaprace-photos-dev',
      rekognitionMinConfidence: 80,
      lambdaTimeout: Duration.seconds(30),
      lambdaMemorySize: 512
    },
    prod: {
      ...baseConfig,
      stage: 'prod',
      photosBucketName: 'snaprace-photos-prod',
      rekognitionMinConfidence: 90,
      lambdaTimeout: Duration.minutes(5),
      lambdaMemorySize: 1024
    }
  };

  return configs[stage] || configs.dev;
};
```

### 3. CDK 앱 진입점

```typescript
// bin/infra.ts
#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SnapRaceStack } from '../lib/stacks/snaprace-stack';

const app = new cdk.App();

const stage = app.node.tryGetContext('stage') || 'dev';

new SnapRaceStack(app, `SnapRaceStack-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
  description: `SnapRace Infrastructure Stack (${stage})`,
  tags: {
    Project: 'SnapRace',
    Environment: stage,
    ManagedBy: 'CDK'
  }
});

app.synth();
```

### 4. CDK 설정 파일

```json
// cdk.json
{
  "app": "pnpm exec ts-node --prefer-ts-exts bin/infra.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "pnpm-lock.yaml",
      "node_modules",
      "test"
    ]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
    "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver": true,
    "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-iam:minimizePolicies": true,
    "@aws-cdk/core:validateSnapshotRemovalPolicy": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName": true,
    "@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
    "@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption": true,
    "@aws-cdk/aws-apigateway:disableCloudWatchRole": false,
    "@aws-cdk/core:enablePartitionLiterals": true,
    "@aws-cdk/aws-events:eventsTargetQueueSameAccount": true,
    "@aws-cdk/aws-iam:standardizedServicePrincipals": true,
    "@aws-cdk/aws-ecs:disableExplicitDeploymentControllerForCircuitBreaker": true,
    "@aws-cdk/aws-iam:importedRoleStackSafeDefaultPolicyName": true,
    "@aws-cdk/aws-s3:serverAccessLogsUseBucketPolicy": true,
    "@aws-cdk/aws-route53-patters:useCertificate": true,
    "@aws-cdk/customresources:installLatestAwsSdkDefault": false,
    "@aws-cdk/aws-rds:databaseProxyUniqueResourceName": true,
    "@aws-cdk/aws-codedeploy:removeAlarmsFromDeploymentGroup": true,
    "@aws-cdk/aws-apigateway:authorizerChangeDeploymentLogicalId": true,
    "@aws-cdk/aws-ec2:launchTemplateDefaultUserData": true,
    "@aws-cdk/aws-secretsmanager:useAttachedSecretResourcePolicyForSecretTargetAttachments": true,
    "@aws-cdk/aws-redshift:columnId": true,
    "@aws-cdk/aws-stepfunctions-tasks:enableEmrServicePolicyV2": true,
    "@aws-cdk/aws-ec2:restrictDefaultSecurityGroup": true,
    "@aws-cdk/aws-apigateway:requestValidatorUniqueId": true,
    "@aws-cdk/aws-kms:aliasNameRef": true,
    "@aws-cdk/aws-autoscaling:generateLaunchTemplateInsteadOfLaunchConfig": true,
    "@aws-cdk/core:includePrefixInUniqueNameGeneration": true,
    "@aws-cdk/aws-efs:denyAnonymousAccess": true,
    "@aws-cdk/aws-opensearchservice:enableOpensearchMultiAzWithStandby": true,
    "@aws-cdk/aws-lambda-nodejs:useLatestRuntimeVersion": true,
    "@aws-cdk/aws-efs:mountTargetOrderInsensitiveLogicalId": true,
    "@aws-cdk/aws-rds:auroraClusterChangeScopeOfInstanceParameterGroupWithEachParameters": true,
    "@aws-cdk/aws-appsync:useArnForSourceApiAssociationIdentifier": true,
    "@aws-cdk/aws-rds:preventRenderingDeprecatedCredentials": true,
    "@aws-cdk/aws-codepipeline-actions:useNewDefaultBranchForCodeCommitSource": true,
    "@aws-cdk/aws-cloudwatch-actions:changeLambdaPermissionLogicalIdForLambdaAction": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeysDefaultValueToFalse": true,
    "@aws-cdk/aws-codepipeline:defaultPipelineTypeToV2": true,
    "@aws-cdk/aws-kms:reduceCrossAccountRegionPolicyScope": true,
    "@aws-cdk/aws-eks:nodegroupNameAttribute": true,
    "@aws-cdk/aws-ec2:ebsDefaultGp3Volume": true,
    "@aws-cdk/aws-ecs:removeDefaultDeploymentAlarm": true,
    "@aws-cdk/custom-resources:logApiResponseDataPropertyTrueDefault": false,
    "@aws-cdk/aws-s3:keepNotificationInImportedBucket": false
  }
}
```

### 5. Package.json

```json
{
  "name": "@snaprace/infra",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "cdk": "cdk",
    "synth": "cdk synth",
    "synth:dev": "cdk synth -c stage=dev",
    "synth:prod": "cdk synth -c stage=prod",
    "diff": "cdk diff",
    "diff:dev": "cdk diff -c stage=dev",
    "diff:prod": "cdk diff -c stage=prod",
    "deploy": "cdk deploy",
    "deploy:dev": "cdk deploy -c stage=dev",
    "deploy:prod": "cdk deploy -c stage=prod --require-approval broadening",
    "destroy": "cdk destroy",
    "destroy:dev": "cdk destroy -c stage=dev",
    "bootstrap": "cdk bootstrap"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "20.11.0",
    "aws-cdk": "^2.150.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "~5.3.3"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.150.0",
    "constructs": "^10.0.0",
    "source-map-support": "^0.5.21"
  }
}
```

## 배포 전략

### 1. 환경별 배포

```bash
# Development 환경
pnpm run synth:dev    # CloudFormation 템플릿 생성
pnpm run diff:dev     # 변경사항 확인
pnpm run deploy:dev   # 배포

# Production 환경
pnpm run synth:prod   # CloudFormation 템플릿 생성
pnpm run diff:prod    # 변경사항 확인
pnpm run deploy:prod  # 배포 (승인 필요)
```

### 2. CI/CD 파이프라인

```yaml
# .github/workflows/cdk-deploy.yml
name: CDK Deploy

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'apps/infra/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm run build
        working-directory: apps/infra
      
      - name: Run tests
        run: pnpm test
        working-directory: apps/infra
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-2
      
      - name: CDK Diff (Dev)
        if: github.ref == 'refs/heads/develop'
        run: pnpm run diff:dev
        working-directory: apps/infra
      
      - name: CDK Deploy (Dev)
        if: github.ref == 'refs/heads/develop'
        run: pnpm run deploy:dev --require-approval never
        working-directory: apps/infra
      
      - name: CDK Diff (Prod)
        if: github.ref == 'refs/heads/main'
        run: pnpm run diff:prod
        working-directory: apps/infra
      
      - name: CDK Deploy (Prod)
        if: github.ref == 'refs/heads/main'
        run: pnpm run deploy:prod --require-approval never
        working-directory: apps/infra
```

### 3. 모니터링 및 알람

```typescript
// lib/constructs/monitoring/alarms.construct.ts
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface AlarmsConstructProps {
  stage: string;
  functions: lambda.IFunction[];
  dlq: sqs.IQueue;
}

export class AlarmsConstruct extends Construct {
  constructor(scope: Construct, id: string, props: AlarmsConstructProps) {
    super(scope, id);

    // SNS 토픽 생성
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `snaprace-alarms-${props.stage}`,
      displayName: 'SnapRace Alarms'
    });

    // Lambda 에러 알람
    props.functions.forEach(func => {
      new cloudwatch.Alarm(this, `${func.node.id}ErrorAlarm`, {
        metric: func.metricErrors({
          period: Duration.minutes(5),
          statistic: 'Sum'
        }),
        threshold: 5,
        evaluationPeriods: 1,
        alarmDescription: `${func.functionName} has too many errors`,
        actionsEnabled: props.stage === 'prod'
      }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));

      // Lambda 타임아웃 알람
      new cloudwatch.Alarm(this, `${func.node.id}DurationAlarm`, {
        metric: func.metricDuration({
          period: Duration.minutes(5),
          statistic: 'Average'
        }),
        threshold: func.timeout!.toMilliseconds() * 0.9,  // 90% 임계값
        evaluationPeriods: 2,
        alarmDescription: `${func.functionName} is approaching timeout`,
        actionsEnabled: props.stage === 'prod'
      }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
    });

    // DLQ 알람
    new cloudwatch.Alarm(this, 'DLQAlarm', {
      metric: props.dlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(1),
        statistic: 'Sum'
      }),
      threshold: 1,
      evaluationPeriods: 1,
      alarmDescription: 'Messages in DLQ',
      actionsEnabled: true
    }).addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
  }
}
```

### 4. 비용 최적화

```typescript
// 비용 최적화 팁

// 1. DynamoDB: 온디맨드 모드 사용 (트래픽이 예측 불가능한 경우)
billingMode: dynamodb.BillingMode.PAY_PER_REQUEST

// 2. Lambda: 적절한 메모리 크기 설정 (성능/비용 밸런스)
memorySize: 512  // 시작점, CloudWatch Insights로 최적화

// 3. Lambda: 동시 실행 제한으로 비용 폭주 방지
reservedConcurrentExecutions: 100

// 4. S3: 수명 주기 정책으로 오래된 객체 정리
lifecycleRules: [
  {
    id: 'ArchiveOldPhotos',
    transitions: [
      {
        storageClass: s3.StorageClass.INTELLIGENT_TIERING,
        transitionAfter: Duration.days(90)
      }
    ]
  }
]

// 5. CloudWatch Logs: 로그 보관 기간 제한
logRetention: logs.RetentionDays.ONE_WEEK  // dev
logRetention: logs.RetentionDays.ONE_MONTH // prod

// 6. API Gateway: 스로틀링 설정
throttlingRateLimit: 100,
throttlingBurstLimit: 200
```

## 다음 단계

### Phase 1: 기본 인프라 구축 (1주)
- [ ] CDK 프로젝트 초기 설정
- [ ] Storage Constructs 구현 (S3, DynamoDB)
- [ ] Messaging Construct 구현 (SQS)
- [ ] 기본 Lambda Functions 구현
- [ ] 로컬 테스트 환경 구축

### Phase 2: Lambda 구현 (2주)
- [ ] detect-text Lambda 구현
- [ ] index-faces Lambda 구현
- [ ] find-by-selfie Lambda 구현
- [ ] 공유 서비스 레이어 구현
- [ ] 단위 테스트 작성

### Phase 3: 통합 및 배포 (1주)
- [ ] EventBridge 규칙 설정
- [ ] API Gateway 구성
- [ ] 모니터링 및 알람 설정
- [ ] CI/CD 파이프라인 구축
- [ ] Dev 환경 배포 및 테스트

### Phase 4: 운영 준비 (1주)
- [ ] 프로덕션 환경 설정
- [ ] 부하 테스트
- [ ] 문서화
- [ ] 운영 Runbook 작성
- [ ] Production 배포

## 참고 자료

- [AWS CDK v2 공식 문서](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS Solutions Constructs](https://docs.aws.amazon.com/solutions/latest/constructs/welcome.html)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [CDK Patterns](https://cdkpatterns.com/)
- [Serverless Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

