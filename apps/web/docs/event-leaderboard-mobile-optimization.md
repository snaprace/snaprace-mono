# EventLeaderboard Mobile Optimization Plan

## 현재 문제 상황

모바일 화면에서 EventLeaderboard 컴포넌트의 테이블이 가로 스크롤이 생기는 문제가 발생하고 있습니다. 스크린샷을 분석한 결과, 현재 테이블 컬럼들이 모바일 화면 너비에 맞게 최적화되지 않았습니다.

## 현재 구조 분석

### 컴포넌트 구조
```
EventLeaderboard
├── EventLeaderboard.tsx (메인 컴포넌트)
├── LeaderboardTableAdvanced.tsx (테이블 구현)
├── columns.tsx (컬럼 정의)
└── 기타 서브컴포넌트들
```

### 현재 컬럼 구성 (columns.tsx)
1. **Rank** (80px) - 순위, 메달 아이콘
2. **Bib** (70px) - 참가번호
3. **Name** (150px) - 이름
4. **Time** (90px) - 기록
5. **Pace** (80px) - 페이스
6. **Division** (120px) - 구분
7. **Div.** (70px) - 구분 내 순위
8. **Perf.** (100px) - 성능 등급

**최소 너비:** 760px (모바일에서는 375px 기준)

## 모바일 최적화 전략

### 1. 반응형 컬럼 너비 최적화
- 모바일에서는 고정된 px 대신 비율 기반 너비 사용
- 중요도에 따른 컬럼 우선순위 설정
- 불필요한 컬럼은 모바일에서 숨기거나 축소

### 2. 컬럼 표시 우선순위
**모바일 필수 컬럼:**
- Rank (축소)
- Bib (유지)
- Name (축소)
- Time (유지)

**모바일 선택적 컬럼:**
- Pace (축소 또는 숨김)
- Division (숨김)
- Division Place (숨김)
- Performance (숨김)

### 3. 텍스트 및 아이콘 최적화
- 폰트 사이즈 축소 (text-[10px] → text-[9px])
- 아이콘 사이즈 축소
- 패딩/마진 최소화
- 약어 사용 (Division → Div.)

### 4. 레이아웃 기법
- 테이블 셀 내부 여백 최소화
- 텍스트 말줄임표 처리
- 컬럼 너비 자동 조절 (flexible sizing)

## 구현 계획 (간소화 버전)

### 현재 상태 분석
✅ **이미 구현된 개선사항**:
- 가로 스크롤 문제 해결됨
- 모든 컬럼이 모바일 화면에 맞게 표시됨
- 핵심 정보 유지 및 가독성 확보

### 추가 최적화 제안 (미세 조정)
1. **가독성 미세 개선**
   - 일부 컬럼 폰트 사이즈 최적화 (text-[9px] → text-[8px] 일부 적용)
   - 셀 간격 미세 조정 (p-1.5 → p-1.2)
   - 긴 텍스트 말줄임표 처리 강화

2. **터치 상호작용 개선**
   - 행 높이 최적화 (현재 h-12 유지 또는 h-11로 미세 조정)
   - 클릭 가능 영역 확보 (최소 44px 터치 타겟)
   - 버튼/필터 영역 최적화

3. **시각적 계층 개선**
   - 중요 컬럼(순위, 이름, 시간) 강조
   - 부차적 컬럼(Performance, Division) 시각적 가중치 조절
   - 색상 대비도 미세 조정

## 기술적 구현 상세 (미세 조정 중심)

### 1. CSS 미세 조정
```css
/* 모바일 텍스트 최적화 */
.mobile-text-xs { font-size: 0.625rem; line-height: 0.75rem; } /* 10px → 10px */
.mobile-text-2xs { font-size: 0.5rem; line-height: 0.625rem; } /* 8px (일부 컬럼) */

/* 셀 패딩 최적화 */
.mobile-cell-tight { padding: 0.1875rem 0.25rem; } /* p-1.5 → p-1.2 */
```

### 2. 중요 컬럼 강조
```typescript
// 시각적 가중치 조절
const getColumnStyles = (columnId: string) => {
  const importantColumns = ['rank', 'name', 'chipTime'];
  if (importantColumns.includes(columnId)) {
    return 'font-semibold text-primary';
  }
  return 'font-normal text-muted-foreground';
};
```

### 3. 터치 영역 최적화
- 행 높이: `h-12` 유지 (충분한 터치 영역)
- 필터 버튼: 최소 44px 높이 보장
- 페이지네이션: 모바일에서 더 큰 버튼

## 예상 결과

### 모바일 화면 (375px 기준)
- **가로 스크롤 없음**
- **핵심 정보 유지**: 순위, 번호, 이름, 기록
- **가독성 확보**: 최소 9px 폰트 사이즈
- **터치 친화적**: 최소 44px 터치 영역

### 데스크톱 화면 유지
- 기존 레이아웃과 기능 유지
- 추가 최적화로 가독성 향상
- 반응형 전환 자연스러움

## 테스트 계획

### 1. 브라우저 테스트
- iOS Safari (iPhone 12, 13, 14)
- Android Chrome (Samsung, Pixel)
- 데스크톱 반응형 테스트

### 2. 성능 테스트
- 렌더링 성능 측정
- 메모리 사용량 모니터링
- 스크롤 성능 테스트

### 3. 사용성 테스트
- 터치 상호작용 테스트
- 정보 가독성 검증
- 네비게이션 용이성 확인

## 롤백 계획

문제 발생 시를 위한 롤백 전략:
1. 기존 컬럼 설정으로 즉시 복구
2. 반응형 클래스 분리로 부분 적용
3. 기능 플래그로 점진적 롤아웃