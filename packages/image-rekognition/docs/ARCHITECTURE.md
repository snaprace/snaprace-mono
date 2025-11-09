# 아키텍처 상세 설계

## 📐 시스템 아키텍처

### 전체 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                         S3 Bucket                                │
│  ┌──────────────┐                    ┌──────────────┐           │
│  │   raw/       │                    │ processed/   │           │
│  │ (원본 이미지)  │                    │ (전처리 완료)  │           │
│  └──────┬───────┘                    └──────▲───────┘           │
│         │                                   │                   │
└─────────┼───────────────────────────────────┼───────────────────┘
          │ S3 Event Notification             │
          ▼                                   │
┌─────────────────┐                           │
│   SQS Queue     │                           │
│ (ImageUpload)   │                           │
└────────┬────────┘                           │
         │ Poll (Event Source Mapping)        │
         ▼                                    │
┌─────────────────┐                           │
│  Lambda         │                           │
│  SFN Trigger    │───┐                       │
└─────────────────┘   │ StartExecution        │
                      ▼                       │
              ┌────────────────┐              │
              │ Step Functions │              │
              │   Workflow     │              │
              └───────┬────────┘              │
                      │                       │
        ┏━━━━━━━━━━━━━┻━━━━━━━━━━━━━┓        │
        ┃      State Machine         ┃        │
        ┃                            ┃        │
        ┃  ┌──────────────────┐     ┃        │
        ┃  │ 1. Preprocess    │─────╋────────┘
        ┃  │    Lambda        │     ┃
        ┃  └────────┬─────────┘     ┃
        ┃           │                ┃
        ┃  ┌────────▼─────────┐     ┃
        ┃  │ 2. Parallel      │     ┃
        ┃  │  ┌─────────────┐ │     ┃
        ┃  │  │ Detect Text │ │─────╋────┐
        ┃  │  │   Lambda    │ │     ┃    │ Rekognition
        ┃  │  └─────────────┘ │     ┃    │ DetectText API
        ┃  │  ┌─────────────┐ │     ┃    │
        ┃  │  │ Index Faces │ │─────╋────┘
        ┃  │  │   Lambda    │ │     ┃      Rekognition
        ┃  │  └─────────────┘ │     ┃      IndexFaces API
        ┃  └────────┬─────────┘     ┃           │
        ┃           │                ┃           ▼
        ┃  ┌────────▼─────────┐     ┃    ┌──────────────┐
        ┃  │ 3. Fanout        │─────╋───▶│  Rekognition │
        ┃  │    DynamoDB      │     ┃    │  Collection  │
        ┃  │    Lambda        │     ┃    │EventRunnerFaces
        ┃  └────────┬─────────┘     ┃    └──────────────┘
        ┃           │                ┃
        ┗━━━━━━━━━━━┻━━━━━━━━━━━━━━┛
                    │
                    ▼
            ┌───────────────┐
            │   DynamoDB    │
            │ PhotoService  │
            │               │
            │ • PHOTO       │
            │ • BIB_INDEX   │
            └───────────────┘
```

## 🧱 AWS 리소스 정의

### 1. S3 Bucket

**리소스명**: `ImageRekognitionBucket`

#### 구조

```
s3://snaprace-images-{stage}/
├── raw/                          # 원본 이미지 업로드 위치
│   └── {org-id}/{event-id}/{original-filename}
└── processed/                    # 전처리 완료 이미지
    └── {org-id}/{event-id}/{ulid}.jpg
