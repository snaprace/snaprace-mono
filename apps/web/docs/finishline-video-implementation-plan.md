# 피니시라인 비디오 기능 구현 계획

## 개요
이 문서는 RunnerSpotlight 컴포넌트에 피니시라인 비디오 기능을 추가하기 위한 구현 계획을 설명합니다. 이 기능은 참가자별 시작 시간과 함께 YouTube 경주 피니시라인 비디오를 표시합니다.

## 현재 상태 분석

### 기존 구조
- **이벤트 스키마**: YouTube 비디오 메타데이터가 포함된 `finishline_video_info` 필드가 이미 존재
- **RunnerSpotlight 컴포넌트**: FinishlineVideo 컴포넌트를 위한 플레이스홀더가 이미 존재 (100-106행)
- **의존성**: `react-player`가 package.json에 이미 설치됨
- **타이밍 데이터**: timingQuery를 통해 참가자의 clockTime과 다른 지표들을 사용 가능

### finishline_video_info 스키마 구조
```typescript
finishline_video_info: {
  duration: number;
  firstParticipantGunTime: number;
  firstParticipantLocalTime: number | null;
  firstParticipantTimeType: "gun_time" | "net_time";
  firstParticipantVideoTime: number;
  name: string;
  participantVideoTime: number;
  provider: "youtube";
  providerVideoId: string;
  resultEventId: number;
  rewindSeconds: number;
  segmentId: number | null;
  status: "enabled" | "disabled";
  subEventId: number;
  thumbnail: string;
  url: string;
}
```

## 구현 접근 방식

### 1. 비디오 시작 시간 계산
각 참가자의 비디오 시작 시간은 다음 공식으로 계산됩니다:
```
startTime = firstParticipantVideoTime + (participantGunTime - firstParticipantGunTime)
```

### 2. 컴포넌트 아키텍처
- 별도 파일로 `FinishlineVideo` 컴포넌트 생성
- `RunnerSpotlight` 컴포넌트에 통합
- YouTube 비디오 재생을 위해 `react-player` 사용
- 모바일 및 데스크톱용 반응형 디자인 처리

### 3. UI 디자인 원칙
- 기존 디자인 시스템 패턴 유지
- 다른 RunnerSpotlight 컴포넌트와 일관된 카드 스타일 사용
- 비디오 썸네일 및 컨트롤 포함
- 참가자별 타이밍 정보 표시
- 로딩 상태 및 오류 폴백 처리

## 기술적 구현 세부사항

### 컴포넌트 Props
```typescript
interface FinishlineVideoProps {
  event: Event; // finishline_video_info를 포함한 이벤트
  timingDetail: BibDetailResponse | null; // 참가자 타이밍 데이터
  isAllPhotos: boolean; // 모든 사진 또는 특정 bib 표시 여부
}
```

### 주요 기능
1. **조건부 렌더링**: 이벤트에 finishline_video_info가 있을 때만 표시
2. **시작 시간 계산**: 참가자 데이터를 기반으로 동적 계산
3. **폴백 처리**: 비디오를 사용할 수 없을 때 썸네일이나 플레이스홀더 표시
4. **반응형 디자인**: 모바일 우선 접근 방식 및 브레이크포인트
5. **로딩 상태**: 비디오 로딩 중 스켈레톤 표시
6. **오류 처리**: 비디오 로드 오류 시 우아한 폴백

### 파일 구조
```
src/app/events/[event]/[bib]/_components/
├── RunnerSpotlight.tsx (기존)
└── FinishlineVideo.tsx (신규)
```

## 통합 지점

### 1. RunnerSpotlight 통합
- TimingSummaryCard와 EventLeaderboard 사이에 FinishlineVideo 컴포넌트 추가
- 필요한 props 전달 (event, timingDetail, isAllPhotos)
- 기존 반응형 그리드 레이아웃 유지

### 2. 데이터 흐름
- 이벤트 데이터는 `events.getById` 쿼리에서 가져옴
- 타이밍 데이터는 `results.getTimingByBib` 쿼리에서 가져옴
- 비디오 URL은 `finishline_video_info.url`에서 구성
- 시작 시간은 타이밍 데이터와 비디오 메타데이터를 사용하여 계산

## 성능 고려사항

### 1. 비디오 로딩
- 표시될 때 비디오 컴포넌트 지연 로드
- 초기 표시를 위해 YouTube 썸네일 사용
- 적절한 오류 경계 구현

### 2. 반응형 동작
- 다양한 화면 크기에 맞게 비디오 차원 최적화
- 모바일 사용자의 대역폭 영향 고려
- 전체화면으로 비디오 재생 옵션 제공

## 성공 기준
1. ✅ finishline_video_info가 있는 이벤트에서 비디오가 올바르게 표시됨
2. ✅ 다른 참가자들의 시작 시간 계산이 정확하게 작동함
3. ✅ 타이밍 데이터가 누락되었을 때 우아한 폴백이 작동함
4. ✅ 모바일과 데스크톱에서 반응형 디자인이 작동함
5. ✅ 통합이 기존 UI 패턴을 유지함
6. ✅ 비디오 로드 실패에 대한 오류 처리가 작동함

## 테스트 전략
1. finishline_video_info가 있는 이벤트로 테스트
2. 비디오 데이터가 없는 이벤트로 테스트
3. 다양한 참가자 타이밍 시나리오로 테스트
4. 다양한 화면 크기에서 반응형 동작 테스트
5. 유효하지 않은 비디오 URL에 대한 오류 처리 테스트
6. 페이지 로드에 대한 성능 영향 테스트

## 다음 단계
1. tasks 디렉토리에 상세 TODO 목록 생성
2. FinishlineVideo 컴포넌트 구현
3. 컴포넌트를 RunnerSpotlight에 통합
4. 테스트 및 구현 개선
5. 필요한 오류 처리 또는 최적화 추가