# 작업 계획 — 타이밍 결과 라우터 리팩터링 및 테스트 구축

## 배경
- `src/server/api/routers/results.ts` 는 DynamoDB/S3 조회, 데이터 매핑, 에러 처리 로직을 단일 파일에 모두 담고 있어 가독성과 테스트 작성이 어렵다.
- 에러 메시지가 한국어/영어 혼용 상태이며 재사용 가능한 공통 모듈이 없다.
- 테스트 인프라가 부재해 의도 문서화가 어렵다.

## 목표
1. 타이밍 결과 매핑/검증 로직을 서비스 모듈로 분리해 재사용성과 테스트 용이성을 확보한다.
2. tRPC 에러 메시지를 영어로 통일하고, 재사용 가능한 에러 유틸리티를 도입한다.
3. Vitest 기반 테스트 환경을 구축하여 핵심 로직(데이터 매핑, 예외 흐름)을 문서화한다.

## 작업 항목
1. **구조 리팩터링**
   - `src/server/services/timing-service.ts` 생성: DynamoDB 조회(새 PK/SK 스키마 반영), S3 데이터 매핑, 타입 가드, 에러 유틸 분리.
   - `results.ts`는 입력 검증과 서비스 호출, 에러 래핑만 담당하도록 단순화.

2. **에러 공통화**
   - `src/server/api/error-utils.ts` (혹은 유사 경로)에서 `createNotFoundError`, `createBadRequestError`, `createInternalError` 등 헬퍼 제공.
   - 모든 메시지는 영어로 정의하고 재사용되도록 상수화.

3. **테스트 인프라**
   - `vitest` 및 관련 타입 의존성 추가, `pnpm test` 스크립트 구성.
   - `vitest.config.ts` 작성.
   - S3/Dynamo 의존성은 mock/stub으로 대체해 순수 함수 테스트.

4. **테스트 케이스**
   - `getBibDetail` 및 보조 함수에 대해 JSON fixture(`src/mock/*.json`) 활용 테스트.
   - 비정상 데이터(잘못된 row index, missing row 등)에 대한 예외 흐름 검증.
   - `fetchTimingItem`는 DynamoDB QueryCommand가 올바른 PK/SK 조합을 사용하는지 mock으로 확인.

5. **문서/정리**
   - 수행 결과 요약(각 함수 역할, 테스트 의도) 참고 주석 최소화.
   - `pnpm check`, `pnpm test` 실행 및 결과 확인.

## 주의 사항
- 서비스 제공 언어는 영어 유지, 설명/문서는 한국어.
- 기존 호출부(프런트엔드) API 스펙은 변경하지 않는다.
- 추후 다른 tRPC 라우터도 재사용 가능하도록 에러 유틸은 범용적으로 설계한다.