```

#### 구성

```typescript
new s3.Bucket(this, 'ImageRekognitionBucket', {
  bucketName: `snaprace-images-${stage}`,
  versioned: false,
  encryption: s3.BucketEncryption.S3_MANAGED,
  intelligentTieringConfigurations: [
    {
      name: 'RawImagesArchival',
      prefix: 'raw/',
      archiveAccessTierTime: cdk.Duration.days(90), // 90일 후 Archive Access Tier
      deepArchiveAccessTierTime: cdk.Duration.days(180) // 180일 후 Deep Archive Access Tier
    },
    {
      name: 'ProcessedImagesOptimization',
      prefix: 'processed/'
      // Frequent/Infrequent Access Tier만 사용 (Archive 미사용)
      // 30일 미접근 시 자동으로 Infrequent Access로 이동
    }
  ],
  lifecycleRules: [
    {
      id: 'enable-intelligent-tiering',
      enabled: true,
      transitions: [
        {
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(0) // 즉시 Intelligent-Tiering으로 전환
        }
      ]
    }
  ],
  eventBridgeEnabled: false, // S3 Event Notification 사용
  cors: [
    {
      allowedOrigins: ['*'],
      allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
      allowedHeaders: ['*']
    }
  ]
})
```

#### S3 Event Notification

```typescript
bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SqsDestination(imageUploadQueue), {
  prefix: 'raw/',
  suffix: '.jpg' | '.jpeg' | '.png' | '.heic'
})
```

#### S3 Intelligent-Tiering 상세

**작동 방식**:

S3 Intelligent-Tiering은 객체 액세스 패턴을 자동으로 모니터링하고 최적의 스토리지 티어로 이동시킵니다.

**Tier 구조** (서울 리전 기준):

```
┌─────────────────────────────────────────────────────────┐
│           S3 Intelligent-Tiering                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Frequent Access Tier]  $0.023/GB                     │
│  └─ 기본 티어 (밀리초 단위 액세스)                        │
│         │                                               │
│         │ 30일 미접근                                    │
│         ▼                                               │
│  [Infrequent Access Tier]  $0.0125/GB                  │
│  └─ 자동 이동 (밀리초 단위 액세스)                        │
│         │                                               │
│         │ 90일 미접근 (구성 필요)                         │
│         ▼                                               │
│  [Archive Access Tier]  $0.004/GB                      │
│  └─ 선택적 자동 아카이빙 (밀리초~분 단위 액세스)           │
│         │                                               │
│         │ 180일 미접근 (구성 필요)                        │
│         ▼                                               │
│  [Deep Archive Access Tier]  $0.00099/GB               │
│  └─ 장기 보관 (12시간 검색 시간)                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**본 프로젝트 전략**:

1. **`raw/` 원본 이미지**:
   - 즉시 Intelligent-Tiering 적용
   - 90일 후 Archive Access Tier로 자동 이동
   - 180일 후 Deep Archive Access Tier로 자동 이동
   - 원본 보관하되 비용 최소화

2. **`processed/` 전처리 이미지**:
   - 즉시 Intelligent-Tiering 적용
   - Frequent/Infrequent Access Tier만 사용
   - 자주 액세스되는 이미지는 빠른 성능 유지

**비용 비교** (100GB, 1년 기준):

| 시나리오        | Standard | Glacier        | Intelligent-Tiering | 절감율 |
| --------------- | -------- | -------------- | ------------------- | ------ |
| 매월 1회 접근   | $276     | $48 + 검색비용 | $150                | 46%    |
| 3개월 후 미접근 | $276     | $48 + 검색비용 | $60                 | 78%    |
| 6개월 후 미접근 | $276     | $48 + 검색비용 | $30                 | 89%    |

**장점**:

- ✅ **완전 자동화**: 수동 Lifecycle 관리 불필요
- ✅ **예측 가능한 성능**: Frequent/Infrequent Tier는 밀리초 단위 액세스
- ✅ **검색 비용 없음**: Archive Tier도 추가 검색 비용 없음 (Glacier 대비 큰 장점)
- ✅ **유연성**: 액세스 패턴 변경 시 자동으로 Tier 상향 이동

**주의사항**:

- ⚠️ 128KB 미만 객체: 모니터링 비용이 스토리지 비용보다 높을 수 있음
- ⚠️ 모니터링 비용: 1,000개 객체당 $0.0025 (월)
- ⚠️ 최소 보관 기간: 30일 (30일 이내 삭제 시 30일분 과금)

### 2. SQS Queue

**리소스명**: `ImageUploadQueue`

#### 목적

- S3 이벤트와 Step Functions 실행 사이의 디커플링
- 대량 업로드 시 Step Functions 동시 실행 한도 보호
- 실패 시 재시도 메커니즘

#### 구성

```typescript
const imageUploadQueue = new sqs.Queue(this, 'ImageUploadQueue', {
  queueName: `image-upload-${stage}`,
  visibilityTimeout: cdk.Duration.minutes(15), // Lambda 실행 시간 + 여유
  retentionPeriod: cdk.Duration.days(4),
  deadLetterQueue: {
    queue: dlq,
    maxReceiveCount: 3 // 3번 실패 시 DLQ로 이동
  }
})

const dlq = new sqs.Queue(this, 'ImageUploadDLQ', {
  queueName: `image-upload-dlq-${stage}`,
  retentionPeriod: cdk.Duration.days(14)
})
```

#### 메시지 형식

```json
{
  "Records": [
    {
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": {
          "name": "snaprace-images-dev"
        },
        "object": {
          "key": "raw/org-123/event-456/photo-001.jpg",
          "size": 2048576
        }
      }
    }
  ]
}
```

### 3. Lambda Functions

#### 3.1. SFN Trigger Lambda

