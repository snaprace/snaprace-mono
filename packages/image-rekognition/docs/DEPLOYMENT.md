# DEPLOYMENT.md

# SnapRace Deployment Guide

본 문서는 SnapRace 이미지 파이프라인 & 검색 시스템을 AWS 환경에 배포하기 위한 **전체 가이드**입니다.  
CDK 스택 구성, 환경 변수, IAM, 네트워크, 모니터링, prod/dev 전략까지 포함합니다.

---

# 1. 개요

SnapRace는 다음 AWS 리소스로 구성됩니다.

- **S3**: raw / processed 이미지 저장
- **SQS**: S3 이벤트 큐
- **Lambda Functions**: 이미지 처리/분석/저장
- **Step Functions**: 이미지 처리 파이프라인 오케스트레이션
- **DynamoDB**: PHOTO / BIB_INDEX / GSI1 / GSI2 (검색용)
- **RDB(PostgreSQL/Supabase)**: organizers/events/photographers Truth Layer
- **CloudFront**: 이미지 CDN

배포는 AWS CDK로 이루어지며, 모든 리소스는 IaC 기반으로 자동 생성/업데이트합니다.

---

# 2. 배포 환경 구조

SnapRace는 보통 **dev**, **prod** 두 환경으로 관리됩니다.

```
/infra/cdk
  ├── bin/
  │    └── snaprace.ts       # 앱 엔트리포인트
  ├── lib/
  │    ├── photo-processing-stack.ts
  │    ├── dynamodb-stack.ts
  │    ├── cloudfront-stack.ts
  │    └── ...
  └── cdk.json
```

배포 시 환경 지정:

```
cdk deploy --profile snaprace-dev
cdk deploy --profile snaprace-prod
```

혹은 Stage 변수를 직접 넘김:

```
cdk deploy -c stage=dev
cdk deploy -c stage=prod
```

---

# 3. CDK Stack 구성

## 3.1 주요 스택

### (1) **S3 + SQS + Lambda + Step Functions**  
사진 업로드 → 파이프라인 실행 담당

### (2) **DynamoDB PhotoService Stack**  
PHOTO / BIB_INDEX / GSI1 / GSI2 구성

### (3) **CloudFront Distribution Stack**  
processed 이미지 CDN 서빙

### (4) **Optional: API Gateway / Lambda API / Next.js SSR 배포**
검색 API, 갤러리 API 등

---

# 4. 환경 변수 설정

모든 Lambda는 다음 환경 변수를 포함합니다.

```env
STAGE=dev|prod
BUCKET_NAME=snaprace-images-${STAGE}
TABLE_NAME=PhotoService-${STAGE}
REGION=ap-northeast-2
```

추가적으로 필요한 Lambda:

### FanoutDynamoDBFunction
```env
DB_HOST=...         # RDB 연결 정보
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
DB_PORT=5432
```

Secrets는 **AWS Secrets Manager** 또는 Supabase Service Key를 사용하는 경우 **Environment Variable Encryption(KMS)** 사용을 권장.

---

# 5. IAM 권한 정책

최소 권한 원칙(Least Privilege)에 따름.

## 5.1 PreprocessFunction
- s3:GetObject
- s3:PutObject

## 5.2 DetectTextFunction
- rekognition:DetectText
- s3:GetObject

## 5.3 IndexFacesFunction
- rekognition:IndexFaces
- rekognition:CreateCollection
- rekognition:DescribeCollection
- s3:GetObject

## 5.4 FanoutDynamoDBFunction
- dynamodb:PutItem
- rds-data:ExecuteStatement (옵션)
- secretsmanager:GetSecretValue (옵션)

## 5.5 SfnTriggerFunction
- sqs:ReceiveMessage
- sqs:DeleteMessage
- states:StartExecution

---

# 6. 네트워크 구성

기본 구성은 **퍼블릭 서비스**이므로 VPC가 필수는 아닙니다.  
그러나 다음 요구 조건이 있다면 VPC 사용을 권장합니다:

- Lambda가 Supabase 또는 RDS(PostgreSQL)와 직접 연결해야 하는 경우
- Private Subnet + NAT Gateway 구성 필요할 때

추천 구성:

```
VPC
 ├── Public Subnet: ALB/CloudFront Origin (Optional)
 └── Private Subnet: Lambdas + RDS(PostgreSQL)
```

Lambda → RDS 연결 시, Security Group 규칙 포함 필요:

```
Lambda SG → RDS SG  (TCP 5432)
```

---

# 7. CloudFront 배포 구성

이미지 서빙:
- Origin: S3 `processed/` 경로

Path Pattern 예시:
```
/{organizerId}/{eventId}/processed/*  → S3 Origin
```

