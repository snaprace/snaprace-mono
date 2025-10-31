# SnapRace Infrastructure

AWS CDK를 사용한 SnapRace 프로젝트의 인프라 코드입니다.

## 📁 프로젝트 구조

```
apps/infra/
├── bin/
│   └── infra.ts                   # CDK 앱 진입점
├── lib/
│   ├── stacks/                    # CDK 스택
│   │   └── snaprace-stack.ts
│   ├── constructs/                # 재사용 가능한 Constructs
│   │   ├── storage/              # S3, DynamoDB
│   │   ├── compute/              # Lambda Functions
│   │   ├── messaging/            # SQS
│   │   ├── api/                  # API Gateway
│   │   └── monitoring/           # CloudWatch Alarms
│   ├── config/                   # 환경 설정
│   │   ├── environment.ts
│   │   └── constants.ts
│   └── interfaces/               # TypeScript 타입 정의
├── lambda/                       # Lambda 함수 소스
│   ├── shared/                  # 공유 레이어
│   ├── detect-text/
│   ├── index-faces/
│   └── find-by-selfie/
└── test/                        # 테스트
    ├── unit/
    └── integration/
```

## 🚀 시작하기

### 사전 요구사항

- Node.js 20.x 이상
- AWS CLI 설정 완료
- AWS CDK CLI 설치 (`npm install -g aws-cdk`)
- pnpm 8.x 이상

### 설치

```bash
# 의존성 설치
pnpm install

# TypeScript 컴파일
pnpm run build
```

### CDK 부트스트랩 (최초 1회만)

```bash
# AWS 계정과 리전에 CDK 리소스 생성
pnpm run bootstrap
```

## 📦 배포

### Development 환경

```bash
# CloudFormation 템플릿 생성
pnpm run synth:dev

# 변경사항 확인
pnpm run diff:dev

# 배포
pnpm run deploy:dev
```

### Staging 환경

```bash
pnpm run synth:staging
pnpm run diff:staging
pnpm run deploy:staging
```

### Production 환경

```bash
pnpm run synth:prod
pnpm run diff:prod

# 승인 후 배포
pnpm run deploy:prod
```

## 🏗️ 아키텍처

### Storage Layer
- **S3 Bucket**: 사진 저장
- **DynamoDB Tables**: 
  - Photos: 사진 메타데이터
  - PhotoFaces: 얼굴-사진 매핑
  - Runners: 참가자 정보
  - Events: 이벤트 정보

### Compute Layer
- **detect-text**: S3 업로드 시 OCR 처리
- **index-faces**: 얼굴 인덱싱 및 매칭
- **find-by-selfie**: 셀카 기반 사진 검색

### Messaging Layer
- **SQS Queue**: 비동기 작업 처리
- **DLQ**: 실패한 메시지 처리

### API Layer
- **API Gateway**: REST API 엔드포인트
- `/selfie` (POST): 셀카로 사진 검색

### Monitoring Layer
- **CloudWatch Alarms**: Lambda 에러, 타임아웃, DLQ 알림
- **SNS Topic**: 알림 전송

## 🔧 개발

### 테스트

```bash
# 단위 테스트
pnpm test

# Watch 모드
pnpm run watch
```

### 스크립트

- `pnpm run build`: TypeScript 컴파일
- `pnpm run watch`: Watch 모드로 컴파일
- `pnpm run synth`: CloudFormation 템플릿 생성
- `pnpm run diff`: 변경사항 확인
- `pnpm run deploy`: 배포
- `pnpm run destroy`: 스택 삭제

## 🌍 환경별 설정

환경별 설정은 `lib/config/environment.ts`에서 관리됩니다.

### Dev
- Rekognition 신뢰도: 80%
- Lambda 메모리: 512MB
- Lambda 타임아웃: 30초
- 동시 실행 제한: 10

### Staging
- Rekognition 신뢰도: 85%
- Lambda 메모리: 768MB
- Lambda 타임아웃: 60초

### Production
- Rekognition 신뢰도: 90%
- Lambda 메모리: 1024MB
- Lambda 타임아웃: 5분
- 동시 실행 제한: 100
- PITR 활성화
- 버전 관리 활성화

## 📊 CloudFormation Outputs

배포 후 다음 정보가 출력됩니다:

- **ApiEndpoint**: API Gateway URL
- **PhotosBucketName**: S3 버킷 이름
- **QueueUrl**: SQS 큐 URL
- **AlarmTopicArn**: SNS 토픽 ARN
- **테이블 이름들**: DynamoDB 테이블 이름

## 🔍 디버깅

### Lambda 로그 확인

```bash
# CloudWatch Logs 확인
aws logs tail /aws/lambda/snaprace-detect-text-dev --follow

# 특정 기간의 로그
aws logs tail /aws/lambda/snaprace-detect-text-dev --since 1h
```

### DLQ 메시지 확인

```bash
# DLQ 메시지 수 확인
aws sqs get-queue-attributes \
  --queue-url $(aws cloudformation describe-stacks \
    --stack-name SnapRaceStack-dev \
    --query "Stacks[0].Outputs[?OutputKey=='DLQUrl'].OutputValue" \
    --output text) \
  --attribute-names ApproximateNumberOfMessages
```

## 🗑️ 삭제

```bash
# Development 환경 삭제
pnpm run destroy:dev

# Production 환경 삭제
pnpm run destroy:prod
```

⚠️ **주의**: Production 환경의 S3 버킷과 DynamoDB 테이블은 `RETAIN` 정책이 적용되어 스택 삭제 시에도 보존됩니다.

## 📚 참고 문서

- [AWS CDK 아키텍처 문서](../../docs/spec/aws-cdk-architecture.md)
- [Lambda 리팩토링 분석](../../docs/spec/lambda-refactoring-analysis.md)
- [구현 체크리스트](../../docs/tasks/cdk-implementation-checklist.md)
- [AWS CDK 공식 문서](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- [AWS Solutions Constructs](https://docs.aws.amazon.com/solutions/latest/constructs/welcome.html)

## 🐛 트러블슈팅

### CDK 부트스트랩 오류
```bash
# 부트스트랩 상태 확인
aws cloudformation describe-stacks --stack-name CDKToolkit

# 재부트스트랩
cdk bootstrap --force
```

### Lambda 패키징 오류
```bash
# Lambda 디렉토리에서 의존성 설치
cd lambda/detect-text
npm install
cd ../..
```

### 권한 오류
- AWS CLI 프로필 확인: `aws sts get-caller-identity`
- IAM 권한 확인: CloudFormation, Lambda, DynamoDB, S3, SQS 권한 필요

## 📝 라이선스

Private - SnapRace Project