**리소스명**: `SfnTriggerFunction`

```typescript
const sfnTrigger = new lambda.Function(this, 'SfnTriggerFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('src/sfn-trigger'),
  environment: {
    STATE_MACHINE_ARN: stateMachine.stateMachineArn
  },
  timeout: cdk.Duration.seconds(30)
})

// SQS 이벤트 소스 연결
sfnTrigger.addEventSource(
  new lambdaEventSources.SqsEventSource(imageUploadQueue, {
    batchSize: 10, // 한 번에 최대 10개 메시지 처리
    maxBatchingWindow: cdk.Duration.seconds(5)
  })
)

// Step Functions 실행 권한
stateMachine.grantStartExecution(sfnTrigger)
```

#### 3.2. Preprocess Lambda

**리소스명**: `PreprocessFunction`

```typescript
const preprocessFn = new lambda.Function(this, 'PreprocessFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('src/preprocess'),
  memorySize: 2048, // Sharp.js는 메모리 사용량이 높음
  timeout: cdk.Duration.minutes(5),
  environment: {
    BUCKET_NAME: bucket.bucketName,
    MAX_WIDTH: '4096',
    MAX_HEIGHT: '4096',
    JPEG_QUALITY: '90'
  },
  layers: [
    // Sharp layer (ARM64 optimized)
    lambda.LayerVersion.fromLayerVersionArn(this, 'SharpLayer', 'arn:aws:lambda:ap-northeast-2:...:layer:sharp:...')
  ]
})

bucket.grantReadWrite(preprocessFn)
```

#### 3.3. Detect Text Lambda

**리소스명**: `DetectTextFunction`

```typescript
const detectTextFn = new lambda.Function(this, 'DetectTextFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('src/detect-text'),
  memorySize: 512,
  timeout: cdk.Duration.seconds(30),
  environment: {
    BUCKET_NAME: bucket.bucketName
  }
})

bucket.grantRead(detectTextFn)

detectTextFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['rekognition:DetectText'],
    resources: ['*']
  })
)
```

#### 3.4. Index Faces Lambda

**리소스명**: `IndexFacesFunction`

```typescript
const indexFacesFn = new lambda.Function(this, 'IndexFacesFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('src/index-faces'),
  memorySize: 512,
  timeout: cdk.Duration.seconds(30),
  environment: {
    BUCKET_NAME: bucket.bucketName,
    MAX_FACES: '15',
    QUALITY_FILTER: 'AUTO'
    // COLLECTION_ID는 동적 생성 (orgId-eventId)
  }
})

bucket.grantRead(indexFacesFn)

indexFacesFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'rekognition:IndexFaces',
      'rekognition:CreateCollection', // Collection 생성 권한
      'rekognition:DescribeCollection' // Collection 존재 확인 권한
    ],
    resources: ['*']
  })
)
```

#### 3.5. Fanout DynamoDB Lambda

**리소스명**: `FanoutDynamoDBFunction`

```typescript
const fanoutFn = new lambda.Function(this, 'FanoutDynamoDBFunction', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset('src/fanout-dynamodb'),
  memorySize: 512,
  timeout: cdk.Duration.minutes(1),
  environment: {
    TABLE_NAME: table.tableName
  }
})

table.grantWriteData(fanoutFn)
```

### 4. Step Functions State Machine

**리소스명**: `ImageProcessingWorkflow`

#### ASL (Amazon States Language) 정의

```json
{
  "Comment": "Image Processing Workflow for BIB detection and face indexing",
  "StartAt": "PreprocessImage",
  "States": {
    "PreprocessImage": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:PreprocessFunction",
      "TimeoutSeconds": 300,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "ProcessingFailed"
        }
      ],
      "ResultPath": "$.preprocessResult",
      "Next": "AnalyzeImage"
    },
    "AnalyzeImage": {
      "Type": "Parallel",
      "Branches": [
        {
          "StartAt": "DetectText",
          "States": {
            "DetectText": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:DetectTextFunction",
              "TimeoutSeconds": 30,
              "Retry": [
                {
                  "ErrorEquals": ["States.TaskFailed"],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 2,
                  "BackoffRate": 2.0
                }
              ],
              "End": true
            }
          }
        },
        {
          "StartAt": "IndexFaces",
          "States": {
            "IndexFaces": {
              "Type": "Task",
              "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:IndexFacesFunction",
              "TimeoutSeconds": 30,
              "Retry": [
                {
                  "ErrorEquals": ["States.TaskFailed"],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 2,
                  "BackoffRate": 2.0
                }
              ],
              "End": true
            }
          }
        }
      ],
      "ResultPath": "$.analysisResult",
      "Next": "FanoutToDynamoDB"
    },
    "FanoutToDynamoDB": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:REGION:ACCOUNT:function:FanoutDynamoDBFunction",
      "TimeoutSeconds": 60,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "End": true
    },
    "ProcessingFailed": {
      "Type": "Fail",
      "Error": "ImageProcessingError",
      "Cause": "Failed to process image"
    }
  }
}
```

