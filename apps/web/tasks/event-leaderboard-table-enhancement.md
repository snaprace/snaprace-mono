# Event Leaderboard 테이블 고급 기능 구현 태스크

## 🎯 목표

기본 테이블을 TanStack Table 기반 고급 대화형 테이블로 업그레이드

## 📋 요구사항

### 필수 기능
1. ✅ Accordion (열고 닫기) - 카테고리 탭 내부에 포함
2. ✅ 페이지네이션 (25/50/100 rows)
3. ✅ 검색 (이름/Bib, debounced 300ms)
4. ✅ 필터 (Division, Gender) - Age 범위 필터 제거됨
5. ✅ 정렬 (모든 컬럼, 3-state Chevron 아이콘)
6. ✅ Division 1등 하이라이트 + Tooltip
7. ✅ 내 정보 헤더 아래 고정 (참가 카테고리에서만)
8. ✅ 모바일 반응형 (테이블 유지, 2-column 필터 그리드)
9. ✅ 조건부 Performance 컬럼 (데이터 있을 때만 표시)
10. ✅ 카테고리 탭 (다중 카테고리 시 표시, 단일 시 숨김)

## 🛠️ 기술 스택

- **TanStack Table v8**: 테이블 로직
- **Shadcn/ui**: UI 컴포넌트
  - Accordion
  - Input (검색)
  - Select (필터)
  - Button (페이지네이션)
- **React Hooks**: 상태 관리
- **TypeScript**: 타입 안전성

## 📁 파일 구조

```
src/app/events/[event]/[bib]/_components/
  EventLeaderboard.tsx                     # 메인 컨테이너 (수정)

  leaderboard-table/                       # 새 폴더
    ├── LeaderboardTableAdvanced.tsx      # TanStack Table 메인
    ├── LeaderboardFilters.tsx            # 검색/필터 UI
    ├── LeaderboardPagination.tsx         # 페이지네이션 UI
    ├── StickyUserRow.tsx                 # 고정된 내 정보 행
    ├── columns.tsx                       # 컬럼 정의
    ├── types.ts                          # 타입 정의
    └── utils.ts                          # 헬퍼 함수

  EventLeaderboardSkeleton.tsx            # 로딩 상태 (기존)
```

## 📝 구현 단계

### Phase 1: 준비 및 설정

#### Step 1.1: 패키지 설치
```bash
npm install @tanstack/react-table
npm install use-debounce
```

#### Step 1.2: Shadcn/ui 컴포넌트 추가
```bash
npx shadcn-ui@latest add accordion
npx shadcn-ui@latest add select
```

---

### Phase 2: 타입 및 유틸리티

#### Step 2.1: `types.ts` 생성

```typescript
import type { LeaderboardResult } from "@/server/services/timing-service";

export type FilterState = {
  division: string;
  gender: 'all' | 'M' | 'F';
  // Age 범위 필터는 제거됨
};

export type EnhancedLeaderboardResult = LeaderboardResult & {
  isDivisionWinner?: boolean;
  isOverallWinner?: boolean;
  isUserRow?: boolean;
};

// SortingState는 TanStack Table의 내장 타입 사용
```

#### Step 2.2: `utils.ts` 생성

```typescript
import type { LeaderboardResult, EnhancedLeaderboardResult } from './types';

/**
 * Division별 1등 찾기
 */
export function markDivisionWinners(
  results: LeaderboardResult[]
): EnhancedLeaderboardResult[] {
  const divisionFirsts = new Map<string, number>();

  return results.map((result, index) => {
    const isDivisionWinner = !divisionFirsts.has(result.division || '');

    if (isDivisionWinner && result.division) {
      divisionFirsts.set(result.division, index);
    }

    return {
      ...result,
      isDivisionWinner,
      isOverallWinner: result.rank <= 3,
    };
  });
}

/**
 * 검색 필터링
 */
export function filterBySearch(
  results: LeaderboardResult[],
  query: string
): LeaderboardResult[] {
  if (!query.trim()) return results;

  const lowerQuery = query.toLowerCase();

  return results.filter(
    (r) =>
      r.name?.toLowerCase().includes(lowerQuery) ||
      r.bib.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Division/Gender 필터링
 */
export function applyFilters(
  results: LeaderboardResult[],
  filters: FilterState
): LeaderboardResult[] {
  let filtered = results;

  // Division 필터
  if (filters.division !== 'all') {
    filtered = filtered.filter((r) => r.division === filters.division);
  }

  // Gender 필터
  if (filters.gender !== 'all') {
    filtered = filtered.filter((r) => r.gender === filters.gender);
  }

  // Age 필터는 제거됨
  return filtered;
}

/**
 * 고유 Division 목록 추출
 */
export function getUniqueDivisions(
  results: LeaderboardResult[]
): string[] {
  const divisions = new Set(
    results.map((r) => r.division).filter(Boolean)
  );
  return Array.from(divisions).sort();
}
```

