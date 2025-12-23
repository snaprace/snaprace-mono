"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

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
  const t = useTranslations("leaderboard");
  const totalPages = Math.ceil(totalResults / pageSize);
  const startResult = (currentPage - 1) * pageSize + 1;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  if (totalResults === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3 px-2 sm:flex-row sm:items-center sm:justify-between">
      {/* Rows per page */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <span className="text-muted-foreground text-xs md:text-sm">{t("rows")}:</span>
        <Select
          value={pageSize.toString()}
          onValueChange={(value) => onPageSizeChange(parseInt(value))}
        >
          <SelectTrigger className="h-8 w-16 text-xs md:h-9 md:w-20 md:text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10" className="text-xs md:text-sm">
              10
            </SelectItem>
            <SelectItem value="30" className="text-xs md:text-sm">
              30
            </SelectItem>
            <SelectItem value="50" className="text-xs md:text-sm">
              50
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Page navigation */}
      <div className="flex items-center gap-1 md:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="First page"
          className="h-8 w-8 p-0 md:h-9 md:w-9"
        >
          <ChevronsLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="h-8 w-8 p-0 md:h-9 md:w-9"
        >
          <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>

        <span className="text-muted-foreground min-w-[70px] text-center text-xs md:min-w-[100px] md:text-sm">
          {currentPage} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="h-8 w-8 p-0 md:h-9 md:w-9"
        >
          <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Last page"
          className="h-8 w-8 p-0 md:h-9 md:w-9"
        >
          <ChevronsRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
        </Button>
      </div>

      {/* Results info */}
      <span className="text-muted-foreground text-xs md:text-sm">
        {startResult}-{endResult} of {totalResults}
      </span>
    </div>
  );
}
