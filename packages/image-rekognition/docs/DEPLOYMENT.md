# 배포 및 운영 가이드

## 📋 개요

본 문서는 Image Rekognition CDK 프로젝트의 배포, 운영, 모니터링, 트러블슈팅 방법을 안내합니다.

## 🚀 배포 프로세스

### 사전 요구사항

#### 1. 개발 환경 설정

```bash
# Node.js 20.x 설치 확인
node --version  # v20.x.x

# AWS CLI 설치 및 인증 설정
aws configure
# AWS Access Key ID: [...]
# AWS Secret Access Key: [...]
# Default region name: ap-northeast-2
# Default output format: json

# AWS 계정 확인
aws sts get-caller-identity

# CDK 설치
npm install -g aws-cdk

# CDK 버전 확인
cdk --version  # 2.x.x
```

#### 2. 프로젝트 의존성 설치

```bash
cd packages/image-rekognition
npm install
```

#### 3. 환경 변수 설정

`.env` 파일 생성 (또는 CDK Context 사용):

```bash
# .env
AWS_REGION=ap-northeast-2
STAGE=dev
ORG_ID=snaprace-kr
EVENT_ID=test-event
```

또는 `cdk.json`에 context 추가:

```json
{
  "context": {
    "stage": "dev",
    "orgId": "snaprace-kr",
    "eventId": "test-event"
  }
}
```

### 배포 단계

#### 1단계: Bootstrap (최초 1회)

AWS CDK를 사용하기 위한 초기 설정:

```bash
# CDK Bootstrap (계정당 리전당 1회)
cdk bootstrap aws://ACCOUNT-ID/ap-northeast-2

# 예시
cdk bootstrap aws://123456789012/ap-northeast-2
```

이 명령은 다음을 생성합니다:

- CDKToolkit CloudFormation 스택
- S3 버킷 (CDK 에셋 저장용)
- IAM 역할
- ECR 리포지토리 (컨테이너 이미지용)

#### 2단계: 스택 신세틱스 (Synth)

CloudFormation 템플릿 생성:

```bash
# CloudFormation 템플릿 생성
cdk synth

# 출력 위치: cdk.out/ImageRekognitionStack-dev.template.json
```

#### 3단계: 차이점 확인 (Diff)

배포 전 변경사항 확인:

```bash
# 기존 스택과 비교
cdk diff

# 출력 예시:
# Stack ImageRekognitionStack-dev
# Resources
# [+] AWS::Lambda::Function PreprocessFunction
# [~] AWS::S3::Bucket ImageRekognitionBucket
#  └─ [~] LifecycleConfiguration
```

#### 4단계: 배포 (Deploy)

```bash
# 배포 실행
cdk deploy

# 승인 없이 자동 배포
cdk deploy --require-approval never

# 특정 스택만 배포 (여러 스택이 있는 경우)
cdk deploy ImageRekognitionStack-dev

# 배포 후 출력 확인
# Outputs:
# ImageRekognitionStack-dev.BucketName = snaprace-images-dev
# ImageRekognitionStack-dev.StateMachineArn = arn:aws:states:...
```

#### 5단계: 완료! 🎉

✅ **Rekognition Collection은 자동으로 생성됩니다**

첫 이미지 업로드 시 Index Faces Lambda가 자동으로 Collection을 생성합니다.

**Collection ID 규칙**: `{orgId}-{eventId}`

예시:

```bash
# 이미지 업로드: s3://snaprace-images-dev/snaprace-kr/seoul-marathon-2024/raw/photo.jpg
# → Collection 자동 생성: snaprace-kr-seoul-marathon-2024

# Collection 확인 (선택사항)
aws rekognition describe-collection \
  --collection-id snaprace-kr-seoul-marathon-2024 \
  --region ap-northeast-2
```

**장점**:

- ✅ 수동 생성 불필요
- ✅ 이벤트별 자동 분리
- ✅ 멱등성 보장 (중복 생성 방지)

### 배포 검증

#### 1. CloudFormation 스택 확인

```bash
# 스택 상태 확인
aws cloudformation describe-stacks \
  --stack-name ImageRekognitionStack-dev \
  --query 'Stacks[0].StackStatus'

# 출력: "CREATE_COMPLETE" 또는 "UPDATE_COMPLETE"
```

#### 2. 리소스 생성 확인