#### CDK 구성

```typescript
const stateMachine = new sfn.StateMachine(this, 'ImageProcessingWorkflow', {
  stateMachineName: `image-processing-${stage}`,
  definition: preprocessTask.next(parallelAnalysis).next(fanoutTask),
  timeout: cdk.Duration.minutes(15),
  tracingEnabled: true, // X-Ray 추적
  logs: {
    destination: logGroup,
    level: sfn.LogLevel.ALL
  }
})
```

### 5. DynamoDB Table

**리소스명**: `PhotoServiceTable`

```typescript
const table = new dynamodb.Table(this, 'PhotoServiceTable', {
  tableName: `PhotoService-${stage}`,
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED
})

// GSI1: BIB 기반 검색
table.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL
})
```

### 6. Rekognition Collection

**리소스**: 동적 생성 (`{orgId}-{eventId}`)

#### 자동 생성 전략

Rekognition Collection은 **Index Faces Lambda 실행 시 자동으로 생성**됩니다.

**Collection ID 규칙**:

```
{orgId}-{eventId}

예시:
- snaprace-kr-seoul-marathon-2024
- runningclub-busan-half-2024
```

**장점**:

- ✅ **완전 자동화**: 수동 생성 불필요
- ✅ **멱등성**: 이미 존재하면 생성 건너뜀
- ✅ **이벤트별 분리**: 각 이벤트마다 독립적인 Collection
- ✅ **성능 최적화**: Lambda 메모리 캐싱으로 API 호출 최소화

#### Lambda 내부 로직 (Index Faces)

```typescript
// Lambda 컨테이너 재사용 시 캐시
const existingCollections = new Set<string>()

async function ensureCollectionExists(collectionId: string): Promise<void> {
  // 캐시 확인 (Warm Lambda)
  if (existingCollections.has(collectionId)) {
    return
  }

  try {
    // Collection 존재 확인
    await rekognitionClient.send(new DescribeCollectionCommand({ CollectionId: collectionId }))
    existingCollections.add(collectionId)
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      // Collection 생성
      await rekognitionClient.send(new CreateCollectionCommand({ CollectionId: collectionId }))
      existingCollections.add(collectionId)
      console.log(`Collection created: ${collectionId}`)
    } else {
      throw error
    }
  }
}

export const handler = async (event: PreprocessOutput) => {
  const collectionId = `${event.orgId}-${event.eventId}`

  // Collection 확인/생성 (멱등성 보장)
  await ensureCollectionExists(collectionId)

  // 얼굴 인덱싱
  await rekognitionClient.send(
    new IndexFacesCommand({
      CollectionId: collectionId, // 동적 ID
      Image: { S3Object: { Bucket: event.bucketName, Name: event.processedKey } },
      ExternalImageId: event.s3Uri
    })
  )
}
```

#### IAM 권한

Index Faces Lambda에 추가 권한 필요:

```typescript
indexFacesFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['rekognition:IndexFaces', 'rekognition:CreateCollection', 'rekognition:DescribeCollection'],
    resources: ['*']
  })
)
```

#### Collection 정리

이벤트 종료 후 Collection 삭제는 별도 Lambda로 처리:

```bash
# 수동 삭제
aws rekognition delete-collection \
  --collection-id snaprace-kr-seoul-marathon-2024 \
  --region ap-northeast-2
```

## 🔐 IAM 권한 정리

### Lambda 실행 역할 (Execution Role)

각 Lambda는 최소 권한 원칙(Principle of Least Privilege)을 따릅니다.

#### SFN Trigger Lambda

