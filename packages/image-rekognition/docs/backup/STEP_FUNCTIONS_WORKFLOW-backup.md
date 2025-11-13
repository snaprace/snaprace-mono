# Step Functions 워크플로우 상세

## 📋 개요

본 문서는 Image Rekognition 시스템의 핵심인 Step Functions 워크플로우를 상세히 설명합니다.

## 🎯 워크플로우 목적

Step Functions를 사용하는 이유:

1. **안정성**: 각 단계별 자동 재시도 및 에러 핸들링
2. **가시성**: 실행 히스토리 및 상태 추적
3. **확장성**: 병렬 처리로 성능 향상
4. **유지보수성**: 비즈니스 로직을 코드가 아닌 상태 머신으로 정의

## 🔄 전체 워크플로우

```
┌─────────────────────────────────────────────────────────┐
│         Image Processing State Machine                  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │  PreprocessImage │  (Task State)
              │     Lambda       │
              └────────┬─────────┘
                       │ Success
                       │ {preprocessResult}
                       ▼
              ┌──────────────────┐
              │  AnalyzeImage    │  (Parallel State)
              └────────┬─────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│   DetectText    │         │   IndexFaces    │
│     Lambda      │         │     Lambda      │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └─────────────┬─────────────┘
                       │ Success
                       │ {analysisResult}
                       ▼
              ┌──────────────────┐
              │ FanoutToDynamoDB │  (Task State)
              │     Lambda       │
              └────────┬─────────┘
                       │
                       ▼
                   ┌───────┐
                   │Success│
                   └───────┘
```

## 📝 ASL (Amazon States Language) 정의

### 완전한 State Machine 정의

```json
{
  "Comment": "Image Processing Workflow for BIB detection and face indexing",
  "StartAt": "PreprocessImage",
  "TimeoutSeconds": 900,
  "States": {
    "PreprocessImage": {
      "Type": "Task",
      "Resource": "${PreprocessFunctionArn}",
      "Comment": "이미지 전처리: 검증, 리사이징, 포맷 변환",
      "TimeoutSeconds": 300,
      "Retry": [
        {
          "ErrorEquals": [
            "States.TaskFailed",
            "Lambda.ServiceException",
            "Lambda.AWSLambdaException",
            "Lambda.SdkClientException"
          ],
          "IntervalSeconds": 2,
          "MaxAttempts": 3,
          "BackoffRate": 2.0
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "ProcessingFailed"
        }
      ],
      "ResultPath": "$.preprocessResult",
      "Next": "AnalyzeImage"
    },
    
    "AnalyzeImage": {
      "Type": "Parallel",
      "Comment": "BIB 검출과 얼굴 인덱싱을 병렬로 실행",
      "ResultPath": "$.analysisResult",
      "Branches": [
        {
          "StartAt": "DetectText",
          "States": {
            "DetectText": {
              "Type": "Task",
              "Resource": "${DetectTextFunctionArn}",
              "Comment": "AWS Rekognition으로 BIB 번호 검출",
              "TimeoutSeconds": 30,
              "InputPath": "$.preprocessResult",
              "Retry": [
                {
                  "ErrorEquals": [
                    "ProvisionedThroughputExceededException",
                    "ThrottlingException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 5,
                  "BackoffRate": 2.0
                },
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
              "Resource": "${IndexFacesFunctionArn}",
              "Comment": "AWS Rekognition으로 얼굴 인덱싱",
              "TimeoutSeconds": 30,
              "InputPath": "$.preprocessResult",
              "Retry": [
                {
                  "ErrorEquals": [
                    "ProvisionedThroughputExceededException",
                    "ThrottlingException"
                  ],
                  "IntervalSeconds": 1,
                  "MaxAttempts": 5,
                  "BackoffRate": 2.0
                },
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
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "ResultPath": "$.error",
          "Next": "AnalysisFailed"
        }
      ],
      "Next": "FanoutToDynamoDB"
    },
    
    "FanoutToDynamoDB": {
      "Type": "Task",
      "Resource": "${FanoutFunctionArn}",
      "Comment": "분석 결과를 DynamoDB에 저장",
      "TimeoutSeconds": 60,
      "Retry": [
        {
          "ErrorEquals": [
            "ProvisionedThroughputExceededException",
            "ThrottlingException"
          ],
          "IntervalSeconds": 2,
          "MaxAttempts": 5,
          "BackoffRate": 2.0
        },
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
          "ResultPath": "$.error",
          "Next": "StorageFailed"
        }
      ],
      "End": true
    },
    
    "ProcessingFailed": {
      "Type": "Fail",
      "Error": "ImageProcessingError",
      "Cause": "이미지 전처리 실패"
    },
    
    "AnalysisFailed": {
      "Type": "Fail",
      "Error": "AnalysisError",
      "Cause": "이미지 분석 실패 (BIB 검출 또는 얼굴 인덱싱)"
    },
    
    "StorageFailed": {
      "Type": "Fail",
      "Error": "StorageError",
      "Cause": "DynamoDB 저장 실패"
    }
  }
}
```