**OAC(Object Access Control)** 활성화 필수:
- CloudFront가 S3를 private 접근할 수 있도록 구성
- 버킷 정책에 CloudFront Origin Access Control 허용 설정

---

# 8. S3 Intelligent-Tiering 구성

CDK 구성 예시:
```ts
new s3.Bucket(this, 'ImageRekognitionBucket', {
  bucketName: `snaprace-images-${stage}`,
  intelligentTieringConfigurations: [
    {
      name: 'ArchiveConfiguration',
      archiveAccessTierTime: Duration.days(90),
      deepArchiveAccessTierTime: Duration.days(180)
    },
  ],
});
```

전략:
- processed/ 이미지는 자주 조회 → Frequent → Infrequent로 자연스러운 이동
- raw/ 이미지는 거의 조회 없음 → Archive/Deep Archive로 자동 이동

---

# 9. Step Functions 구성

ASL 정의는 `STEP_FUNCTIONS_WORKFLOW.md` 참고.  
주요 설정:

```ts
new sfn.StateMachine(this, 'ImageProcessingWorkflow', {
  timeout: Duration.minutes(15),
  tracingEnabled: true,
  logs: {
    destination: logGroup,
    level: sfn.LogLevel.ALL,
  },
});
```

CloudWatch Logs 활성화로 장애 분석 가능.

---

# 10. 배포 절차

## 10.1 개발 환경(dev)
```
cd infra/cdk
cdk bootstrap
cdk deploy --profile snaprace-dev
```

## 10.2 운영 환경(prod)
```
cdk bootstrap --profile snaprace-prod
cdk deploy --profile snaprace-prod
```

배포 시 자동 생성되는 리소스:
- 모든 Lambda 함수 (Preprocess/DetectText/IndexFaces/Fanout)
- SQS 큐 + DLQ
- Step Functions Workflow
- DynamoDB 테이블 및 GSI1/GSI2
- CloudFront Distribution
- S3 버킷

---

# 11. 재배포 / 롤백 전략

## 11.1 Lambda Only 변경
CDK가 함수 코드 변경만 감지 → 빠른 배포

## 11.2 Step Functions 변경
버전 변경으로 자동 업데이트

## 11.3 DynamoDB 스키마 변경
- GSI 추가는 안전 (백필 작업 자동 수행)
- PK/SK 변경은 신규 테이블 생성 후 점진적 마이그레이션 필요

## 11.4 롤백
- CDK diff로 변경 확인 후 rollback 가능
- 실패 시 CloudFormation이 자동 롤백 수행

---

# 12. 모니터링 & 알람

필수 CloudWatch 알람:

### Step Functions
- `ExecutionFailed > 0`
- `ExecutionThrottled`

### SQS
- `ApproximateNumberOfMessagesVisible > 50`
- `DLQ > 0`

### Lambda
- ErrorRate > 5%
- Duration P95 증가

### DynamoDB
- ThrottledRequests > 0

### CloudFront
- 5xx 증가 시 알람

---

# 13. 운영 체크리스트

- [ ] S3 OAC 적용 확인
- [ ] CloudFront 캐싱 정상 동작 확인
- [ ] Step Functions 로그와 X-Ray Tracking 활성화
- [ ] PhotographerId 메타데이터 정상 전달 확인
- [ ] DynamoDB PITR 활성화
- [ ] Lambda DLQ 모니터링
- [ ] RDS Password Rotation

---

# 14. Troubleshooting

### 14.1 사진 업로드 후 처리 안 됨
- S3 이벤트 → SQS 연결 확인
- Trigger Lambda의 batch 사이즈/권한 확인
- SFN Trigger Lambda CloudWatch 로그 확인

### 14.2 텍스트/BIB 검출이 갑자기 작동 안 됨
- Rekognition 서비스 리전 확인
- 이미지 해상도/품질 문제 확인

### 14.3 얼굴 인덱싱 문제
- Collection ID 규칙 `{orgId}-{eventId}` 확인
- Collection 생성/DescribeCollection 권한 확인

### 14.4 DynamoDB 저장 실패
- fanout lambda permission 확인
- PK/SK/GSI 키 형식 확인

---

# 15. 요약

이 문서는 SnapRace 시스템을 AWS에 배포하기 위한 전체 가이드입니다.

- CDK IaC 기반 자동 배포
- Pipeline 구성: S3 → SQS → Lambda → Step Functions → DynamoDB
- RDB Truth Layer + DynamoDB Read Layer 구조
- CloudFront 이미지 서빙
- Stage(dev/prod) 분리 전략 포함

실제 운영 시에는 본 문서와 함께
`ARCHITECTURE.md`, `LAMBDA_FUNCTIONS.md`, `STEP_FUNCTIONS_WORKFLOW.md`, `DYNAMODB_SCHEMA.md` 문서를 함께 참고하면 됩니다.

