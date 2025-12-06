"use client";

import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import { useTranslations } from "next-intl";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";

import type { LeaderboardResult } from "@/server/services/timing-service";
import { createColumns } from "./columns";
import { LeaderboardFilters } from "./LeaderboardFilters";
import { LeaderboardPagination } from "./LeaderboardPagination";
import { StickyUserRow } from "./StickyUserRow";
import {
  markDivisionWinners,
  filterBySearch,
  applyFilters,
  getUniqueDivisions,
  getRowClassName,
  getTooltipMessage,
} from "./utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FilterState } from "./types";
import type { CategoryOption } from "./LeaderboardFilters";

interface LeaderboardTableAdvancedProps {
  results: LeaderboardResult[];
  highlightBib?: string;
  eventId: string;
  organizationId: string;
  // 카테고리 관련 props
  categories?: CategoryOption[];
  selectedCategory?: string | null;
  onCategoryChange?: (categoryId: string) => void;
}

export function LeaderboardTableAdvanced({
  results,
  highlightBib,
  eventId,
  organizationId: _organizationId,
  categories,
  selectedCategory,
  onCategoryChange,
}: LeaderboardTableAdvancedProps) {
  const t = useTranslations("leaderboard");
  // 상태 관리
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);

  const [filters, setFilters] = useState<FilterState>({
    division: "all",
    gender: "all",
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "rank", desc: false },
  ]);

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Division 목록 추출
  const divisions = useMemo(() => getUniqueDivisions(results), [results]);

  // 필터링 및 데이터 가공
  const processedData = useMemo(() => {
    // 1. 검색 필터링
    let filtered = filterBySearch(results, debouncedSearch);

    // 2. Division/Gender/Age 필터 적용
    filtered = applyFilters(filtered, filters);

    // 3. Division 1등 마킹
    const enhanced = markDivisionWinners(filtered);

    // 4. 사용자 행 마킹
    if (highlightBib) {
      return enhanced.map((row) => ({
        ...row,
        isUserRow: row.bib === highlightBib,
      }));
    }

    return enhanced;
  }, [results, debouncedSearch, filters, highlightBib]);

  // Performance 데이터 존재 여부 확인
  const hasPerformanceData = useMemo(() => {
    return processedData.some(
      (row) => row.agePerformance && row.agePerformance > 0,
    );
  }, [processedData]);

  // Columns 생성
  const columns = useMemo(() => createColumns(eventId), [eventId]);

  // 조건부 columns (Performance 데이터가 없으면 해당 컬럼 제거)
  const visibleColumns = useMemo(() => {
    if (hasPerformanceData) {
      return columns;
    }
    return columns.filter(
      (col) => !("accessorKey" in col) || col.accessorKey !== "agePerformance",
    );
  }, [hasPerformanceData, columns]);

  // TanStack Table 인스턴스
  const table = useReactTable({
    data: processedData,
    columns: visibleColumns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    enableColumnResizing: false, // 명시적으로 비활성화하지만 size는 적용되도록 설정
    columnResizeMode: undefined,
  });

  // 사용자 Row 찾기 (Sticky Row용) - 현재 카테고리 데이터에서만 찾음
  const userRow = useMemo(() => {
    if (!highlightBib) return null;
    // processedData에서 사용자 찾기 (필터링된 결과에서만 검색)
    const userExists = processedData.some((row) => row.bib === highlightBib);
    if (!userExists) return null;

    const allRows = table.getCoreRowModel().rows;
    return allRows.find((row) => row.original.bib === highlightBib) || null;
  }, [table, highlightBib, processedData]);

  const totalResults = processedData.length;

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden md:px-6">
      {/* 필터 및 검색 */}
      <LeaderboardFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        divisions={divisions}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={onCategoryChange}
      />
      {/* 결과 카운트 */}
      {/* {showResultsCount && (
        <div className="text-muted-foreground text-sm">
          {totalResults} result{totalResults !== 1 ? "s" : ""} found
          {debouncedSearch && ` for "${debouncedSearch}"`}
        </div>
      )} */}

      {/* 테이블 */}
      <div className="border-border w-full max-w-full overflow-x-auto md:rounded-lg md:border">
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          {/* 헤더 */}
          <thead className="bg-muted/50 border-muted/50 sticky top-0 z-20 border-l-4">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  // 모바일 너비 설정
                  const getMobileWidth = (id: string) => {
                    const widths: Record<string, number> = {
                      rank: 35,
                      bib: 40,
                      name: 70,
                      chipTime: 55,
                      avgPace: 45,
                      division: 50,
                      divisionPlace: 40,
                      agePerformance: 40,
                    };
                    return widths[id] || 40;
                  };

                  return (
                    <th
                      key={header.id}
                      style={{
                        width: `${getMobileWidth(columnId)}px`,
                        minWidth: `${getMobileWidth(columnId)}px`,
                      }}
                      className="p-[2px] text-left text-[10px] font-semibold md:p-3 md:text-sm"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* 데이터 행 */}
          <tbody>
            {/* Sticky User Row */}
            {userRow && <StickyUserRow row={userRow} />}

            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                const tooltipMessage = getTooltipMessage(row.original);

                const rowContent = (
                  <tr
                    key={row.id}
                    className={`h-12 md:h-16 ${getRowClassName(row.original)}`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const columnId = cell.column.id;
                      // 모바일 너비 설정 (헤더와 동일)
                      const getMobileWidth = (id: string) => {
                        const widths: Record<string, number> = {
                          rank: 35,
                          bib: 40,
                          name: 70,
                          chipTime: 55,
                          avgPace: 45,
                          division: 50,
                          divisionPlace: 40,
                          agePerformance: 40,
                        };
                        return widths[id] || 40;
                      };

                      return (
                        <td
                          key={cell.id}
                          className="p-[2px] md:p-3"
                          style={{
                            width: `${getMobileWidth(columnId)}px`,
                            minWidth: `${getMobileWidth(columnId)}px`,
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );

                // Tooltip이 있는 경우에만 Tooltip으로 감싸기
                if (tooltipMessage) {
                  return (
                    <Tooltip key={row.id}>
                      <TooltipTrigger asChild>{rowContent}</TooltipTrigger>
                      <TooltipContent align="start" className="font-medium">
                        <p>{tooltipMessage}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return rowContent;
              })
            ) : (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  className="text-muted-foreground p-8 text-center text-sm"
                >
                  {t("noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* 페이지네이션 */}
      {totalResults > 0 && (
        <LeaderboardPagination
          currentPage={pagination.pageIndex + 1}
          pageSize={pagination.pageSize}
          totalResults={totalResults}
          onPageChange={(page) =>
            setPagination({ ...pagination, pageIndex: page - 1 })
          }
          onPageSizeChange={(size) =>
            setPagination({ pageIndex: 0, pageSize: size })
          }
        />
      )}
    </div>
  );
}