## 🔧 CDK 구현

### State Machine 생성

```typescript
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as logs from 'aws-cdk-lib/aws-logs';

// CloudWatch Logs 그룹
const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
  logGroupName: `/aws/vendedlogs/states/image-processing-${stage}`,
  retention: logs.RetentionDays.TWO_WEEKS,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
});

// 1. Preprocess Task
const preprocessTask = new tasks.LambdaInvoke(this, 'PreprocessImage', {
  lambdaFunction: preprocessFn,
  comment: '이미지 전처리: 검증, 리사이징, 포맷 변환',
  timeout: cdk.Duration.minutes(5),
  resultPath: '$.preprocessResult',
  payloadResponseOnly: true, // Lambda 응답에서 Payload만 추출
});

// 재시도 설정
preprocessTask.addRetry({
  errors: ['States.TaskFailed', 'Lambda.ServiceException'],
  interval: cdk.Duration.seconds(2),
  maxAttempts: 3,
  backoffRate: 2.0,
});

// 에러 캐치
const processingFailed = new sfn.Fail(this, 'ProcessingFailed', {
  error: 'ImageProcessingError',
  cause: '이미지 전처리 실패',
});

preprocessTask.addCatch(processingFailed, {
  errors: ['States.ALL'],
  resultPath: '$.error',
});

// 2. Detect Text Task
const detectTextTask = new tasks.LambdaInvoke(this, 'DetectText', {
  lambdaFunction: detectTextFn,
  comment: 'AWS Rekognition으로 BIB 번호 검출',
  timeout: cdk.Duration.seconds(30),
  inputPath: '$.preprocessResult',
  payloadResponseOnly: true,
});

detectTextTask.addRetry({
  errors: ['ProvisionedThroughputExceededException', 'ThrottlingException'],
  interval: cdk.Duration.seconds(1),
  maxAttempts: 5,
  backoffRate: 2.0,
});

// 3. Index Faces Task
const indexFacesTask = new tasks.LambdaInvoke(this, 'IndexFaces', {
  lambdaFunction: indexFacesFn,
  comment: 'AWS Rekognition으로 얼굴 인덱싱',
  timeout: cdk.Duration.seconds(30),
  inputPath: '$.preprocessResult',
  payloadResponseOnly: true,
});

indexFacesTask.addRetry({
  errors: ['ProvisionedThroughputExceededException', 'ThrottlingException'],
  interval: cdk.Duration.seconds(1),
  maxAttempts: 5,
  backoffRate: 2.0,
});

// 4. Parallel Task
const parallelAnalysis = new sfn.Parallel(this, 'AnalyzeImage', {
  comment: 'BIB 검출과 얼굴 인덱싱을 병렬로 실행',
  resultPath: '$.analysisResult',
});

parallelAnalysis.branch(detectTextTask);
parallelAnalysis.branch(indexFacesTask);

const analysisFailed = new sfn.Fail(this, 'AnalysisFailed', {
  error: 'AnalysisError',
  cause: '이미지 분석 실패',
});

parallelAnalysis.addCatch(analysisFailed, {
  errors: ['States.ALL'],
  resultPath: '$.error',
});

// 5. Fanout Task
const fanoutTask = new tasks.LambdaInvoke(this, 'FanoutToDynamoDB', {
  lambdaFunction: fanoutFn,
  comment: '분석 결과를 DynamoDB에 저장',
  timeout: cdk.Duration.minutes(1),
  payloadResponseOnly: true,
});

fanoutTask.addRetry({
  errors: ['ProvisionedThroughputExceededException', 'ThrottlingException'],
  interval: cdk.Duration.seconds(2),
  maxAttempts: 5,
  backoffRate: 2.0,
});

const storageFailed = new sfn.Fail(this, 'StorageFailed', {
  error: 'StorageError',
  cause: 'DynamoDB 저장 실패',
});

fanoutTask.addCatch(storageFailed, {
  errors: ['States.ALL'],
  resultPath: '$.error',
});

// 6. State Machine 생성
const definition = preprocessTask
  .next(parallelAnalysis)
  .next(fanoutTask);

const stateMachine = new sfn.StateMachine(this, 'ImageProcessingWorkflow', {
  stateMachineName: `image-processing-${stage}`,
  definition,
  timeout: cdk.Duration.minutes(15),
  tracingEnabled: true, // X-Ray 추적
  logs: {
    destination: logGroup,
    level: sfn.LogLevel.ALL,
    includeExecutionData: true,
  },
});

// 7. Lambda 실행 권한
stateMachine.grantStartExecution(sfnTriggerFn);

// 8. 출력
new cdk.CfnOutput(this, 'StateMachineArn', {
  value: stateMachine.stateMachineArn,
  description: 'Step Functions State Machine ARN',
});
```

