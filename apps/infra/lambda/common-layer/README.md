# Common Layer for Lambda Functions

이 디렉토리는 Lambda 함수들이 공유하는 공통 의존성을 포함합니다.

## 구조

```
common-layer/
└── nodejs/
    ├── package.json  # 공통 의존성 정의
    └── node_modules/ # npm install 후 생성됨
```

## 설치 방법

```bash
cd apps/infra/lambda/common-layer/nodejs
npm install
```

## 의존성 관리

공통 의존성은 `nodejs/package.json`에서 관리됩니다. 의존성을 추가하거나 업데이트한 후:

1. `npm install` 실행
2. CDK 배포 (`cdk deploy`)

## 참고사항

- Lambda Layer는 `nodejs/` 디렉토리 구조를 따라야 합니다
- CDK가 Layer를 빌드할 때 자동으로 `npm install`을 실행합니다
- 모든 Lambda 함수에서 이 Layer를 사용할 수 있습니다
