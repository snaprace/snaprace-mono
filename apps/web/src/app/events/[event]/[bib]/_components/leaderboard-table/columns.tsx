import type { ColumnDef, Column } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  Medal,
  Award,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EnhancedLeaderboardResult } from "./types";
import { isMobileDevice } from "@/utils/device";
import Link from "next/link";

// 정렬 아이콘 헬퍼 컴포넌트
function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") {
    return <ChevronUp className="ml-1 h-2.5 w-2.5 md:ml-2 md:h-4 md:w-4" />;
  }
  if (isSorted === "desc") {
    return <ChevronDown className="ml-1 h-2.5 w-2.5 md:ml-2 md:h-4 md:w-4" />;
  }
  return (
    <ChevronsUpDown className="ml-1 h-2.5 w-2.5 opacity-50 md:ml-2 md:h-4 md:w-4" />
  );
}

// 정렬 클릭 핸들러 (기본 -> 내림차순 -> 오름차순 -> 기본)
function handleSortClick<TData, TValue>(column: Column<TData, TValue>) {
  const current = column.getIsSorted();
  if (current === false) {
    column.toggleSorting(true); // desc
  } else if (current === "desc") {
    column.toggleSorting(false); // asc
  } else {
    column.clearSorting(); // false
  }
}

export function createColumns(
  eventId: string,
): ColumnDef<EnhancedLeaderboardResult>[] {
  return [
    // Rank
    {
      accessorKey: "rank",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortClick(column)}
            className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
          >
            Rank
            {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
          </Button>
        );
      },
      cell: ({ row }) => {
        const rank = row.original.rank;
        const result = row.original;

        return (
          <div className="flex items-center gap-1 px-1 md:gap-2 md:px-2">
            <span className="text-[10px] font-semibold md:text-sm">{rank}</span>
            {rank === 1 && (
              <Medal
                className="h-3 w-3 text-yellow-500 md:h-5 md:w-5"
                aria-label="1st place"
              />
            )}
            {rank === 2 && (
              <Medal
                className="h-3 w-3 text-gray-400 md:h-5 md:w-5"
                aria-label="2nd place"
              />
            )}
            {rank === 3 && (
              <Medal
                className="h-3 w-3 text-orange-600 md:h-5 md:w-5"
                aria-label="3rd place"
              />
            )}
            {result.isDivisionWinner && rank > 3 && (
              <Award
                className="h-3 w-3 text-blue-500 md:h-4 md:w-4"
                aria-label="Division winner"
              />
            )}
          </div>
        );
      },
      size: 45,
      enableSorting: true,
    },

    // Bib
    {
      accessorKey: "bib",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortClick(column)}
            className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
          >
            Bib
            {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
          </Button>
        );
      },
      cell: ({ row }) =>
        isMobileDevice() ? (
          <span className="flex items-center justify-center text-[9px] font-semibold">
            {row.original.bib || "-"}
          </span>
        ) : (
          <Badge variant="outline" className="text-xs">
            {row.original.bib || "-"}
          </Badge>
        ),
      size: 50,
      enableSorting: true,
    },

    // Name
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortClick(column)}
            className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
          >
            Name
            {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
          </Button>
        );
      },
      cell: ({ row }) => {
        const bib = row.original.bib;
        const name = row.original.name || "-";

        if (!bib || name === "-") {
          return (
            <span className="text-[9px] font-medium md:text-sm">{name}</span>
          );
        }

        return (
          <Link
            href={`/events/${eventId}/${bib}`}
            className="text-[9px] font-semibold text-sky-700 hover:underline md:text-sm"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
        );
      },
      size: 90,
      enableSorting: true,
    },

    // Chip Time
    {
      accessorKey: "chipTime",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => handleSortClick(column)}
              className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
            >
              Time
              {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
            </Button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-mono text-[9px] font-semibold md:text-xs">
            {row.original.chipTime || "-"}
          </span>
        </div>
      ),
      size: 65,
      enableSorting: true,
    },

    // Pace
    {
      accessorKey: "avgPace",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => handleSortClick(column)}
              className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
            >
              Pace
              {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
            </Button>
          </div>
        );
      },
      cell: ({ row }) => (
        <div className="text-center">
          <span className="font-mono text-[9px] md:text-xs">
            {row.original.avgPace || "-"}
          </span>
        </div>
      ),
      size: 55,
      enableSorting: true,
    },

    // Division
    {
      accessorKey: "division",
      header: () => (
        <div className="text-[9px] font-semibold md:text-sm">Division</div>
      ),
      cell: ({ row }) => {
        const division = row.original.division;
        // division 값이 없거나 빈 문자열이면 "—" 표시
        if (!division || division.trim() === "") {
          return (
            <span className="text-muted-foreground text-[9px] md:text-sm">
              -
            </span>
          );
        }
        // 불완전한 division 패턴 (5K_F, 5K_M, 10K_F, 10K_M 등) 체크
        // 정규식: 숫자K_단일문자 패턴
        if (/^\d+K_[MF]$/i.test(division)) {
          return (
            <span className="text-muted-foreground text-[9px] md:text-sm">
              -
            </span>
          );
        }
        return <div className="text-[9px] md:text-sm">{division}</div>;
      },
      size: 70,
      enableSorting: false,
    },

    // Division Place
    {
      accessorKey: "divisionPlace",
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => handleSortClick(column)}
              className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
            >
              Div.
              {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
            </Button>
          </div>
        );
      },
      cell: ({ row }) => {
        const division = row.original.division;
        const divisionPlace = row.original.divisionPlace;

        // division이 없거나 불완전한 패턴이면 Division Place도 "—" 표시
        if (
          !division ||
          division.trim() === "" ||
          /^\d+K_[MF]$/i.test(division)
        ) {
          return (
            <div className="text-center text-[9px] md:text-sm">
              <span className="text-muted-foreground">-</span>
            </div>
          );
        }

        return (
          <div className="text-center text-[9px] md:text-sm">
            {divisionPlace || "-"}
          </div>
        );
      },
      size: 50,
      enableSorting: true,
    },

    // Performance
    {
      accessorKey: "agePerformance",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => handleSortClick(column)}
            className="h-6 px-1 text-[9px] md:h-8 md:px-2 md:text-sm"
          >
            Perf.
            {!isMobileDevice && <SortIcon isSorted={column.getIsSorted()} />}
          </Button>
        );
      },
      cell: ({ row }) => {
        const value = row.original.agePerformance;
        return value && value > 0 ? (
          <span className="font-mono text-[9px] md:text-xs">
            {Math.round(value)}%
          </span>
        ) : (
          <span className="text-muted-foreground text-[9px]">-</span>
        );
      },
      size: 60,
      enableSorting: true,
    },
  ];
}