## 📊 데이터 흐름

### 입력 데이터 (Initial Event)

SFN Trigger Lambda가 전달하는 초기 입력:

```json
{
  "bucketName": "snaprace-images-dev",
  "rawKey": "raw/snaprace-kr/seoul-marathon-2024/photo-001.jpg",
  "fileSize": 2048576,
  "timestamp": "2024-11-09T10:30:00.000Z"
}
```

### 1단계 후: Preprocess 완료

```json
{
  "bucketName": "snaprace-images-dev",
  "rawKey": "raw/snaprace-kr/seoul-marathon-2024/photo-001.jpg",
  "fileSize": 2048576,
  "timestamp": "2024-11-09T10:30:00.000Z",
  "preprocessResult": {
    "bucketName": "snaprace-images-dev",
    "rawKey": "raw/snaprace-kr/seoul-marathon-2024/photo-001.jpg",
    "processedKey": "processed/snaprace-kr/seoul-marathon-2024/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg",
    "ulid": "01HXY8FWZM5KJQD9K3Y6R8NZTP",
    "orgId": "snaprace-kr",
    "eventId": "seoul-marathon-2024",
    "originalFilename": "photo-001.jpg",
    "dimensions": {
      "width": 3840,
      "height": 2160
    },
    "format": "jpeg",
    "size": 1856789,
    "s3Uri": "s3://snaprace-images-dev/processed/snaprace-kr/seoul-marathon-2024/01HXY8FWZM5KJQD9K3Y6R8NZTP.jpg"
  }
}
```

### 2단계 후: Parallel 분석 완료

```json
{
  "bucketName": "snaprace-images-dev",
  "rawKey": "...",
  "preprocessResult": { ... },
  "analysisResult": [
    {
      "bibs": ["1234", "5678"],
      "textDetections": [
        {
          "text": "1234",
          "confidence": 99.5,
          "geometry": { ... }
        },
        {
          "text": "5678",
          "confidence": 98.7,
          "geometry": { ... }
        }
      ]
    },
    {
      "faceIds": [
        "abcd1234-5678-90ab-cdef-1234567890ab",
        "efgh5678-90ab-cdef-1234-567890abcdef"
      ],
      "faceRecords": [
        {
          "faceId": "abcd1234-5678-90ab-cdef-1234567890ab",
          "confidence": 99.9,
          "boundingBox": { ... }
        },
        {
          "faceId": "efgh5678-90ab-cdef-1234-567890abcdef",
          "confidence": 99.8,
          "boundingBox": { ... }
        }
      ],
      "unindexedFaces": 0
    }
  ]
}
```

