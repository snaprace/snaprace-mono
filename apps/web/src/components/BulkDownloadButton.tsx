"use client";

import { useState } from "react";
import { Download, FileArchive, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bulkDownloadPhotos } from "@/utils/photo";
import { trackBulkDownloadStart, trackPhotoDownload } from "@/lib/analytics";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BulkDownloadButtonProps {
  photos: string[];
  selectedPhotos?: string[];
  event: string;
  bibNumber?: string;
  className?: string;
  isSelectionMode?: boolean;
}

export function BulkDownloadButton({
  photos,
  selectedPhotos = [],
  event,
  bibNumber,
  className = "",
  isSelectionMode = false,
}: BulkDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);

  // Use selected photos if in selection mode and photos are selected
  const photosToDownload =
    isSelectionMode && selectedPhotos.length > 0 ? selectedPhotos : photos;

  const photoCount = photosToDownload.length;
  const willDownloadAsZip = photoCount >= 10;

  const handleBulkDownload = async () => {
    setIsDownloading(true);
    setDownloadComplete(false);
    setDownloadedCount(0);

    // Track bulk download start
    trackBulkDownloadStart(event, bibNumber || "", photoCount);

    try {
      const result = await bulkDownloadPhotos(
        photosToDownload,
        event,
        bibNumber,
      );
      if (result.success) {
        // Track successful bulk download
        trackPhotoDownload({
          event_id: event,
          bib_number: bibNumber || "",
          download_type: "bulk",
          photo_count: result.count,
          device_type:
            typeof window !== "undefined" && window.innerWidth < 768
              ? "mobile"
              : "desktop",
          download_method: result.method,
        });

        setDownloadedCount(result.count);
        setDownloadComplete(true);
        // Reset success state after 3 seconds
        setTimeout(() => {
          setDownloadComplete(false);
          setDownloadedCount(0);
        }, 3000);
      }
    } catch (error) {
      console.error("Bulk download failed:", error);
      // Show user-friendly error message
      alert(
        error instanceof Error
          ? error.message
          : "Download failed. Please try selecting fewer photos.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // Don't show button if no photos
  if (photoCount === 0) return null;

  // Show warning if too many photos selected
  const MAX_BULK_DOWNLOAD = 50;
  const tooManySelected = photoCount > MAX_BULK_DOWNLOAD;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleBulkDownload}
            disabled={isDownloading || tooManySelected}
            variant={
              downloadComplete
                ? "default"
                : tooManySelected
                  ? "destructive"
                  : "outline"
            }
            className={`gap-2 transition-all ${downloadComplete ? "bg-green-600 hover:bg-green-700" : ""} ${className}`}
          >
            {isDownloading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="hidden sm:inline">Downloading...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : downloadComplete ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">
                  Downloaded {downloadedCount} photos
                </span>
                <span className="sm:hidden">{downloadedCount}</span>
              </>
            ) : (
              <>
                {willDownloadAsZip ? (
                  <FileArchive className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden text-xs sm:inline">
                  {tooManySelected
                    ? `Too Many Selected (${photoCount} > ${MAX_BULK_DOWNLOAD})`
                    : isSelectionMode && selectedPhotos.length > 0
                      ? `Download Selected (${photoCount} photo${photoCount !== 1 ? "s" : ""})`
                      : `Download All (${photoCount} photo${photoCount !== 1 ? "s" : ""})`}
                </span>
                <span className="sm:hidden">
                  {tooManySelected
                    ? `Too Many (${photoCount})`
                    : (isSelectionMode && selectedPhotos.length > 0
                        ? "Selected"
                        : "All") + ` (${photoCount})`}
                </span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {tooManySelected
              ? `Please select ${MAX_BULK_DOWNLOAD} or fewer photos for bulk download`
              : willDownloadAsZip
                ? `Download ${isSelectionMode && selectedPhotos.length > 0 ? "selected" : "all"} ${photoCount} photos as ZIP file`
                : `Download ${isSelectionMode && selectedPhotos.length > 0 ? "selected" : "all"} ${photoCount} photos individually`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
