"use client";

import { useMemo, useState } from "react";
import { useDebounce } from "use-debounce";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";

import type { LeaderboardResult } from "@/server/services/timing-service";
import { LeaderboardFilters } from "./LeaderboardFilters";
import { LeaderboardPagination } from "./LeaderboardPagination";
import { StickyUserRow } from "./StickyUserRow";
import { filterBySearch, getUniqueDivisions } from "./utils";
import type { FilterState } from "./types";
import Link from "next/link";

interface RelayLeaderboardTableProps {
  results: LeaderboardResult[];
  highlightBib?: string;
  eventId: string;
  organizationId: string;
}

type RelaySegment = {
  label: string;
  time: string;
  timeSec: number;
};

type EnhancedRelayResult = LeaderboardResult & {
  segments?: RelaySegment[];
  isUserRow?: boolean;
};

function createRelayColumns(
  eventId: string,
  maxLegs: number,
): ColumnDef<EnhancedRelayResult>[] {
  const baseColumns: ColumnDef<EnhancedRelayResult>[] = [
    {
      id: "rank",
      accessorKey: "rank",
      header: "Rank",
      cell: ({ row }) => {
        const rank = row.original.rank;
        return (
          <div className="text-center text-[10px] font-semibold md:text-sm">
            {rank ?? "-"}
          </div>
        );
      },
    },
    {
      id: "teamName",
      accessorKey: "name",
      header: "Team Name",
      cell: ({ row }) => {
        const name = row.original.name || "Unknown";
        const bib = row.original.bib;
        return (
          <Link
            href={`/events/${eventId}/${bib}`}
            className="text-primary block text-[10px] font-medium hover:underline md:text-sm"
            title={name}
          >
            <div className="line-clamp-2 wrap-break-word">{name}</div>
          </Link>
        );
      },
    },
    {
      id: "division",
      accessorKey: "division",
      header: "Division",
      cell: ({ row }) => {
        const division = row.original.division;
        return (
          <div className="truncate text-[10px] md:text-sm">
            {division || "-"}
          </div>
        );
      },
    },
    {
      id: "chipTime",
      accessorKey: "chipTime",
      header: "Total",
      cell: ({ row }) => {
        const time = row.original.chipTime;
        return (
          <div className="text-[10px] font-semibold md:text-sm">
            {time || "-"}
          </div>
        );
      },
    },
  ];

  // Add dynamic leg columns
  const legColumns: ColumnDef<EnhancedRelayResult>[] = Array.from(
    { length: maxLegs },
    (_, index) => ({
      id: `leg${index + 1}`,
      header: `Leg ${index + 1}`,
      cell: ({ row }) => {
        const segments = row.original.segments;
        const segment = segments?.[index];
        return (
          <div className="text-[10px] md:text-sm">{segment?.time || "-"}</div>
        );
      },
    }),
  );

  return [...baseColumns, ...legColumns];
}

function parseSegments(sourcePayload: unknown): RelaySegment[] | undefined {
  if (!sourcePayload || typeof sourcePayload !== "object") return undefined;
  const payload = sourcePayload as Record<string, unknown>;
  const detail = payload.detail as Record<string, unknown> | undefined;
  if (!detail) return undefined;

  const segments = detail.segments;
  if (!Array.isArray(segments)) return undefined;

  return segments
    .map((seg, index) => {
      if (typeof seg !== "object" || seg === null) return null;
      const segmentData = seg as Record<string, unknown>;

      // RaceRoster API uses splitTime and splitTimeSec
      const splitTime = segmentData.splitTime;
      const splitTimeSec = segmentData.splitTimeSec;

      if (typeof splitTime !== "string" || typeof splitTimeSec !== "number") {
        return null;
      }

      return {
        label: `Leg ${index + 1}`,
        time: splitTime,
        timeSec: splitTimeSec,
      };
    })
    .filter((seg): seg is RelaySegment => seg !== null);
}

function getRelayRowClassName(result: EnhancedRelayResult): string {
  const classes = ["border-b", "transition-colors", "hover:bg-muted/30"];

  if (result.isUserRow) {
    classes.push("bg-primary/5", "border-l-4", "border-l-primary");
  }

  return classes.join(" ");
}

export function RelayLeaderboardTable({
  results,
  highlightBib,
  eventId,
  organizationId: _organizationId,
}: RelayLeaderboardTableProps) {
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

  const divisions = useMemo(() => getUniqueDivisions(results), [results]);

  const processedData = useMemo(() => {
    let filtered = filterBySearch(results, debouncedSearch);

    // Division 필터만 적용 (릴레이는 gender 필터 의미 없음)
    if (filters.division !== "all") {
      filtered = filtered.filter((r) => r.division === filters.division);
    }

    const enhanced = filtered.map((row) => {
      const segments = parseSegments(row.sourcePayload);
      return {
        ...row,
        segments,
        isUserRow: highlightBib ? row.bib === highlightBib : false,
      } as EnhancedRelayResult;
    });

    return enhanced;
  }, [results, debouncedSearch, filters, highlightBib]);

  // Calculate max number of legs across all teams
  const maxLegs = useMemo(() => {
    return Math.max(
      ...processedData.map((row) => row.segments?.length || 0),
      0,
    );
  }, [processedData]);

  const columns = useMemo(
    () => createRelayColumns(eventId, maxLegs),
    [eventId, maxLegs],
  );

  const table = useReactTable({
    data: processedData,
    columns,
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
  });

  const userRow = useMemo(() => {
    if (!highlightBib) return null;
    const userExists = processedData.some((row) => row.bib === highlightBib);
    if (!userExists) return null;

    const allRows = table.getCoreRowModel().rows;
    return allRows.find((row) => row.original.bib === highlightBib) || null;
  }, [table, highlightBib, processedData]);

  const totalResults = processedData.length;

  return (
    <div className="w-full max-w-full space-y-4 overflow-hidden md:px-6">
      <LeaderboardFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        divisions={divisions}
        hideGenderFilter={true}
      />

      <div className="border-border w-full max-w-full overflow-x-auto md:rounded-lg md:border">
        <table className="w-full" style={{ tableLayout: "fixed" }}>
          <thead className="bg-muted/50 border-muted/50 sticky top-0 z-20 border-l-4">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const columnId = header.column.id;
                  const getMobileWidth = (id: string) => {
                    const widths: Record<string, number> = {
                      rank: 35,
                      teamName: 180,
                      division: 80,
                      chipTime: 60,
                    };
                    // Dynamic leg columns
                    if (id.startsWith("leg")) {
                      return 70;
                    }
                    return widths[id] || 50;
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

          <tbody>
            {userRow && <StickyUserRow row={userRow} />}

            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    className={`h-12 md:h-16 ${getRelayRowClassName(row.original)}`}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const columnId = cell.column.id;
                      const getMobileWidth = (id: string) => {
                        const widths: Record<string, number> = {
                          rank: 35,
                          teamName: 180,
                          division: 80,
                          chipTime: 60,
                        };
                        // Dynamic leg columns
                        if (id.startsWith("leg")) {
                          return 70;
                        }
                        return widths[id] || 50;
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
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-muted-foreground p-8 text-center text-sm"
                >
                  No results found. Try adjusting your filters or search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
