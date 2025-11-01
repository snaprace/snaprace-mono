# Web App 모노레포 통합 실행 계획

**시작일**: 2025-11-01  
**상태**: 진행 중  
**우선순위**: 높음

> **참고**: 자세한 계획은 `/docs/spec/web-app-monorepo-integration.md` 참조

---

## 🎯 목표

SnapRace Web 앱을 turborepo 모노레포 환경에 완전히 통합하여:
- 루트에서 `pnpm dev` 실행 시 정상 작동
- 루트에서 `pnpm build` 실행 시 정상 빌드
- Vercel 배포 준비 완료

---

## ✅ Phase 1: 패키지 의존성 정리

### 1.1 pnpm 버전 통일

**목표**: 루트와 apps/web의 pnpm 버전을 10.8.0으로 통일

```bash
# 현재 상태 확인
pnpm --version

# 루트 디렉토리에서 실행
cd /Users/chan/Desktop/develop/snaprace-mono
```

**작업**:
- [ ] 루트 `package.json`의 `packageManager` 필드를 `"pnpm@10.8.0"`으로 변경
- [ ] 터미널에서 pnpm 버전 확인: `pnpm --version`
- [ ] 필요시 pnpm 업그레이드: `npm install -g pnpm@10.8.0`

**파일 변경**:
```json
// /Users/chan/Desktop/develop/snaprace-mono/package.json
{
  "packageManager": "pnpm@10.8.0"  // 9.0.0 → 10.8.0
}
```

### 1.2 전체 프로젝트 재설치

**작업**:
- [ ] 루트의 `node_modules` 삭제: `rm -rf node_modules`
- [ ] 루트의 `pnpm-lock.yaml` 삭제: `rm pnpm-lock.yaml`
- [ ] apps/web의 `node_modules` 삭제: `rm -rf apps/web/node_modules`
- [ ] 전체 재설치: `pnpm install`
- [ ] 설치 에러가 없는지 확인

**예상 시간**: 5-10분

### 1.3 설치 확인

**작업**:
- [ ] `ls -la node_modules` 실행하여 node_modules 생성 확인
- [ ] `ls -la apps/web/node_modules` 실행하여 apps/web의 node_modules 확인
- [ ] `pnpm list` 실행하여 워크스페이스 패키지 목록 확인

**성공 기준**:
```bash
$ pnpm list
Legend: production dependency, optional only, dev only

/Users/chan/Desktop/develop/snaprace-mono
├─┬ apps/docs
├─┬ apps/infra
└─┬ apps/web  # ← 이 항목이 보여야 함
```

---

## ✅ Phase 2: Turborepo 통합

### 2.1 apps/web package.json 수정

**목표**: apps/web을 모노레포 네이밍 규칙에 맞게 변경

**파일 변경**:
```json
// apps/web/package.json
{
  "name": "@repo/web",  // "snaprace" → "@repo/web"
  "scripts": {
    "build": "next build",
    "dev": "next dev --turbo",
    "lint": "next lint",
    "check-types": "tsc --noEmit",  // "typecheck" → "check-types"
    "test": "vitest"
  }
}
```

**작업**:
- [ ] apps/web/package.json 열기
- [ ] `name` 필드를 `"@repo/web"`으로 변경
- [ ] `scripts.typecheck`를 `scripts.check-types`로 이름 변경
- [ ] 불필요한 스크립트 제거:
  - `check`
  - `format:check`
  - `format:write`
  - `lint:fix`
  - `preview`
  - `start`
- [ ] 파일 저장

### 2.2 turbo.json 업데이트

**목표**: test 태스크 추가 및 환경 변수 입력 명시

**파일 변경**:
```json
// turbo.json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "**/*.test.{ts,tsx}"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**작업**:
- [ ] turbo.json 파일 열기
- [ ] `test` 태스크 추가
- [ ] 파일 저장

### 2.3 루트 package.json 스크립트 추가

**목표**: 루트에서 개별 앱 실행 및 테스트 가능하게 설정

**파일 변경**:
```json
// package.json (루트)
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "check-types": "turbo run check-types",
    "test": "turbo run test",
    "dev:web": "turbo run dev --filter=@repo/web",
    "dev:docs": "turbo run dev --filter=docs",
    "build:web": "turbo run build --filter=@repo/web",
    "build:docs": "turbo run build --filter=docs"
  }
}
```

**작업**:
- [ ] 루트 package.json 열기
- [ ] `test` 스크립트 추가
- [ ] `dev:web`, `dev:docs` 스크립트 추가
- [ ] `build:web`, `build:docs` 스크립트 추가
- [ ] 파일 저장

### 2.4 로컬 테스트

**작업**:
- [ ] **테스트 1**: 루트에서 `pnpm dev:web` 실행
  - apps/web이 정상적으로 시작되는지 확인
  - 브라우저에서 `http://localhost:3000` 접속 확인
  - Ctrl+C로 종료
  
