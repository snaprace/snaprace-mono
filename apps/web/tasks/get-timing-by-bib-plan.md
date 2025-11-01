# 구현 계획 — `results.getTimingByBib`

## 목표

`tRPC` 공개 쿼리 `results.getTimingByBib`를 추가하여 특정 이벤트와 비브 번호에 대한 상세 타이밍 데이터를 반환한다. 데이터는 DynamoDB `TimingResults` 테이블과 S3 `snap-race` 버킷에 저장된 결과 JSON을 기반으로 하며, 단일 결과셋(정확한 `resultSetId`)과 다중 결과셋(결과셋 미지정) 흐름 모두를 지원해야 한다.

## 현재 환경 및 제약

- DynamoDB 접근은 `@/lib/dynamodb`에서 DocumentClient와 테이블 이름을 관리하고 있다. 타이밍 전용 테이블에 접근하려면 동일한 패턴을 확장해야 한다.
- 아직 공용 S3 클라이언트가 없으므로 타이밍 JSON을 읽기 위한 전용 S3 클라이언트가 필요하다.
- tRPC 라우터는 `src/server/api/routers`에 위치하며 `src/server/api/root.ts`에서 결합된다. 공개 엔드포인트는 `publicProcedure`를 사용한다.
- 에러 처리 일관성을 위해 `TRPCError`를 사용해야 한다.
- 빌드 시 환경 변수를 검증하는 `src/env.js`에 새 변수를 추가해야 한다.
- `src/mock/*.json`은 S3에 올라간 결과 JSON의 로컬 스냅샷이므로 구조 및 필드 매핑을 이해하는 참고 자료로 활용한다.

## 구현 단계

1. **의존성 및 환경 변수 정리**
   - `package.json`에 `@aws-sdk/client-s3`를 추가한다.
   - `src/env.js`의 `server` 스키마에 `DYNAMO_TIMING_RESULTS_TABLE`, `BUCKET`을 `z.string().min(1)`로 정의하고 `runtimeEnv`에 노출한다.
   - `.env.local.example`에 기본값(예: `TimingResults`, `snap-race`)을 주석과 함께 추가한다.

2. **AWS 클라이언트 유틸리티 확장**
   - 기존 `@/lib/dynamodb`의 `TABLES`에 `TIMING_RESULTS: env.DYNAMO_TIMING_RESULTS_TABLE`을 추가하거나 동등한 상수를 내보낸다.
   - `src/server/aws/clients.ts` 파일을 새로 만들어 `DynamoDBClient`, `S3Client` 인스턴스를 생성하고 `DYNAMO_TIMING_RESULTS_TABLE`, `BUCKET` 상수를 함께 내보낸다.
   - 추후 다른 서버 유틸에서 재사용할 수 있도록 기본 자격 증명은 환경 변수에 위임한다.

3. **S3 JSON 로더 작성**
   - `src/server/utils/s3json.ts`를 생성하여 `getJsonFromS3(key: string)` 함수를 구현한다.
   - `GetObjectCommand`로 JSON을 가져오고, `Body` 스트림을 UTF-8 문자열로 변환한 뒤 `JSON.parse`한다.
   - 404 등 예외 발생 시 적절한 메시지를 던져 라우터에서 `TRPCError`로 변환할 수 있도록 한다.

4. **DynamoDB 조회 헬퍼**
   - `results` 라우터 내부에 `fetchTimingItems(eventId, bib, resultSetId?)` 헬퍼를 작성한다.
   - `resultSetId`가 있으면 `KeyConditionExpression: event_id = :e AND sort_key = :sk`로 단건 조회하고 `Limit 1`을 설정한다.
   - 없으면 `begins_with(sort_key, :prefix)` 조건으로 모든 결과셋을 조회한다. 실제 데이터량이 크지 않다면 `Limit`를 두지 않고 필요 시 추후 페이지네이션을 고려한다.
   - 조회 결과는 `unmarshall`로 변환하여 `s3_key`, `row_index`, `result_set_id`, `category` 등 필요한 필드를 가진 타입(`TimingResultRow`)으로 정리한다.

