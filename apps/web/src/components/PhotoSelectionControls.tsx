"use client";

import { Button } from "@/components/ui/button";
import { CheckSquare, Square, MousePointer2, X } from "lucide-react";

interface PhotoSelectionControlsProps {
  isSelectionMode: boolean;
  selectedCount: number;
  totalCount: number;
  onToggleSelectionMode: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function PhotoSelectionControls({
  isSelectionMode,
  selectedCount,
  totalCount,
  onToggleSelectionMode,
  onSelectAll,
  onClearSelection,
}: PhotoSelectionControlsProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;
  const MAX_BULK_DOWNLOAD = 50;

  return (
    <div className="flex items-center gap-3">
      {/* Selection Mode Toggle */}
      <Button
        variant={isSelectionMode ? "default" : "outline"}
        size="sm"
        onClick={onToggleSelectionMode}
        className="gap-2"
      >
        {isSelectionMode ? (
          <>
            <X className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Exit Selection</span>
            <span className="sm:hidden">Exit</span>
          </>
        ) : (
          <>
            <MousePointer2 className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Select Photos</span>
            <span className="sm:hidden">Select</span>
          </>
        )}
      </Button>

      {/* Selection Controls - Only shown when in selection mode */}
      {isSelectionMode && (
        <>
          <div className="text-muted-foreground text-sm">
            {selectedCount > 0 ? (
              <span
                className={
                  selectedCount > MAX_BULK_DOWNLOAD ? "text-orange-600" : ""
                }
              >
                {selectedCount} of {totalCount} selected
                {selectedCount > MAX_BULK_DOWNLOAD && (
                  <span className="block text-xs">
                    (Max {MAX_BULK_DOWNLOAD} for bulk download)
                  </span>
                )}
              </span>
            ) : (
              <span>Click photos to select</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? onClearSelection : onSelectAll}
              className="gap-1 text-xs"
            >
              {allSelected ? (
                <>
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">Deselect All</span>
                  <span className="sm:hidden">None</span>
                </>
              ) : (
                <>
                  <Square className="h-4 w-4" />
                  <span className="hidden text-xs sm:inline">Select All</span>
                  <span className="sm:hidden">All</span>
                </>
              )}
            </Button>

            {selectedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="gap-1 text-xs"
              >
                <X className="h-4 w-4" />
                <span className="hidden text-xs sm:inline">Clear</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
