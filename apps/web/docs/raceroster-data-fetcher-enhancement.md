# RaceRoster Data Fetcher Enhancement Plan

## Overview

기존 `fetch-raceroster-data.js` 스크립트를 개선하여 여러 SubEvent의 데이터를 동적으로 처리하고, 각 SubEvent별로 별도의 JSON 파일을 생성하는 기능을 구현합니다.

## Current Implementation Analysis

### 현재 스크립트 동작 방식
1. **하드코딩된 설정**: 단일 Event ID (`98041`)와 SubEvent ID (`242107`)만 처리
2. **고정된 출력**: 단일 `5k.json` 파일만 생성
3. **수동 구성**: 새로운 이벤트 처리 시 코드 직접 수정 필요

### 제한사항
- 여러 SubEvent 동시 처리 불가
- 확장성 부족
- 재사용성 낮음

## Enhanced Implementation Plan

### 1. API Flow 개선

#### 새로운 API 호출 순서
```
1. GET /v2/api/events/{eventUniqueCode}
   └── subEvents 목록 조회

2. 각 SubEvent별 병렬 처리:
   ├─ GET /v2/api/result-events/{eventId}/sub-events/{subEventId}/results
   └─ 참가자별 상세 정보 조회 (병렬 처리)
      └─ GET /v2/api/events/{eventUniqueCode}/detail/{participantId}
```

### 2. 데이터 구조 개선

#### 입력 파라미터
```javascript
const CONFIG = {
  eventUniqueCode: 'dutbkx7e2epftx4x',  // 이벤트 고유 코드
  eventId: 98823,                      // 이벤트 ID (API에서 자동 추출 가능)
  limit: 1000,                         // 페이지당 결과 수
  outputDir: path.join(__dirname, 'raceroster'),
  subEvents: 'all'                     // 'all' 또는 특정 SubEvent ID 배열
};
```

#### 출력 파일 구조
```
raceroster/
├── index.json                 # 전체 이벤트 정보 및 SubEvent 목록
├── half-marathon.json         # SubEvent 1 결과
├── half-marathon-relay.json   # SubEvent 2 결과
└── 5k.json                   # SubEvent 3 결과
```

### 3. 주요 기능 개선

#### 동적 SubEvent 처리
- API를 통해 SubEvent 목록 자동 조회
- 각 SubEvent별 별도 파일 생성
- SubEvent 이름 기반으로 파일명 자동 생성

#### 성능 최적화
- SubEvent별 병렬 처리
- 참가자 상세 정보 배치 처리
- Rate limiting 적용

#### 에러 핸들링 강화
- API 실패 시 재시도 로직
- 부분 성공 시 중단점 저장
- 상세한 로깅

#### 확장성 개선
- 커맨드 라인 인자 지원
- 설정 파일 외부화
- 모듈화된 아키텍처

## Implementation Details

### 1. 새로운 함수 구조

```javascript
// 메인 실행 함수
async function main() {
  // 1. 이벤트 정보 조회
  const eventData = await fetchEventData(eventUniqueCode);

  // 2. SubEvent 목록 추출 및 필터링
  const subEvents = filterSubEvents(eventData.subEvents);

  // 3. 각 SubEvent별 데이터 처리 (병렬)
  const results = await processAllSubEvents(subEvents);

  // 4. 인덱스 파일 생성
  await generateIndexFile(eventData, results);

  // 5. 개별 SubEvent 파일 생성
  await generateSubEventFiles(results);
}
```

### 2. 파일명 생성 규칙

```javascript
function generateFileName(subEvent) {
  // SubEvent 이름에서 파일명 생성
  // 예: "Half Marathon" → "half-marathon.json"
  const sanitizedName = subEvent.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${sanitizedName}.json`;
}
```

### 3. 인덱스 파일 구조

```json
{
  "event": {
    "id": "dutbkx7e2epftx4x",
    "name": "Xfinity Newburyport Half Marathon, Relay, & 5k",
    "date": "2025-10-26T13:00:00.000Z",
    "location": "Newburyport, MA"
  },
  "subEvents": [
    {
      "id": 245903,
      "name": "Half Marathon",
      "fileName": "half-marathon.json",
      "participantCount": 1431
    }
  ],
  "lastUpdated": "2025-10-27T10:00:00.000Z"
}
```

## Migration Strategy

### Phase 1: 기존 호환성 유지
- 기존 스크립트 백업
- 새로운 기능 추가
- 하드코딩된 설정 제거

### Phase 2: 새로운 기능 구현
- 동적 SubEvent 처리
- 병렬 데이터 조회
- 개별 파일 생성

### Phase 3: 최적화 및 확장
- 성능 튜닝
- 에러 핸들링 강화
- 설정 파일 외부화

## Testing Strategy

### 1. 단위 테스트
- 각 함수별 동작 검증
- API 응답 데이터 파싱 테스트
- 파일 생성 로직 테스트

### 2. 통합 테스트
- 전체 프로세스 흐름 테스트
- 대규모 데이터 처리 테스트
- 에러 시나리오 테스트

### 3. 성능 테스트
- 병렬 처리 효율성 측정
- 메모리 사용량 모니터링
- API Rate Limiting 테스트

## Configuration Examples

### 기본 사용법
```bash
node src/mock/fetch-raceroster-data.js
```

### 특정 SubEvent만 처리
```bash
node src/mock/fetch-raceroster-data.js --sub-events 245903,245905
```

### 설정 파일 사용
```bash
node src/mock/fetch-raceroster-data.js --config config/raceroster-config.json
```

## Success Metrics

1. **처리 속도**: 전체 SubEvent 데이터 처리 시간 30% 단축
2. **안정성**: API 실패 시 95% 이상의 복구율
3. **확장성**: 새로운 이벤트 추가 시 설정 변경만으로 동작
4. **재사용성**: 다른 프로젝트에서의 적용 용이성

## Rollback Plan

- 기존 스크립트 백업 유지
- 점진적 배포 전략
- 문제 발생 시 즉각적 롤백 절차