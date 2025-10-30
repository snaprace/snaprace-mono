# CLAUDE.md

이 파일은 Claude Code (claude.ai/code)가 이 저장소에서 작업할 때 참조하는 가이드입니다.

## 엔지니어링 원칙

이 프로젝트에서는 일론 머스크의 5단계 엔지니어링 원칙을 따릅니다.

### 1. 설계 요구사항 검증
초기 설계나 요구사항은 무조건 옳다고 가정하지 말고, 근본적인 진실을 찾기 위해 반복적으로 의심하고 검증해야 합니다. 똑똑한 사람이 만든 기준일수록 특히 검증이 더 필요합니다.

### 2. 불필요한 부분 제거
혹시나 필요할지도 모른다는 이유로 추가된 불필요한 부품, 기능, 프로세스를 적극적으로 없애야 합니다. 제거가 추가보다 더 중요합니다.

### 3. 단순화 및 최적화
복잡한 구조, 불필요한 최적화에 집착하지 말고, 더욱 단순하게 만들어야 합니다. 애초에 필요 없는 부분을 최적화하는 실수를 경계해야 합니다.

### 4. 생산 속도 향상
앞의 세 단계를 충분히 검증했을 때만 생산을 가속화해야 하며, 그렇지 않으면 방향성 없는 자원 낭비가 됩니다. 속도보다 정확성이 우선입니다.

### 5. 자동화
자동화는 반드시 마지막 단계에서 도입되어야 하며, 본질적 문제가 모두 해결된 뒤 자동화해야 효과를 볼 수 있습니다. 자동화가 먼저 진행되면 생산지옥에 빠질 수 있습니다.

## TDD 기반 인프라 개발 원칙

@apps/infra/의 모든 인프라 기능 개발은 반드시 TDD(Test-Driven Development) 방식으로 진행해야 합니다.

### TDD 개발 사이클
1. **Red 단계**: 실패하는 테스트 먼저 작성
2. **Green 단계**: 테스트를 통과하는 최소한의 코드 작성
3. **Refactor 단계**: 코드 개선 및 중복 제거

### 인프라 TDD 적용 방법
- 모든 CDK 스택, 컨스트럭트, 리소스에 대한 단위 테스트 작성
- 인프라 변경 전 관련 테스트를 먼저 실행하여 실패 확인
- 테스트를 통과시키는 데 필요한 최소한의 인프라 코드만 작성
- 테스트 통과 후 리팩토링을 통해 코드 개선
- `cd apps/infra && pnpm test` 명령어로 모든 테스트 실행 및 검증

### 테스트 커버리지 요구사항
- 모든 새로운 인프라 리소스는 100% 테스트 커버리지 필수
- 인프라 변경 시 반드시 관련 테스트 케이스 함께 작성
- Jest와 CDK의 템플릿 기반 테스트 활용

## 프로젝트 개요

SnapRace는 TypeScript 설정으로 구성된 Turborepo 모노레포 프로젝트입니다. Next.js 애플리케이션과 공유 패키지를 포함하며, pnpm을 패키지 매니저로 사용하고 현대적인 React/Next.js 개발 방식을 따릅니다.

## 저장소 구조

```
snaprace-mono/
├── apps/
│   ├── web/          # 메인 Next.js 애플리케이션 (포트 3000)
│   ├── docs/         # 문서 Next.js 애플리케이션 (포트 3001)
│   └── infra/        # AWS CDK 인프라 (TypeScript)
└── packages/
    ├── ui/           # 공유 React 컴포넌트 라이브러리
    ├── eslint-config/ # ESLint 설정
    └── typescript-config/ # TypeScript 설정
```

## 개발 명령어

### 루트 레벨 명령어
- `pnpm dev` - 모든 애플리케이션 개발 모드 시작
- `pnpm build` - 모든 애플리케이션 및 패키지 빌드
- `pnpm lint` - 모든 패키지에서 ESLint 실행
- `pnpm check-types` - 모든 TypeScript 코드 타입 검사
- `pnpm format` - Prettier로 코드 포맷팅