```bash
# S3 버킷 확인
aws s3 ls | grep snaprace-images

# Lambda 함수 확인
aws lambda list-functions --query 'Functions[?contains(FunctionName, `Preprocess`)].FunctionName'

# Step Functions 확인
aws stepfunctions list-state-machines --query 'stateMachines[?contains(name, `image-processing`)].name'

# DynamoDB 테이블 확인
aws dynamodb describe-table --table-name PhotoService-dev --query 'Table.TableStatus'
```

#### 3. 통합 테스트

```bash
# 테스트 이미지 업로드
aws s3 cp test-image.jpg s3://snaprace-images-dev/snaprace-kr/test-event/raw/test.jpg

# Step Functions 실행 확인 (약 30초 후)
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:ap-northeast-2:123456789012:stateMachine:image-processing-dev \
  --max-results 1

# DynamoDB 결과 확인
aws dynamodb query \
  --table-name PhotoService-dev \
  --key-condition-expression "PK = :pk AND begins_with(SK, :sk)" \
  --expression-attribute-values '{
    ":pk": {"S": "ORG#snaprace-kr#EVT#test-event"},
    ":sk": {"S": "PHOTO#"}
  }'
```

## 🔄 업데이트 및 롤백

### 업데이트 배포

```bash
# 1. 코드 변경 사항 확인
git status
git diff

# 2. 변경사항 확인
cdk diff

# 3. 배포
cdk deploy

# 4. 배포 모니터링
aws cloudformation describe-stack-events \
  --stack-name ImageRekognitionStack-dev \
  --max-items 10
```

### 롤백

#### 자동 롤백

CloudFormation은 배포 실패 시 자동으로 롤백합니다.

#### 수동 롤백

```bash
# 이전 버전으로 복원
git checkout <previous-commit>
cdk deploy

# 또는 CloudFormation 콘솔에서:
# 1. 스택 선택
# 2. "Update" → "Replace current template"
# 3. 이전 템플릿 선택
```

## 📊 모니터링

### CloudWatch 대시보드

#### 대시보드 생성

```typescript
// lib/monitoring.ts
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'

const dashboard = new cloudwatch.Dashboard(this, 'ImageRekognitionDashboard', {
  dashboardName: `image-rekognition-${stage}`
})

// Step Functions 메트릭
dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'Step Functions Executions',
    left: [stateMachine.metricStarted(), stateMachine.metricSucceeded(), stateMachine.metricFailed()]
  })
)

// Lambda 메트릭
dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'Lambda Duration',
    left: [preprocessFn.metricDuration(), detectTextFn.metricDuration(), indexFacesFn.metricDuration()]
  })
)

// SQS 메트릭
dashboard.addWidgets(
  new cloudwatch.GraphWidget({
    title: 'SQS Queue Depth',
    left: [queue.metricApproximateNumberOfMessagesVisible()]
  })
)
```

#### 대시보드 접근

```
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards:name=image-rekognition-dev
```

### 알람 설정

#### CDK로 알람 생성

```typescript
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions'
import * as sns from 'aws-cdk-lib/aws-sns'

// SNS 토픽 생성 (알람 수신용)
const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
  displayName: 'Image Rekognition Alarms'
})

// 이메일 구독 (수동으로 이메일 확인 필요)
alarmTopic.addSubscription(new subscriptions.EmailSubscription('devops@example.com'))

// Step Functions 실패 알람
const sfnFailureAlarm = new cloudwatch.Alarm(this, 'SfnFailureAlarm', {
  metric: stateMachine.metricFailed({
    statistic: 'Sum',
    period: cdk.Duration.minutes(5)
  }),
  threshold: 5,
  evaluationPeriods: 1,
  alarmDescription: 'Step Functions 실행 실패 5회 초과',
  alarmName: `${stage}-sfn-failure`
})

sfnFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic))

// Lambda 에러율 알람
const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
  metric: preprocessFn.metricErrors({
    statistic: 'Sum',
    period: cdk.Duration.minutes(5)
  }),
  threshold: 10,
  evaluationPeriods: 1,
  alarmDescription: 'Lambda 에러 10회 초과'
})

// DLQ 메시지 알람
const dlqAlarm = new cloudwatch.Alarm(this, 'DLQAlarm', {
  metric: dlq.metricApproximateNumberOfMessagesVisible(),
  threshold: 1,
  evaluationPeriods: 1,
  alarmDescription: 'DLQ에 메시지 존재'
})

dlqAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic))
```