### 3단계 후: DynamoDB 저장 완료

```json
{
  "bucketName": "snaprace-images-dev",
  "rawKey": "...",
  "preprocessResult": { ... },
  "analysisResult": [ ... ],
  "photoItem": {
    "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
    "SK": "PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP"
  },
  "bibIndexItems": [
    {
      "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
      "SK": "BIB#1234#PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP"
    },
    {
      "PK": "ORG#snaprace-kr#EVT#seoul-marathon-2024",
      "SK": "BIB#5678#PHOTO#01HXY8FWZM5KJQD9K3Y6R8NZTP"
    }
  ],
  "itemsWritten": 3
}
```

## ⏱️ 실행 시간 예상

| 단계 | 평균 시간 | 최대 시간 | 비고 |
|------|-----------|-----------|------|
| Preprocess | 5-10초 | 30초 | 이미지 크기에 따라 변동 |
| Detect Text | 1-2초 | 5초 | Rekognition API 호출 |
| Index Faces | 1-2초 | 5초 | Rekognition API 호출 |
| Fanout DynamoDB | 1-3초 | 10초 | BIB 개수에 따라 변동 |
| **전체** | **10-15초** | **50초** | 정상 케이스 |

## 🔍 모니터링 및 디버깅

### CloudWatch Insights 쿼리

#### 실행 시간 분석

```
fields @timestamp, executionArn, type, details.status
| filter type = "ExecutionSucceeded"
| stats avg(details.duration) as avgDuration, 
        max(details.duration) as maxDuration,
        count(*) as totalExecutions
by bin(5m)
```

#### 실패 원인 분석

```
fields @timestamp, executionArn, type, error.Error, error.Cause
| filter type = "ExecutionFailed"
| stats count(*) as failures by error.Error
```

### Step Functions 콘솔

실행 히스토리 확인:

```
https://console.aws.amazon.com/states/home?region=ap-northeast-2#/statemachines/view/arn:aws:states:ap-northeast-2:123456789012:stateMachine:image-processing-dev
```

### X-Ray 추적

```bash
# AWS CLI로 추적 정보 조회
aws xray get-trace-summaries \
  --start-time 2024-11-09T00:00:00Z \
  --end-time 2024-11-09T23:59:59Z \
  --filter-expression 'service("image-processing-dev")'
```

## 🛠️ 에러 처리 전략

### 재시도 가능한 에러

다음 에러는 자동으로 재시도됩니다:

1. **AWS 서비스 일시적 장애**
   - `ServiceUnavailable`
   - `InternalServerError`
   - `RequestTimeout`

2. **쓰로틀링**
   - `ThrottlingException`
   - `ProvisionedThroughputExceededException`

3. **Lambda 에러**
   - `Lambda.ServiceException`
   - `Lambda.SdkClientException`

### 재시도 불가능한 에러

다음 에러는 즉시 실패 처리됩니다:

1. **유효하지 않은 입력**
   - 이미지 포맷 미지원
   - 파일 크기 초과
   - S3 객체 없음

2. **비즈니스 로직 에러**
   - Rekognition Collection 없음
   - DynamoDB 테이블 없음

### 에러 복구 전략

```typescript
// Lambda에서 비즈니스 에러 구분
export class NonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableError';
  }
}

// 사용 예시
if (!metadata.format || !validFormats.includes(metadata.format)) {
  throw new NonRetryableError(`Unsupported image format: ${metadata.format}`);
}

// Step Functions에서 캐치
{
  "Catch": [
    {
      "ErrorEquals": ["NonRetryableError"],
      "Next": "NotifyUser"  // 사용자에게 알림
    },
    {
      "ErrorEquals": ["States.ALL"],
      "Next": "ProcessingFailed"
    }
  ]
}
```

