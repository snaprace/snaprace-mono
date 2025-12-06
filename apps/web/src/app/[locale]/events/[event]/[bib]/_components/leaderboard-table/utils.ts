import type {
  LeaderboardResult,
  EnhancedLeaderboardResult,
  FilterState,
} from "./types";

/**
 * Division별 1등 찾기 및 마킹
 */
export function markDivisionWinners(
  results: LeaderboardResult[],
): EnhancedLeaderboardResult[] {
  const divisionFirsts = new Map<string, boolean>();

  return results.map((result) => {
    const division = result.division || "Unknown";
    const isDivisionWinner = !divisionFirsts.has(division);

    if (isDivisionWinner) {
      divisionFirsts.set(division, true);
    }

    return {
      ...result,
      isDivisionWinner,
      isOverallWinner: result.rank <= 3,
    };
  });
}

/**
 * 검색 필터링 (이름 또는 Bib)
 */
export function filterBySearch(
  results: LeaderboardResult[],
  query: string,
): LeaderboardResult[] {
  if (!query.trim()) return results;

  const lowerQuery = query.toLowerCase();

  return results.filter(
    (r) =>
      r.name?.toLowerCase().includes(lowerQuery) ||
      r.bib.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Division/Gender 필터 적용
 */
export function applyFilters(
  results: LeaderboardResult[],
  filters: FilterState,
): LeaderboardResult[] {
  let filtered = results;

  // Division 필터
  if (filters.division !== "all") {
    filtered = filtered.filter((r) => r.division === filters.division);
  }

  // Gender 필터
  if (filters.gender !== "all") {
    filtered = filtered.filter((r) => r.gender === filters.gender);
  }

  return filtered;
}

/**
 * 고유 Division 목록 추출 (정렬됨)
 * 불완전한 division 값(5K_F, 5K_M, 10K_F, 10K_M 등)은 제외
 */
export function getUniqueDivisions(results: LeaderboardResult[]): string[] {
  const divisions = new Set<string>(
    results
      .map((r) => r.division)
      .filter((d): d is string => {
        if (!d) return false;
        // 빈 문자열 제외
        if (d.trim() === "") return false;
        // 5K_F, 5K_M, 10K_F, 10K_M 같은 불완전한 패턴 제외
        // 정규식: 숫자K_단일문자 패턴 (예: 5K_F, 10K_M)
        if (/^\d+K_[MF]$/i.test(d)) return false;
        return true;
      }),
  );
  return Array.from(divisions).sort();
}

/**
 * 사용자의 결과 찾기
 */
export function findUserResult(
  results: LeaderboardResult[],
  userBib: string,
): LeaderboardResult | null {
  return results.find((r) => r.bib === userBib) || null;
}

/**
 * Row 스타일 클래스 생성
 */
export function getRowClassName(result: EnhancedLeaderboardResult): string {
  const classes: string[] = ["transition-colors", "hover:bg-muted/50"];

  // Overall 1등 (금색 배경)
  if (result.isOverallWinner && result.rank === 1) {
    classes.push(
      "bg-yellow-50/30",
      " border-l-3 md:border-l-4",
      "border-yellow-400",
      "font-semibold",
    );
  }
  // Division 1등 (파란 보더)
  else if (result.isDivisionWinner && result.rank > 3) {
    classes.push("border-l-3 md:border-l-4", "border-blue-400");
  }
  // 사용자 행
  else if (result.isUserRow) {
    classes.push(
      "bg-primary/10",
      "border-l-3 md:border-l-4",
      "border-primary",
      "font-semibold",
    );
  }

  return classes.join(" ");
}

/**
 * Tooltip 메시지 생성
 */
export function getTooltipMessage(
  result: EnhancedLeaderboardResult,
): string | null {
  if (result.isUserRow) {
    return "Your Result";
  }
  if (result.isOverallWinner && result.rank === 1) {
    return "🏆 Overall Winner - 1st Place";
  }
  if (result.isOverallWinner && result.rank === 2) {
    return "🥈 Overall Winner - 2nd Place";
  }
  if (result.isOverallWinner && result.rank === 3) {
    return "🥉 Overall Winner - 3rd Place";
  }
  if (result.isDivisionWinner && result.rank > 3) {
    return `🏅 Division Winner - 1st in ${result.division || "Division"}`;
  }
  return null;
}