5. **행 매핑 및 상세 데이터 조립**
   - `mapRowToObject(headings, row)` 함수를 만들어 `headings[].key`와 결과 행의 동일 인덱스를 매핑한다.
   - `buildTimingDetail(rowData, cache)` 함수에서 다음을 수행한다:
     - 요청 스코프 `Map<string, any>` 캐시를 사용해 동일한 `s3_key`에 대해 S3 호출을 한 번만 수행한다.
     - JSON의 `headings`, `resultSet.results`, `resultUrls`를 사용하여 `row_index` 검증 후 행 데이터를 로드한다.
     - `age`는 숫자로 변환 시도 후 실패하면 `null`로 처리한다.
     - `bib_num`, `name`, `gender`, `chip_time` 등 대표 필드는 우선 JSON 행 값을 사용하고 없으면 DynamoDB 필드를 fallback으로 사용한다.
     - `raw`에는 전체 헤더-값 매핑 객체를 그대로 담는다.
     - `result_url`은 `resultUrls[row_index]`가 존재할 때만 채운다.

6. **tRPC 라우터 구현**
   - `src/server/api/routers/results.ts`를 생성하고 다음을 정의한다:
     - Zod `InputSchema`: `eventId`/`bib`는 필수 문자열, `bib`은 `trim()`, `resultSetId`는 선택.
     - `TimingDetail` 타입: 브리프에서 요구한 필드와 `raw` 맵을 포함.
     - `publicProcedure` 기반 `getTimingByBib` 쿼리: DynamoDB 조회 → S3 데이터 로딩 → 세부 정보 매핑 → 단일 혹은 배열 결과 반환.
   - DynamoDB에서 레코드가 없으면 `throw new TRPCError({ code: "NOT_FOUND", message: ... })`를 던지고, `row_index` 범위 오류나 S3 miss는 `BAD_REQUEST`로 매핑한다. 그 외 예상치 못한 예외는 `INTERNAL_SERVER_ERROR`로 변환한다.

7. **라우터 합치기 및 타입 정리**
   - `src/server/api/root.ts`에서 `results: resultsRouter`를 추가한다.
   - 필요하다면 `src/types/trpc.ts`에 `TimingDetail` 타입 alias를 추가해 프런트엔드에서 쉽게 참조할 수 있도록 한다.

8. **검증 및 참고 데이터 활용**
   - 로컬에서 `src/mock/*.json`을 사용하여 S3 JSON 구조와 헤더 키를 미리 확인한다.
   - 커스텀 스크립트 또는 tRPC caller를 이용해 다음 시나리오를 수동 확인한다:
     - `(eventId, bib, resultSetId)` 유효 조합 → 단일 상세 객체 반환 및 `bib_num`, `name`, `chip_time` 확인.
     - `resultSetId` 생략 → 카테고리별 배열 반환 및 동일 `s3_key`가 여러 번 나오더라도 캐시가 재사용되는지 확인.
     - 존재하지 않는 비브 → `NOT_FOUND` 응답, `row_index`를 의도적으로 잘못 넣은 데이터로 `BAD_REQUEST` 응답 확인.
   - `pnpm check`를 실행하여 타입/린트 검사를 통과한다.

## 추가 고려사항

- DynamoDB 응답이 1MB를 초과할 가능성이 있다면 추후 페이징 처리를 도입해야 한다.
- S3 클라이언트에 별도의 리전 지정이 필요한지 검토한다(현재는 환경 변수 기반 기본값 사용 예정).
- 타 기능에서 S3 JSON 로더를 재사용할 수 있도록 향후 위치(`src/server/aws` vs `src/lib`)를 재평가할 여지가 있다.
