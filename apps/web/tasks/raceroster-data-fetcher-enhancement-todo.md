# RaceRoster Data Fetcher Enhancement TODO

## Phase 1: 기반 구조 개선 (Foundation)

### 1.1 현재 스크립트 분석 및 백업
- [ ] `fetch-raceroster-data.js` 백업 파일 생성 (`fetch-raceroster-data.js.backup`)
- [ ] 현재 스크립트 구조 및 의존성 분석
- [ ] 하드코딩된 설정 값 식별

### 1.2 새로운 설정 구조 설계
- [ ] 환경 변수 기반 설정 구조 설계
- [ ] 커맨드 라인 인자 파서 구현 (`yargs` 또는 `commander`)
- [ ] 설정 파일 형식 정의 (JSON/YAML)

### 1.3 모듈화 아키텍처 설계
- [ ] `api/` 모듈: API 호출 관련 함수들
- [ ] `data/` 모듈: 데이터 변환 및 처리
- [ ] `utils/` 모듈: 유틸리티 함수들
- [ ] `config/` 모듈: 설정 관리

## Phase 2: API 기능 구현 (API Implementation)

### 2.1 이벤트 정보 조회 API
- [ ] `fetchEventData(eventUniqueCode)` 함수 구현
  - GET `/v2/api/events/{eventUniqueCode}` 호출
  - SubEvent 목록 추출
  - 에러 핸들링 및 재시도 로직

### 2.2 SubEvent 필터링 기능
- [ ] `filterSubEvents(subEvents, config)` 함수 구현
  - `--sub-events` 인자 처리
  - 'all' vs 특정 SubEvent ID 처리
  - 유효성 검사

### 2.3 SubEvent별 리더보드 조회
- [ ] `fetchSubEventLeaderboard(eventId, subEventId)` 함수 구현
  - GET `/v2/api/result-events/{eventId}/sub-events/{subEventId}/results` 호출
  - 페이지네이션 처리
  - 결과 수집 및 데이터 정리

### 2.4 참가자 상세 정보 조회 (개선)
- [ ] 기존 `fetchParticipantDetail` 함수 리팩토링
- [ ] `fetchParticipantDetailsBatch()` 함수 구현 (배치 처리)
- [ ] 병렬 처리 최적화
- [ ] Rate limiting 구현

## Phase 3: 데이터 처리 및 파일 생성 (Data Processing)

### 3.1 데이터 변환 로직 개선
- [ ] `convertToMockFormat()` 함수 리팩토링
  - SubEvent별 데이터 구조 처리
  - 동적 headings 생성
  - division 정보 동적 생성

### 3.2 파일명 생성 규칙 구현
- [ ] `generateFileName(subEvent)` 함수 구현
  - SubEvent 이름 기반 파일명 생성
  - 특수문자 처리 및 소문자 변환
  - 중복 파일명 처리

### 3.3 인덱스 파일 생성
- [ ] `generateIndexFile(eventData, results)` 함수 구현
  - 전체 이벤트 정보 요약
  - SubEvent 목록 및 파일 정보
  - 생성 시간 및 메타데이터

### 3.4 개별 SubEvent 파일 생성
- [ ] `generateSubEventFiles(results)` 함수 구현
  - 각 SubEvent별 별도 JSON 파일 생성
  - 파일 구조 표준화
  - 디렉토리 구조 관리

## Phase 4: 병렬 처리 및 성능 최적화 (Performance)

### 4.1 병렬 처리 구현
- [ ] SubEvent별 병렬 데이터 처리 구현
  - `Promise.allSettled()` 사용하여 부분 실패 처리
  - 동시성 제어 (Concurrency limiting)
  - 메모리 사용량 최적화

### 4.2 Rate Limiting 최적화
- [ ] API 호출 간격 조정
- [ ] 지수 백오프 재시도 전략
- [ ] API 한계에 따른 동적 조절

### 4.3 대용량 데이터 처리
- [ ] 스트리밍 데이터 처리 고려
- [ ] 청크 기반 데이터 처리
- [ ] 진행 상황 표시 (Progress bar)

## Phase 5: 에러 핸들링 및 로깅 (Error Handling)

### 5.1 에러 핸들링 강화
- [ ] API 호출 실패 시 재시도 로직
- [ ] 부분 성공 시 계속 진행 전략
- [ ] 에러 타입별 분류 및 처리

### 5.2 로깅 시스템 구현
- [ ] 상세한 로깅 메시지 구현
- [ ] 로그 레벨별 출력 (info, warn, error)
- [ ] 진행 상황 실시간 표시

### 5.3 상태 저장 및 복구
- [ ] 중단점 저장 기능
- [ ] 이어서 처리 기능
- [ ] 캐시 메커니즘 구현

## Phase 6: 사용자 인터페이스 개선 (UX)

### 6.1 커맨드 라인 인터페이스
- [ ] `--help` 옵션 구현
- [ ] 상세한 사용법 안내
- [ ] 예제 명령어 제공

### 6.2 설정 파일 지원
- [ ] 외부 설정 파일 로드 기능
- [ ] 설정 파일 템플릿 제공
- [ ] 설정 값 검증

### 6.3 진행 상황 표시
- [ ] Progress bar 구현
- [ ] 현재 처리 중인 SubEvent 표시
- [ ] 예상 완료 시간 표시

## Phase 7: 테스트 및 검증 (Testing)

### 7.1 단위 테스트
- [ ] 각 함수별 단위 테스트 작성
- [ ] Mock API 응답 테스트
- [ ] 에러 시나리오 테스트

### 7.2 통합 테스트
- [ ] 전체 프로세스 흐름 테스트
- [ ] 실제 API 호출 테스트
- [ ] 파일 생성 결과 검증

### 7.3 성능 테스트
- [ ] 처리 시간 측정
- [ ] 메모리 사용량 모니터링
- [ ] 동시성 테스트

## Phase 8: 문서화 및 배포 (Documentation)

### 8.1 기술 문서 작성
- [ ] API 스펙 문서화
- [ ] 코드 주석 추가
- [ ] 아키텍처 다이어그램

### 8.2 사용자 문서 작성
- [ ] 사용 가이드 작성
- [ ] 설정 예제 제공
- [ ] FAQ 작성

### 8.3 배포 및 롤백 계획
- [ ] 점진적 배포 전략
- [ ] 롤백 절차 문서화
- [ ] 모니터링 계획

## 구현 순서 권장

1. **Phase 1-2**: 기반 구조와 API 기능 (핵심 기능)
2. **Phase 3**: 데이터 처리 및 파일 생성 (주요 기능)
3. **Phase 4-5**: 성능과 안정성 (품질 향상)
4. **Phase 6-8**: 사용자 경험과 완성도 (마무리)

## 예상 소요 시간

- **Phase 1-2**: 2-3일
- **Phase 3**: 3-4일
- **Phase 4-5**: 2-3일
- **Phase 6-8**: 1-2일
- **총계**: 8-12일

## 중요 고려사항

1. **기존 호환성**: 기존 `5k.json` 출력 형식 유지
2. **점진적 개선**: 각 Phase별로 동작하는 버전 유지
3. **테스트 데이터**: 실제 API 데이터로 충분한 테스트
4. **에러 처리**: 실제 운영 환경에서의 에러 대비
5. **성능**: 대규모 이벤트 데이터 처리 능력