- [ ] **테스트 2**: 루트에서 `pnpm build:web` 실행
  - 빌드가 성공하는지 확인
  - `.next` 폴더가 생성되는지 확인
  
- [ ] **테스트 3**: 루트에서 `pnpm lint` 실행
  - 린팅이 정상적으로 실행되는지 확인
  
- [ ] **테스트 4**: 루트에서 `pnpm check-types` 실행
  - 타입 체크가 정상적으로 실행되는지 확인

**성공 기준**:
- 모든 명령이 에러 없이 실행됨
- apps/web이 정상적으로 시작되고 빌드됨

---

## ⚠️ Phase 3: 환경 변수 관리

### 3.1 현재 환경 변수 확인

**작업**:
- [ ] apps/web/src/env.js 파일 열기
- [ ] 필수 환경 변수 목록 확인
- [ ] apps/web/.env.example 파일 확인

**확인 사항**:
```javascript
// src/env.js에서 확인할 항목
// - server: 서버 사이드 환경 변수
// - client: 클라이언트 사이드 환경 변수 (NEXT_PUBLIC_*)
```

### 3.2 .env.local.example 파일 생성

**목표**: 개발자들이 쉽게 로컬 환경 설정할 수 있도록 템플릿 제공

**작업**:
- [ ] apps/web/.env.local.example 파일 생성
- [ ] 필수 환경 변수 나열 (값은 비워둠)
- [ ] 각 변수에 설명 주석 추가

**파일 내용**:
```bash
# apps/web/.env.local.example

# AWS Configuration
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here

# DynamoDB Tables
DYNAMODB_TABLE_PHOTOS=your_photos_table
DYNAMODB_TABLE_EVENTS=your_events_table
DYNAMODB_TABLE_USERS=your_users_table

# S3
S3_BUCKET_NAME=your_bucket_name

# Auth (Next-Auth)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# (기타 필요한 환경 변수 추가)
```

### 3.3 .gitignore 확인

**작업**:
- [ ] apps/web/.gitignore 파일 열기
- [ ] `.env*.local` 항목이 있는지 확인
- [ ] 없으면 추가

**확인/추가할 항목**:
```
# env files
.env*.local
.env.development
.env.staging
.env.production
```

### 3.4 Vercel 환경 변수 목록 문서화

**작업**:
- [ ] apps/web/docs/vercel-setup.md 파일 생성
- [ ] Vercel에서 설정해야 할 환경 변수 목록 작성
- [ ] 프로덕션/프리뷰 환경 구분 명시

**파일 생성**:
```markdown
# apps/web/docs/vercel-setup.md

# Vercel 배포 설정 가이드

## 모노레포 설정

- **Framework Preset**: Next.js
- **Root Directory**: `apps/web`
- **Build Command**: `cd ../.. && pnpm build:web`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`

## 환경 변수

### Production & Preview 공통
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- DYNAMODB_TABLE_PHOTOS
- DYNAMODB_TABLE_EVENTS
- DYNAMODB_TABLE_USERS
- S3_BUCKET_NAME
- NEXTAUTH_SECRET

### Production만
- NEXTAUTH_URL: https://your-domain.com

### Preview만
- NEXTAUTH_URL: (Vercel이 자동 설정)
```

---

## 🔧 Phase 4: Vercel 설정 확인

### 4.1 vercel.json 파일 필요 여부 확인

**작업**:
- [ ] apps/web에 vercel.json 파일이 있는지 확인
- [ ] 없으면 기본 설정 사용 (대부분의 경우 불필요)
- [ ] 특수 설정 필요 시 생성

**필요한 경우만 생성**:
```json
// apps/web/vercel.json (선택사항)
{
  "buildCommand": "cd ../.. && pnpm build:web",
  "installCommand": "cd ../.. && pnpm install"
}
```

### 4.2 모노레포 빌드 테스트

**작업**:
- [ ] 루트에서 `pnpm build` 실행
- [ ] apps/web의 빌드가 성공하는지 확인
- [ ] apps/docs의 빌드도 함께 성공하는지 확인

**성공 기준**:
```bash
$ pnpm build

@repo/web:build: ✓ Compiled successfully
docs:build: ✓ Compiled successfully

 Tasks:    2 successful, 2 total
