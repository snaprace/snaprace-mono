# EventLeaderboard Mobile Optimization - Task Breakdown (간소화 버전)

## 개요
EventLeaderboard 컴포넌트는 이미 모바일에서 가로 스크롤 없이 잘 표시되고 있습니다. 남은 작업은 미세한 텍스트 최적화와 시각적 개선입니다.

## 현재 상태 ✅
- 가로 스크롤 문제 해결됨
- 모든 컬럼이 375px 모바일 화면에 맞게 표시됨
- 핵심 정보 유지 및 기본 가독성 확보

## 추가 최적화 작업 (미세 조정)

### Task 1: 텍스트 및 가독성 미세 개선

#### 1.1: 컬럼별 폰트 사이즈 최적화
- [ ] **Performance 컬럼**: `text-[10px]` → `text-[8px]` (가독성 유지하며 축소)
  - `src/app/events/[event]/[bib]/_components/leaderboard-table/columns.tsx:288`

- [ ] **Division 컬럼**: `text-xs` → `text-[9px]` (미세 축소)
  - `src/app/events/[event]/[bib]/_components/leaderboard-table/columns.tsx:218`

- [ ] **Bib 컬럼**: `text-[10px]` → `text-[9px]` (미세 축소)
  - `src/app/events/[event]/[bib]/_components/leaderboard-table/columns.tsx:109`

#### 1.2: 셀 패딩 최적화
- [ ] **전체 셀 패딩**: `p-1.5` → `p-1.2` (공간 절약)
  - `src/app/events/[event]/[bib]/_components/leaderboard-table/LeaderboardTableAdvanced.tsx:194`

- [ ] **헤더 패딩**: `p-1.5` → `p-1` (헤더 공간 최적화)
  - `src/app/events/[event]/[bib]/_components/leaderboard-table/LeaderboardTableAdvanced.tsx:165`

### Task 2: 시각적 계층 개선

#### 2.1: 중요 컬럼 강조
- [ ] **Rank 컬럼**: 폰트 굵기 강조 (`font-semibold` 유지 및 색상 개선)
- [ ] **Name 컬럼**: `font-medium` → `font-semibold` (중요도 증가)
- [ ] **Time 컬럼**: `font-semibold` 유지 및 시각적 중요도 강화

#### 2.2: 부차적 컬럼 시각적 조절
- [ ] **Performance & Division**: `text-muted-foreground` 적용으로 중요도 조절
- [ ] **아이콘 사이즈 미세 조정**: 메달 아이콘 `h-3.5` → `h-3` (모바일 전용)

### Task 3: 최종 검증 및 테스트

#### 3.1: 다양한 기기 테스트
- [ ] **iPhone 테스트**: 375px, 414px 너비에서 레이아웃 확인
- [ ] **Android 테스트**: 다양한 안드로이드 기기 화면 크기 확인
- [ ] **최소 너비 테스트**: 320px에서도 깨짐 없는지 확인

#### 3.2: 기능 테스트
- [ ] **정렬 기능**: 모바일에서 정렬 버튼 클릭 가능 여부
- [ ] **필터 기능**: 검색 및 필터 인터랙션 원활성
- [ ] **페이지네이션**: 모바일 페이지네이션 버튼 접근성

#### 3.3: 성능 확인
- [ ] **렌더링 성능**: 모바일에서 스크롤 성능 저하 없는지
- [ ] **메모리 사용**: 과도한 메모리 사용 없는지 간단 확인

## 간소화된 파일 수정 목록

### 주요 수정 파일:
1. **`src/app/events/[event]/[bib]/_components/leaderboard-table/columns.tsx`**
   - 특정 컬럼 폰트 사이즈 미세 조정
   - 아이콘 사이즈 최적화 (선택적)

2. **`src/app/events/[event]/[bib]/_components/leaderboard-table/LeaderboardTableAdvanced.tsx`**
   - 셀 패딩 미세 조정
   - 헤더 패딩 최적화

### 수정 범위:
- **폰트 사이즈**: 2-3개 컬럼만 1-2px 축소
- **패딩**: 1.5 → 1.2 로 미세 조정
- **아이콘**: 3.5px → 3px (모바일 전용, 선택적)

## 배포 계획 (간소화)

### 단일 배포 단계:
- **모든 미세 조정 변경사항 한 번에 배포**
- **위험도**: 매우 낮음 (미세한 텍스트/패딩 조정만)

### 배포 후 확인:
- [ ] 다양한 모바일 기기에서 정상 표시 확인
- [ ] 기존 기능들 정상 작동 확인
- [ ] 성능 저하 없는지 확인

## 성공 지표 (이미 달성됨)

### 기술적 지표:
- [x] 375px 너비에서 가로 스크롤 없음 ✅ **이미 달성됨**
- [x] 모든 컬럼 정보 표시 가능 ✅ **이미 달성됨**
- [ ] 미세한 가독성 개선 (추가 목표)
- [ ] 기존 데스크톱 기능 유지 ✅ **이미 달성됨**

### 사용자 경험 지표:
- [ ] 텍스트 가독성 미세 개선 (1-2px 축소)
- [ ] 시각적 계층 개선 (중요 컬럼 강조)
- [ ] 터치 상호작용 유지 ✅ **이미 달성됨**

## 롤백 계획 (간소화)

문제 발생 시 (가능성 매우 낮음):
1. **즉시 복원**: 변경된 폰트/패딩 값 원복
2. **부분 롤백**: 특정 컬럼 변경사항만 되돌리기

### 롤백 체크리스트:
- [ ] 기존 폰트/패딩 값 기록
- [ ] Git에서 빠른 복원 방법 준비