### 로그 확인

#### CloudWatch Logs Insights

```bash
# Step Functions 실패 로그 검색
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 20
```

#### Lambda 로그 조회

```bash
# 최근 10분간 Preprocess Lambda 로그
aws logs tail /aws/lambda/PreprocessFunction-dev --follow --since 10m

# 에러 로그만 필터링
aws logs tail /aws/lambda/PreprocessFunction-dev --follow --filter-pattern "ERROR"
```

## 🐛 트러블슈팅

### 일반적인 문제

#### 1. Step Functions 실행 실패

**증상**: S3에 이미지를 업로드했지만 DynamoDB에 데이터가 없음

**진단 단계**:

```bash
# 1. SQS 큐 확인
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-northeast-2.amazonaws.com/123456789012/image-upload-dev \
  --attribute-names ApproximateNumberOfMessages

# 2. DLQ 확인
aws sqs get-queue-attributes \
  --queue-url https://sqs.ap-northeast-2.amazonaws.com/123456789012/image-upload-dlq-dev \
  --attribute-names ApproximateNumberOfMessages

# 3. Step Functions 실행 히스토리
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:...:stateMachine:image-processing-dev \
  --status-filter FAILED \
  --max-results 5

# 4. 실패한 실행 상세 확인
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:...:execution:image-processing-dev:...
```

**해결 방법**:

- Lambda 로그에서 에러 메시지 확인
- IAM 권한 확인
- Rekognition Collection 존재 여부 확인

#### 2. 이미지 전처리 실패

**증상**: Preprocess Lambda가 타임아웃 또는 메모리 부족

**진단**:

```bash
# Lambda 메트릭 확인
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=PreprocessFunction-dev \
  --start-time 2024-11-09T00:00:00Z \
  --end-time 2024-11-09T23:59:59Z \
  --period 3600 \
  --statistics Maximum,Average
```

**해결 방법**:

- Lambda 메모리 증가: 2048MB → 3008MB
- 타임아웃 증가: 5분 → 10분
- 이미지 크기 제한 추가 (예: 최대 15MB)

#### 3. Rekognition API 제한

**증상**: `ProvisionedThroughputExceededException`

**해결 방법**:

```typescript
// Lambda에서 재시도 로직 추가
import { RekognitionClient } from '@aws-sdk/client-rekognition'

const rekognitionClient = new RekognitionClient({
  maxAttempts: 5, // 최대 5번 재시도
  retryMode: 'adaptive' // 적응형 재시도
})
```

또는 AWS Support에 요청하여 한도 증가:

```bash
# 서비스 한도 확인
aws service-quotas get-service-quota \
  --service-code rekognition \
  --quota-code L-C2B3B5B5
```

#### 4. DynamoDB 쓰기 제한

**증상**: `ProvisionedThroughputExceededException`

**해결 방법**:

- On-Demand 모드 사용 (이미 적용됨)
- Batch Write 사용 (최대 25개 아이템)

```typescript
// BatchWriteItem 사용 예시
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'

const items = bibIndexItems.map((item) => ({
  PutRequest: { Item: item }
}))

// 25개씩 나누어서 전송
for (let i = 0; i < items.length; i += 25) {
  const batch = items.slice(i, i + 25)
  await docClient.send(
    new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: batch
      }
    })
  )
}
```

### 디버깅 팁

#### X-Ray 추적 활성화

```typescript
// Lambda에 X-Ray 추적 추가
const preprocessFn = new lambda.Function(this, 'PreprocessFunction', {
  // ...
  tracing: lambda.Tracing.ACTIVE
})

// Step Functions에 X-Ray 추적 추가
const stateMachine = new sfn.StateMachine(this, 'ImageProcessingWorkflow', {
  // ...
  tracingEnabled: true
})
```

#### 로컬 테스트

```bash
# SAM CLI로 Lambda 로컬 실행
sam local invoke PreprocessFunction \
  --event test-events/preprocess-event.json

# test-events/preprocess-event.json
{
  "bucketName": "snaprace-images-dev",
  "rawKey": "raw/org-test/event-test/test.jpg",
  "fileSize": 1024000,
  "timestamp": "2024-11-09T10:30:00.000Z"
}
```