---

### Phase 3: 컬럼 정의

#### Step 3.1: `columns.tsx` 생성

```typescript
import { createColumnHelper } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { PerformanceTierBadge } from '@/components/performance/PerformanceTierBadge';
import type { EnhancedLeaderboardResult } from './types';
import { Medal, Award } from 'lucide-react';

const columnHelper = createColumnHelper<EnhancedLeaderboardResult>();

export const columns = [
  // Rank
  columnHelper.accessor('rank', {
    header: 'Rank',
    cell: (info) => {
      const rank = info.getValue();
      const row = info.row.original;

      return (
        <div className="flex items-center gap-2">
          {rank === 1 && <Medal className="h-5 w-5 text-yellow-500" />}
          {rank === 2 && <Medal className="h-5 w-5 text-gray-400" />}
          {rank === 3 && <Medal className="h-5 w-5 text-orange-600" />}
          {row.isDivisionWinner && rank > 3 && (
            <Award className="h-4 w-4 text-blue-500" />
          )}
          <span className="font-semibold">{rank}</span>
        </div>
      );
    },
    size: 100,
  }),

  // Bib
  columnHelper.accessor('bib', {
    header: 'Bib',
    cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
    size: 80,
  }),

  // Name
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) => (
      <span className="font-medium">{info.getValue() || '—'}</span>
    ),
    size: 200,
  }),

  // Chip Time
  columnHelper.accessor('chipTime', {
    header: 'Chip Time',
    cell: (info) => (
      <span className="font-mono font-semibold">
        {info.getValue() || '—'}
      </span>
    ),
    size: 120,
  }),

  // Pace
  columnHelper.accessor('avgPace', {
    header: 'Pace',
    cell: (info) => (
      <span className="font-mono text-sm">{info.getValue() || '—'}</span>
    ),
    size: 100,
  }),

  // Division
  columnHelper.accessor('division', {
    header: 'Division',
    cell: (info) => {
      const row = info.row.original;
      return (
        <div className="flex items-center gap-2">
          {row.gender && (
            <Badge variant="secondary" className="text-xs">
              {row.gender}
            </Badge>
          )}
          {row.age && (
            <span className="text-muted-foreground text-sm">{row.age}</span>
          )}
        </div>
      );
    },
    size: 120,
  }),

  // Division Place
  columnHelper.accessor('divisionPlace', {
    header: 'Div. Place',
    cell: (info) => info.getValue() || '—',
    size: 100,
  }),

  // Performance
  columnHelper.accessor('agePerformance', {
    header: 'Performance',
    cell: (info) => {
      const value = info.getValue();
      return value && value > 0 ? (
        <PerformanceTierBadge value={value} className="text-xs" />
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
    size: 150,
  }),
];
```

---

### Phase 4: 필터 및 검색 UI

#### Step 4.1: `LeaderboardFilters.tsx` 생성

```typescript
'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import type { FilterState } from './types';

interface LeaderboardFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  divisions: string[];
}

export function LeaderboardFilters({
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  divisions,
}: LeaderboardFiltersProps) {
  return (
    <div className="space-y-4">
      {/* 검색 - 전체 너비 */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          type="text"
          placeholder="Search by name or bib number..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-secondary border bg-white pl-10"
        />
      </div>

      {/* 필터 - 2열 그리드 (반응형) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Division 필터 */}
        <Select
          value={filters.division}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, division: value })
          }
        >
          <SelectTrigger className="border-secondary border bg-white">
            <SelectValue placeholder="All Divisions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Divisions</SelectItem>
            {divisions.map((div) => (
              <SelectItem key={div} value={div}>
                {div}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Gender 필터 */}
        <Select
          value={filters.gender}
          onValueChange={(value) =>
            onFiltersChange({ ...filters, gender: value as 'all' | 'M' | 'F' })
          }
        >
          <SelectTrigger className="border-secondary border bg-white">
            <SelectValue placeholder="All Genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="M">Male</SelectItem>
            <SelectItem value="F">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
// Note: Age 범위 필터는 제거됨. 인풋 배경은 white로 변경됨.
```

---

### Phase 5: 페이지네이션 UI

#### Step 5.1: `LeaderboardPagination.tsx` 생성

```typescript
'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface LeaderboardPaginationProps {
  currentPage: number;
  pageSize: number;
  totalResults: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function LeaderboardPagination({
  currentPage,
  pageSize,
  totalResults,
  onPageChange,
  onPageSizeChange,
}: LeaderboardPaginationProps) {
  const totalPages = Math.ceil(totalResults / pageSize);
  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  return (
    <div className="flex items-center justify-between">
      {/* Rows per page */}
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Rows per page:</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(parseInt(value))}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="text-muted-foreground text-sm">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Results info */}
      <span className="text-muted-foreground text-sm">
        Showing {startResult}-{endResult} of {totalResults}
      </span>
    </div>
  );
}
```