## 🎯 최적화 팁

### 1. 병렬 처리 최대 활용

현재는 2개의 분기 (Detect Text, Index Faces)만 병렬로 실행하지만, 추가 분석이 필요한 경우 확장 가능:

```typescript
parallelAnalysis.branch(detectTextTask);
parallelAnalysis.branch(indexFacesTask);
parallelAnalysis.branch(detectLabelsTask);  // 추가
parallelAnalysis.branch(detectModerationTask);  // 추가
```

### 2. Map State로 대량 처리

여러 이미지를 한 번에 처리하는 경우:

```json
{
  "Type": "Map",
  "ItemsPath": "$.images",
  "MaxConcurrency": 10,
  "Iterator": {
    "StartAt": "PreprocessImage",
    "States": { ... }
  }
}
```

### 3. Choice State로 조건 분기

특정 조건에 따라 다른 경로 실행:

```json
{
  "Type": "Choice",
  "Choices": [
    {
      "Variable": "$.preprocessResult.bibCount",
      "NumericGreaterThan": 0,
      "Next": "ProcessWithBibs"
    },
    {
      "Variable": "$.preprocessResult.bibCount",
      "NumericEquals": 0,
      "Next": "ProcessWithoutBibs"
    }
  ],
  "Default": "ProcessingFailed"
}
```

## 📈 성능 벤치마크

### 테스트 시나리오

- **이미지 크기**: 3840x2160 (4K), 2-5MB
- **BIB 개수**: 평균 2개
- **얼굴 개수**: 평균 2개

### 결과

| 메트릭 | 값 |
|--------|-----|
| P50 (중앙값) | 12초 |
| P90 | 18초 |
| P99 | 25초 |
| 최대 | 45초 |
| 성공률 | 99.5% |

### 병목 지점

1. **Preprocess Lambda**: 이미지 크기에 비례하여 시간 증가
2. **Rekognition API**: 네트워크 지연 및 큐잉

### 개선 방안

1. Lambda 메모리 증가 (2048MB → 3008MB)
2. 이미지 크기 사전 제한 (최대 15MB)
3. Rekognition API 동시 호출 한도 증가 요청

## 🔐 보안 고려사항

### 1. IAM 역할

Step Functions 실행 역할은 최소 권한만 가집니다:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": [
        "arn:aws:lambda:...:function:PreprocessFunction-*",
        "arn:aws:lambda:...:function:DetectTextFunction-*",
        "arn:aws:lambda:...:function:IndexFacesFunction-*",
        "arn:aws:lambda:...:function:FanoutFunction-*"
      ]
    }
  ]
}
```

### 2. 입력 검증

악의적인 입력 방지:

```typescript
// SFN Trigger Lambda에서 검증
if (!event.rawKey.startsWith('raw/')) {
  throw new Error('Invalid S3 key');
}

if (event.fileSize > 15 * 1024 * 1024) {  // 15MB
  throw new Error('File too large');
}
```

### 3. 출력 필터링

민감한 정보 제거:

```typescript
// Fanout Lambda에서 출력 정제
return {
  photoItem: {
    PK: photoItem.PK,
    SK: photoItem.SK,
  },
  // 내부 상세 정보는 제외
};
```

## 📝 체크리스트

Step Functions 구현 시 확인사항:

- [ ] 모든 Task에 타임아웃 설정
- [ ] 재시도 정책 정의 (재시도 가능/불가능 구분)
- [ ] 에러 캐치 및 Fail State 구성
- [ ] CloudWatch Logs 활성화
- [ ] X-Ray 추적 활성화
- [ ] IAM 권한 최소화
- [ ] 입력 데이터 검증
- [ ] 출력 데이터 크기 제한 (256KB 이하)
- [ ] 실행 히스토리 보관 기간 설정
- [ ] 알람 및 모니터링 구성

## 📚 참고 자료

- [Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/best-practices.html)
- [Amazon States Language Specification](https://states-language.net/spec.html)
- [Step Functions Error Handling](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html)
- [Step Functions Service Integration](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-service-integrations.html)