## 🔐 보안

### IAM 권한 최소화

각 Lambda는 필요한 최소 권한만 가집니다:

```json
// Preprocess Lambda
{
  "Effect": "Allow",
  "Action": [
    "s3:GetObject"
  ],
  "Resource": "arn:aws:s3:::snaprace-images-dev/raw/*"
},
{
  "Effect": "Allow",
  "Action": [
    "s3:PutObject"
  ],
  "Resource": "arn:aws:s3:::snaprace-images-dev/processed/*"
}
```

### S3 버킷 정책

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyUnencryptedObjectUploads",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::snaprace-images-dev/*",
      "Condition": {
        "StringNotEquals": {
          "s3:x-amz-server-side-encryption": "AES256"
        }
      }
    }
  ]
}
```

### Secrets 관리

민감한 정보는 AWS Secrets Manager 사용:

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'

const apiKey = secretsmanager.Secret.fromSecretNameV2(this, 'ApiKey', 'prod/image-rekognition/api-key')

// Lambda에 권한 부여
apiKey.grantRead(lambdaFunction)
```

## 💰 비용 최적화

### 비용 모니터링

```bash
# AWS Cost Explorer API로 비용 확인
aws ce get-cost-and-usage \
  --time-period Start=2024-11-01,End=2024-11-30 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json

# cost-filter.json
{
  "Tags": {
    "Key": "Project",
    "Values": ["image-rekognition"]
  }
}
```

### 비용 절감 팁

1. **S3 Intelligent-Tiering**: 액세스 패턴에 따라 자동으로 비용 최적화
   - `raw/` 이미지는 90-180일 후 Archive Tier로 자동 이동
   - 수동 관리 없이 최대 95% 스토리지 비용 절감
   - 객체당 모니터링 비용: $0.0025/1,000 objects
2. **Lambda 메모리 최적화**: AWS Lambda Power Tuning 사용
3. **Rekognition 이미지 최적화**: 전처리로 이미지 크기 줄이기
4. **DynamoDB On-Demand**: 트래픽이 불규칙한 경우 유리
5. **CloudWatch Logs 보관 기간**: 14일로 제한

```typescript
// Lambda 로그 보관 기간 설정
import * as logs from 'aws-cdk-lib/aws-logs'

new logs.LogGroup(this, 'PreprocessLogGroup', {
  logGroupName: `/aws/lambda/${preprocessFn.functionName}`,
  retention: logs.RetentionDays.TWO_WEEKS,
  removalPolicy: cdk.RemovalPolicy.DESTROY
})
```

## 🧹 리소스 정리

### 개발/테스트 환경 삭제

```bash
# 1. S3 버킷 비우기 (삭제 전 필수)
aws s3 rm s3://snaprace-images-dev --recursive

# 2. CDK 스택 삭제
cdk destroy

# 3. Rekognition Collection 삭제
aws rekognition delete-collection \
  --collection-id EventRunnerFaces

# 4. CloudWatch Logs 삭제 (선택사항)
aws logs delete-log-group --log-group-name /aws/lambda/PreprocessFunction-dev
```

### 프로덕션 환경 주의사항

⚠️ **경고**: 프로덕션 환경 삭제 시 데이터 손실 주의!

```bash
# 1. DynamoDB 테이블 백업
aws dynamodb create-backup \
  --table-name PhotoService-prod \
  --backup-name PhotoService-prod-final-backup

# 2. S3 버킷 아카이빙
aws s3 sync s3://snaprace-images-prod s3://snaprace-images-archive

# 3. 스택 삭제
cdk destroy --force
```

## 📚 참고 자료

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/best-practices.html)
- [AWS Rekognition Developer Guide](https://docs.aws.amazon.com/rekognition/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

## 🆘 지원

### 이슈 리포팅

문제 발생 시 다음 정보를 포함하여 이슈를 생성하세요:

1. **환경**: Stage (dev/prod), Region, CDK 버전
2. **증상**: 에러 메시지, 실패한 리소스
3. **재현 단계**: 문제를 재현할 수 있는 단계
4. **로그**: CloudWatch Logs, X-Ray 트레이스
5. **스크린샷**: (선택사항)

### 긴급 연락처

- **DevOps 팀**: devops@example.com
- **On-Call**: +82-10-xxxx-xxxx
- **Slack**: #image-rekognition-alerts
