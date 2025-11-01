import type { LeaderboardResult } from "@/server/services/timing-service";

// Re-export LeaderboardResult for convenience
export type { LeaderboardResult };

/**
 * 필터 상태
 */
export type FilterState = {
  division: string;
  gender: "all" | "M" | "F";
};

/**
 * 정렬 상태
 */
export type SortConfig = {
  columnId: string;
  direction: "asc" | "desc";
} | null;

/**
 * 향상된 Leaderboard 결과
 * (Division 1등, Overall 우승자 등 플래그 포함)
 */
export type EnhancedLeaderboardResult = LeaderboardResult & {
  isDivisionWinner?: boolean;
  isOverallWinner?: boolean;
  isUserRow?: boolean;
};

/**
 * 테이블 상태
 */
export type TableState = {
  searchQuery: string;
  filters: FilterState;
  sorting: SortConfig;
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
};