---

### Phase 6: Sticky User Row

#### Step 6.1: `StickyUserRow.tsx` 생성

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { PerformanceTierBadge } from '@/components/performance/PerformanceTierBadge';
import type { EnhancedLeaderboardResult } from './types';

interface StickyUserRowProps {
  userResult: EnhancedLeaderboardResult | null;
}

export function StickyUserRow({ userResult }: StickyUserRowProps) {
  if (!userResult) return null;

  return (
    <div className="border-primary/40 bg-primary/10 sticky top-0 z-10 border-b-2 border-l-4">
      <table className="w-full">
        <tbody>
          <tr className="hover:bg-primary/20">
            {/* Rank */}
            <td className="p-3 font-semibold">{userResult.rank}</td>

            {/* Bib */}
            <td className="p-3">
              <Badge variant="outline" className="bg-primary/20">
                {userResult.bib}
              </Badge>
            </td>

            {/* Name */}
            <td className="p-3 font-bold">
              {userResult.name} <span className="text-primary">(YOU)</span>
            </td>

            {/* Chip Time */}
            <td className="p-3 font-mono font-semibold">
              {userResult.chipTime}
            </td>

            {/* Pace */}
            <td className="p-3 font-mono text-sm">{userResult.avgPace}</td>

            {/* Division */}
            <td className="p-3">
              <div className="flex items-center gap-2">
                {userResult.gender && (
                  <Badge variant="secondary">{userResult.gender}</Badge>
                )}
                {userResult.age && <span>{userResult.age}</span>}
              </div>
            </td>

            {/* Division Place */}
            <td className="p-3">{userResult.divisionPlace}</td>

            {/* Performance */}
            <td className="p-3">
              {userResult.agePerformance && userResult.agePerformance > 0 && (
                <PerformanceTierBadge value={userResult.agePerformance} />
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

---

### Phase 7: TanStack Table 메인 컴포넌트

#### Step 7.1: `LeaderboardTableAdvanced.tsx` 생성

**이 파일이 가장 복잡하므로 다음 메시지에서 상세히 설명**

---

### Phase 8: EventLeaderboard 통합

#### Step 8.1: `EventLeaderboard.tsx` 수정

**Accordion 추가 및 새 테이블 통합**

---

## 📊 구현 순서

1. ✅ **준비**: 패키지 설치, Shadcn 컴포넌트 추가
2. ✅ **타입**: types.ts, utils.ts
3. ✅ **컬럼**: columns.tsx (3-state Chevron 정렬 포함)
4. ✅ **UI**: Filters, Pagination, StickyUserRow
5. ✅ **메인**: LeaderboardTableAdvanced.tsx
6. ✅ **통합**: EventLeaderboard.tsx 수정 (카테고리 탭 + Accordion)
7. ✅ **테스트**: 기능 검증
8. ✅ **최적화**: 성능 개선 (Memoization, Debounce)

---

## ✅ 완료 체크리스트

### 기능
- [x] Accordion 열고 닫기 (카테고리 탭 내부 포함)
- [x] 검색 (실시간, debounced 300ms)
- [x] Division 필터
- [x] Gender 필터
- [x] ~~Age 범위 필터~~ (제거됨)
- [x] 컬럼 정렬 (3-state Chevron 아이콘)
- [x] 페이지네이션 (25/50/100)
- [x] Division 1등 하이라이트 (Tooltip 포함)
- [x] 내 정보 고정 (sticky, 참가 카테고리만)
- [x] 카테고리 탭 (다중/단일 자동 처리)
- [x] 조건부 Performance 컬럼

### UI/UX
- [x] 반응형 (모바일 최적화, 2-column 필터)
- [x] 로딩 상태 (Skeleton)
- [x] 빈 상태 ("No results found")
- [x] 에러 처리 (Silent fail)
- [x] Tooltip (하이라이트 행 설명)
- [x] 행 스타일링 (좌측 border만)
- [x] 컬럼 정렬 (Chip Time, Pace, Div. Place 중앙 정렬)

### 성능
- [x] Memoization (useMemo)
- [x] Debounced 검색 (300ms)
- [x] 최소 렌더링 (조건부 컬럼)
- [x] 클라이언트 사이드 필터링

### 추가 개선사항
- [x] 카테고리 탭 + results count (justify-between)
- [x] 입력 필드 white 배경
- [x] Sticky row는 사용자 참가 카테고리에서만 표시
- [x] Tooltip 텍스트 white 색상
- [x] Row height 고정 (h-16)

---

**작성일**: 2025-10-23
**완료일**: 2025-10-23
**실제 소요 시간**: 6-8시간
**상태**: ✅ 완료