- `sqs:ReceiveMessage`, `sqs:DeleteMessage`, `sqs:GetQueueAttributes` (SQS)
- `states:StartExecution` (Step Functions)
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` (CloudWatch)

#### Preprocess Lambda

- `s3:GetObject` (S3 raw/)
- `s3:PutObject` (S3 processed/)
- `logs:*`

#### Detect Text Lambda

- `s3:GetObject` (S3 processed/)
- `rekognition:DetectText`
- `logs:*`

#### Index Faces Lambda

- `s3:GetObject` (S3 processed/)
- `rekognition:IndexFaces`
- `rekognition:CreateCollection` (Collection 자동 생성)
- `rekognition:DescribeCollection` (Collection 존재 확인)
- `logs:*`

#### Fanout DynamoDB Lambda

- `dynamodb:PutItem`
- `logs:*`

### Step Functions 실행 역할

- `lambda:InvokeFunction` (모든 Lambda 함수)

## 📊 비용 추정

### 예상 비용 (월 10,000장 기준)

| 서비스                 | 사용량             | 월 예상 비용         | 비고                      |
| ---------------------- | ------------------ | -------------------- | ------------------------- |
| S3 Intelligent-Tiering | 50GB (processed)   | $0.58 - $1.15        | Frequent Access Tier 기준 |
| S3 Intelligent-Tiering | 30GB (raw)         | $0.01 - $0.35        | Archive 자동 이동         |
| S3 모니터링 요금       | 80GB (10K objects) | $0.25                | 객체당 $0.0025            |
| S3 요청                | PUT 10K, GET 40K   | $0.05                |                           |
| Lambda                 | 50K 실행 (각 함수) | $0.50                |                           |
| Step Functions         | 10K 실행           | $0.25                |                           |
| Rekognition DetectText | 10K 이미지         | $10.00               |                           |
| Rekognition IndexFaces | 10K 이미지         | $10.00               |                           |
| DynamoDB               | 30K 쓰기           | $0.38                |                           |
| **합계**               |                    | **~$22.00 - $23.00** |                           |

#### S3 Intelligent-Tiering 비용 상세

**Tier별 저장 비용** (서울 리전 기준):

- **Frequent Access Tier**: $0.023/GB (Standard와 동일)
- **Infrequent Access Tier**: $0.0125/GB (30일 미접근 시 자동 이동)
- **Archive Access Tier**: $0.004/GB (90일 미접근 시 자동 이동)
- **Deep Archive Access Tier**: $0.00099/GB (180일 미접근 시 자동 이동)

**모니터링 비용**: 1,000개 객체당 $0.0025

**장점**:

- ✅ 액세스 패턴에 따라 자동으로 최적화 (수동 관리 불필요)
- ✅ 검색 비용 없음 (Frequent/Infrequent Tier)
- ✅ 원본 이미지 자동 아카이빙 (90-180일 후)
- ✅ 예측 가능한 성능 (밀리초 단위 액세스)

> 💡 실제 비용은 이미지 크기, BIB 개수, 얼굴 개수, 액세스 패턴에 따라 달라질 수 있습니다.  
> 💡 `raw/` 이미지가 자주 접근되지 않는 경우 최대 95% 비용 절감 가능

## 🔍 모니터링 및 알람

### CloudWatch Metrics

- Step Functions 실행 성공/실패율
- Lambda 함수별 duration, error rate
- SQS Queue 깊이 (ApproximateNumberOfMessagesVisible)
- DynamoDB 쓰기 용량 사용률

### 권장 알람

```typescript
// Step Functions 실패 알람
const sfnFailureAlarm = new cloudwatch.Alarm(this, 'SfnFailureAlarm', {
  metric: stateMachine.metricFailed(),
  threshold: 5,
  evaluationPeriods: 1,
  alarmDescription: 'Step Functions 실행 실패 5회 초과'
})

// DLQ 메시지 알람
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'DLQ에 메시지 존재'
})
```

## 🎯 확장 및 최적화 포인트

### 비용 최적화

1. **S3 Intelligent-Tiering 자동화**: 액세스 패턴에 따라 자동으로 비용 최적화
   - `raw/` 이미지는 90-180일 후 Archive Tier로 자동 이동
   - `processed/` 이미지는 30일 미접근 시 Infrequent Tier로 자동 이동
   - 수동 관리 불필요, 예측 불가능한 액세스 패턴에 최적

2. **객체 크기 최적화**: 128KB 이상 객체만 Intelligent-Tiering 사용
   - 작은 파일은 Standard가 더 효율적 (모니터링 비용 고려)

### 성능 최적화

1. **Lambda 동시성 예약**: 피크 시간대 안정적인 처리
2. **S3 Transfer Acceleration**: 글로벌 업로드 속도 향상
3. **CloudFront 캐싱**: processed/ 이미지 전송 최적화
4. **S3 Byte-Range Fetches**: 큰 이미지 부분 다운로드로 성능 향상

### 기능 확장

1. **이미지 메타데이터**: EXIF GPS, 촬영 시간 등 추출
2. **중복 검출**: perceptual hash로 동일 이미지 필터링
3. **화질 분석**: 흐린 이미지 자동 필터링
4. **커스텀 레이블**: Rekognition Custom Labels로 특정 객체 검출