### 애플리케이션별 명령어
Turborepo 필터를 사용하여 특정 애플리케이션 작업:
- `pnpm turbo dev --filter=web` - 웹 앱만 시작 (포트 3000)
- `pnpm turbo dev --filter=docs` - 문서 앱만 시작 (포트 3001)
- `pnpm turbo build --filter=web` - 웹 앱만 빌드
- `pnpm turbo lint --filter=@repo/ui` - UI 패키지만 린트

### 인프라 명령어
- `cd apps/infra && pnpm cdk` - AWS CDK 명령어 실행
- `cd apps/infra && pnpm test` - 인프라 테스트 실행
- `cd apps/infra && pnpm build` - 인프라 TypeScript 컴파일

## 아키텍처 상세 정보

### 애플리케이션
- **web**: React 19를 사용하는 Next.js 16 앱, 포트 3000에서 실행
- **docs**: React 19를 사용하는 Next.js 16 앱, 포트 3001에서 실행
- 두 앱 모두 App Router 구조 사용 (app/ 디렉토리)
- 두 앱 모두 `@repo/ui` 컴포넌트 라이브러리 공유

### 공유 패키지
- **@repo/ui**: package.json에 export가 정의된 React 컴포넌트 라이브러리
- **@repo/eslint-config**: base, next-js, react-internal 설정 제공
- **@repo/typescript-config**: 공유 TypeScript 설정

### 인프라
- TypeScript로 작성된 AWS CDK 애플리케이션
- `apps/infra/`에 위치
- 인프라 코드로 CDK v2 사용

## 코드 스타일 및 설정

### ESLint
- `@repo/eslint-config`의 커스텀 ESLint 설정 사용
- 설정: base.js, next.js, react-internal.js
- `turbo/no-undeclared-env-vars`로 Turbo 모범 사례 강제
- 빌드 파이프라인에서 경고 0 허용

### TypeScript
- 모든 패키지에서 엄격한 TypeScript 설정
- `@repo/typescript-config`의 공유 설정 사용
- 모든 패키지가 `tsc --noEmit`으로 타입 검사됨

### React 컴포넌트
- 클라이언트 컴포넌트에 "use client" 디렉티브와 React 19 사용
- `@repo/ui`의 컴포넌트는 앱 간 재사용 가능하도록 설계됨
- 예시 패턴: 앱 식별을 위한 `appName` prop을 가진 Button 컴포넌트

## 개발 워크플로우

1. 의존성 설치: `pnpm install`
2. 개발 시작: `pnpm dev` (각 포트에서 모든 앱 시작)
3. `packages/ui/src/`에서 공유 컴포넌트 수정
4. 앱이 워크스페이스 패키지 변경사항을 자동으로 반영
5. 모든 패키지가 성공적으로 빌드되는지 확인하려면 `pnpm build` 실행
6. 커밋 전 `pnpm lint`와 `pnpm check-types` 실행

## 패키지 관리

- **패키지 매니저**: pnpm (필요: pnpm@9.0.0)
- **Node 버전**: >=18
- **워크스페이스**: pnpm-workspace.yaml로 구성됨
- **의존성**: 가능한 워크스페이스 의존성으로 관리됨

## 테스트 정보

- 인프라 테스트는 `apps/infra/`에서 Jest 사용
- 인프라 테스트 실행: `cd apps/infra && pnpm test`
- 웹/문서 앱이나 UI 패키지에 대한 단위 테스트 설정은 현재 없음

## 주요 파일

- `turbo.json`: Turborepo 작업 설정 및 캐싱 규칙
- `pnpm-workspace.yaml`: 워크스페이스 패키지 정의
- `package.json`: 스크립트 및 개발 의존성이 있는 루트 패키지
- `apps/*/package.json`: 개별 앱 설정
- `packages/*/package.json`: 공유 패키지 설정