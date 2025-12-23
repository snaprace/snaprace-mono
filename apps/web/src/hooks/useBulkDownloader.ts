import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { type Photo } from "@/hooks/photos/usePhotoGallery";
import { useTranslations } from "next-intl";
import { getOriginalPhotoUrl } from "@/utils/photo";
import { toast } from "sonner";

// Constants
export const MAX_SELECTION_LIMIT = 50;
export const LEVEL_1_THRESHOLD = 5;

interface UseBulkDownloaderReturn {
  downloadSelected: (photos: Photo[]) => Promise<void>;
  isDownloading: boolean;
  progress: number;
  total: number;
}

export function useBulkDownloader(): UseBulkDownloaderReturn {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const t = useTranslations("toast");

  const resetState = () => {
    setIsDownloading(false);
    setProgress(0);
    setTotal(0);
  };

  /**
   * Helper to fetch a blob from a URL
   */
  const fetchBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok) throw new Error("Network response was not ok");
    return response.blob();
  };

  /**
   * Level 1: Continuous Download
   * Threshold: <= LEVEL_1_THRESHOLD images
   */
  const downloadLevel1 = async (photos: Photo[]) => {
    let successCount = 0;
    let failedCount = 0;

    try {
      setIsDownloading(true);
      setTotal(photos.length);
      setProgress(0);

      for (const photo of photos) {
        const url = getOriginalPhotoUrl(photo.src);
        const filename = `${photo.organizerId}-${photo.eventId}-${photo.pid}.jpg`;

        if (!url) {
          failedCount++;
          setProgress((prev) => prev + 1);
          continue;
        }

        try {
          const blob = await fetchBlob(url);
          saveAs(blob, filename);
          successCount++;
          setProgress((prev) => prev + 1);

          // Small delay to prevent browser throttling/blocking
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (err) {
          console.error(`Failed to download ${photo.pid}`, err);
          failedCount++;
          setProgress((prev) => prev + 1);
        }
      }

      // Show appropriate toast based on results
      if (failedCount === 0) {
        toast.success(t("bulkDownloadComplete", { count: successCount }));
      } else if (successCount > 0) {
        toast.warning(
          t("downloadPartialFailure", {
            success: successCount,
            total: photos.length,
            failed: failedCount,
          }),
        );
      } else {
        toast.error(t("imageDownloadFailed"));
      }
    } catch (error) {
      console.error("Bulk download level 1 failed", error);
      toast.error(t("imageDownloadFailed"));
    } finally {
      resetState();
    }
  };

  /**
   * Level 2: ZIP Download
   * Threshold: > LEVEL_1_THRESHOLD images
   */
  const downloadLevel2 = async (photos: Photo[]) => {
    let successCount = 0;
    let failedCount = 0;

    try {
      setIsDownloading(true);
      setTotal(photos.length);
      setProgress(0);

      const zip = new JSZip();
      const folder = zip.folder("photos");

      for (const photo of photos) {
        const url = getOriginalPhotoUrl(photo.src);
        const filename = `${photo.organizerId}-${photo.eventId}-${photo.pid}.jpg`;

        if (!url) {
          failedCount++;
          setProgress((prev) => prev + 1);
          continue;
        }

        try {
          const blob = await fetchBlob(url);
          folder?.file(filename, blob);
          successCount++;
        } catch (err) {
          console.error(`Failed to fetch ${photo.pid} for zip`, err);
          folder?.file(`failed-${photo.pid}.txt`, "Failed to download");
          failedCount++;
        }

        setProgress((prev) => prev + 1);
      }

      toast.info(t("generatingZip"));

      const zipContent = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      saveAs(zipContent, `snaprace-photos-${timestamp}.zip`);

      // Show appropriate toast based on results
      if (failedCount === 0) {
        toast.success(t("bulkDownloadComplete", { count: successCount }));
      } else if (successCount > 0) {
        toast.warning(
          t("downloadPartialFailure", {
            success: successCount,
            total: photos.length,
            failed: failedCount,
          }),
        );
      } else {
        toast.error(t("imageDownloadFailed"));
      }
    } catch (error) {
      console.error("Bulk download level 2 failed", error);
      toast.error(t("imageDownloadFailed"));
    } finally {
      resetState();
    }
  };

  const downloadSelected = async (photos: Photo[]) => {
    const count = photos.length;
    if (count === 0) return;

    // Enforce maximum limit (defensive check, UI should already prevent this)
    const photosToDownload = photos.slice(0, MAX_SELECTION_LIMIT);

    if (photosToDownload.length <= LEVEL_1_THRESHOLD) {
      await downloadLevel1(photosToDownload);
    } else {
      await downloadLevel2(photosToDownload);
    }
  };

  return {
    downloadSelected,
    isDownloading,
    progress,
    total,
  };
}
