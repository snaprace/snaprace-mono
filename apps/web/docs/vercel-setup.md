# Vercel 배포 설정 가이드

## 모노레포 설정

SnapRace Web 앱은 Turborepo 모노레포 환경에서 실행됩니다. Vercel에서 다음과 같이 설정하세요.

### 프로젝트 설정

- **Framework Preset**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && pnpm build --filter=@repo/web`
- **Output Directory**: `.next` (기본값)
- **Install Command**: `cd ../.. && pnpm install`
- **Node Version**: 18.x 이상

### Build & Development Settings

```bash
# Build Command (Vercel UI에서 설정)
cd ../.. && pnpm build --filter=@repo/web

# Install Command
cd ../.. && pnpm install
```

---

## 환경 변수 설정

다음 환경 변수들을 Vercel 대시보드에서 설정해야 합니다.

### 필수 환경 변수

#### AWS Configuration

```
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here
```

#### DynamoDB Tables

```
DYNAMO_GALLERIES_TABLE=snaprace-galleries-prod
DYNAMO_EVENTS_TABLE=snaprace-events-prod
DYNAMO_PHOTOS_TABLE=snaprace-photos-prod
DYNAMO_FEEDBACKS_TABLE=snaprace-feedbacks-prod
DYNAMO_ORGANIZATIONS_TABLE=snaprace-organizations-prod
DYNAMO_TIMING_RESULTS_TABLE=snaprace-timing-results-prod
```

#### S3 Bucket

```
BUCKET=your-s3-bucket-name
```

#### Auth.js (NextAuth)

```
# Generate with: openssl rand -base64 32
AUTH_SECRET=your_production_auth_secret_here

# Vercel will auto-generate this for preview deployments
# For production, use your custom domain
AUTH_URL=https://your-domain.com
```

#### Crisp Chat

```
CRISP_WEBSITE_ID=your_crisp_website_id
```

---

## 환경별 설정

### Production 환경

Production 환경에서는 실제 프로덕션 AWS 리소스를 사용합니다.

- DynamoDB 테이블: `snaprace-*-prod`
- S3 버킷: 프로덕션 버킷
- AUTH_URL: `https://your-domain.com`

### Preview 환경

Preview 환경(Pull Request)에서는 개발용 AWS 리소스를 사용하거나 프로덕션과 동일한 리소스를 사용할 수 있습니다.

- AUTH_URL: Vercel이 자동으로 생성 (설정 불필요)

---

## 로컬 개발 환경 설정

로컬에서 개발하려면 `.env.local` 파일을 생성하세요.

### 1. .env.local 파일 생성

```bash
cd apps/web
touch .env.local
```

### 2. 환경 변수 입력

```bash
# ============================================
# AWS Configuration
# ============================================
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# ============================================
# DynamoDB Tables
# ============================================
DYNAMO_GALLERIES_TABLE=snaprace-galleries-dev
DYNAMO_EVENTS_TABLE=snaprace-events-dev
DYNAMO_PHOTOS_TABLE=snaprace-photos-dev
DYNAMO_FEEDBACKS_TABLE=snaprace-feedbacks-dev
DYNAMO_ORGANIZATIONS_TABLE=snaprace-organizations-dev
DYNAMO_TIMING_RESULTS_TABLE=snaprace-timing-results-dev

# ============================================
# S3 Bucket
# ============================================
BUCKET=your-dev-s3-bucket-name

# ============================================
# Auth.js (NextAuth) Configuration
# ============================================
AUTH_SECRET=your_local_auth_secret
AUTH_URL=http://localhost:3000

# ============================================
# Crisp Chat
# ============================================
CRISP_WEBSITE_ID=your_crisp_website_id
```

### 3. 환경 변수 검증

```bash
# 앱이 정상적으로 시작되는지 확인
pnpm dev

# 환경 변수 검증 스킵 (Docker 빌드 등)
SKIP_ENV_VALIDATION=1 pnpm dev
```

---

## 배포 워크플로우

### 1. Git Push

```bash
git push origin main
```

### 2. Vercel 자동 배포

- `main` 브랜치: Production 배포
- 기타 브랜치/PR: Preview 배포

### 3. 배포 확인

- Vercel 대시보드에서 배포 로그 확인
- 배포 완료 후 URL로 접속하여 테스트

---

## 문제 해결

### 빌드 실패 시

#### 1. 환경 변수 누락

```
Error: Invalid environment variables
```

→ Vercel 대시보드에서 필수 환경 변수가 모두 설정되었는지 확인

#### 2. 모노레포 빌드 에러

```
Error: Cannot find module '@repo/web'
```

→ Root Directory가 `apps/web`으로 설정되었는지 확인
→ Install Command가 `cd ../.. && pnpm install`로 설정되었는지 확인

#### 3. Next.js 빌드 에러

```
Error: Build failed
```

→ 로컬에서 `pnpm build` 실행하여 빌드 테스트
→ 로그에서 구체적인 에러 메시지 확인

### 런타임 에러 시

#### 1. AWS 리소스 접근 실패

→ AWS 자격 증명이 올바른지 확인
→ IAM 권한이 충분한지 확인 (DynamoDB, S3, Rekognition)

#### 2. Auth 에러

→ AUTH_SECRET이 설정되었는지 확인
→ AUTH_URL이 올바른 도메인으로 설정되었는지 확인

---

## 보안 고려사항

### 1. 환경 변수 관리

- **절대 커밋하지 마세요**: `.env.local`, `.env.production` 등
- **팀 공유**: 안전한 방법으로 환경 변수 공유 (1Password, AWS Secrets Manager 등)
- **정기 교체**: AUTH_SECRET, AWS 자격 증명 정기적으로 교체

### 2. AWS IAM 권한

최소 권한 원칙에 따라 필요한 권한만 부여:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/snaprace-*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    },
    {
      "Effect": "Allow",
      "Action": ["rekognition:DetectFaces", "rekognition:SearchFacesByImage"],
      "Resource": "*"
    }
  ]
}
```

---

## 참고 자료

- [Vercel Monorepo 가이드](https://vercel.com/docs/monorepos)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Turborepo 배포 가이드](https://turbo.build/repo/docs/handbook/deploying-with-docker)
- [Auth.js Deployment](https://authjs.dev/getting-started/deployment)

---

**작성일**: 2025-11-01  
**최종 수정**: 2025-11-01