```

---

## 📝 Phase 5: 문서 업데이트

### 5.1 루트 README 업데이트

**작업**:
- [ ] README.md 파일 열기
- [ ] 프로젝트 구조 섹션 추가
- [ ] 빠른 시작 가이드 추가
- [ ] 개발 명령어 정리

**추가할 내용**:
```markdown
# SnapRace Monorepo

## 프로젝트 구조

- `apps/web`: SnapRace 메인 웹 애플리케이션 (Next.js 15)
- `apps/docs`: 문서 사이트 (Next.js 16)
- `apps/infra`: AWS CDK 인프라
- `packages/`: 공유 패키지

## 빠른 시작

\`\`\`bash
# 의존성 설치
pnpm install

# 모든 앱 개발 서버 시작
pnpm dev

# 특정 앱만 시작
pnpm dev:web    # http://localhost:3000
pnpm dev:docs   # http://localhost:3001

# 빌드
pnpm build

# 테스트
pnpm test

# 타입 체크
pnpm check-types
\`\`\`

## 환경 변수 설정

apps/web 개발을 위해서는 `.env.local` 파일이 필요합니다:

\`\`\`bash
cd apps/web
cp .env.local.example .env.local
# .env.local 파일을 열어 실제 값 입력
\`\`\`
```

### 5.2 apps/web README 업데이트

**작업**:
- [ ] apps/web/README.md 파일 확인
- [ ] 모노레포 환경에서의 개발 방법 추가
- [ ] 환경 변수 설정 가이드 추가

---

## 🎯 최종 검증 체크리스트

### 로컬 개발 환경

- [ ] 루트에서 `pnpm install` 성공
- [ ] 루트에서 `pnpm dev:web` 실행 → 정상 시작
- [ ] 브라우저에서 `http://localhost:3000` 접속 → 정상 작동
- [ ] Hot reload 작동 확인 (파일 수정 후 자동 새로고침)
- [ ] 루트에서 `pnpm build:web` → 빌드 성공
- [ ] 루트에서 `pnpm lint` → 린팅 성공
- [ ] 루트에서 `pnpm check-types` → 타입 체크 성공

### 모노레포 통합

- [ ] `pnpm list`에서 @repo/web이 보임
- [ ] apps/web의 package.json name이 `@repo/web`
- [ ] turbo.json에 test 태스크 추가됨
- [ ] 루트 package.json에 개별 앱 실행 스크립트 추가됨

### 환경 변수

- [ ] .env.local.example 파일 생성
- [ ] .gitignore에 .env*.local 추가 확인
- [ ] Vercel 설정 가이드 문서 작성

### 문서

- [ ] 루트 README 업데이트
- [ ] apps/web README 업데이트
- [ ] Vercel 배포 가이드 작성

---

## 🚨 문제 해결

### pnpm install 실패 시

```bash
# 캐시 삭제
pnpm store prune

# node_modules 전체 삭제
rm -rf node_modules apps/*/node_modules packages/*/node_modules

# lock 파일 삭제
rm pnpm-lock.yaml

# 재설치
pnpm install
```

### 빌드 실패 시

```bash
# 빌드 캐시 삭제
rm -rf apps/web/.next
rm -rf apps/docs/.next

# Turbo 캐시 삭제
rm -rf node_modules/.cache/turbo

# 재빌드
pnpm build
```

### 타입 에러 발생 시

```bash
# TypeScript 서버 재시작 (VS Code)
# Cmd+Shift+P → "TypeScript: Restart TS Server"

# 타입 정의 재설치
cd apps/web
pnpm install @types/node @types/react @types/react-dom
```

---

## 📊 진행 상황

- [ ] Phase 1: 패키지 의존성 정리 (0/3 완료)
- [ ] Phase 2: Turborepo 통합 (0/4 완료)
- [ ] Phase 3: 환경 변수 관리 (0/4 완료)
- [ ] Phase 4: Vercel 설정 확인 (0/2 완료)
- [ ] Phase 5: 문서 업데이트 (0/2 완료)
- [ ] 최종 검증 (0/16 완료)

**전체 진행률**: 0% (0/31 작업 완료)

---

## 💡 다음 단계

1. Phase 1부터 순차적으로 진행
2. 각 Phase 완료 후 체크리스트 업데이트
3. 문제 발생 시 "문제 해결" 섹션 참조
4. 모든 Phase 완료 후 Vercel 배포 테스트

---

**작성자**: Claude  
**최종 수정일**: 2025-11-01

