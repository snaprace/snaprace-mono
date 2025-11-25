import { useCallback } from "react";
import { saveAs } from "file-saver";
import { toast } from "sonner";

interface UseImageDownloaderProps {
  isMobile: boolean;
}

export function useImageDownloader({ isMobile }: UseImageDownloaderProps) {
  const downloadImage = useCallback(
    async (imageUrl: string, filename: string) => {
      try {
        // Fetch the image to get a blob (bypassing some CORS issues if proxied,
        // but ideally the image server should allow CORS)
        const response = await fetch(imageUrl, {
          mode: "cors",
          credentials: "omit",
        });
        const blob = await response.blob();
        const file = new File([blob], filename, { type: blob.type });

        if (isMobile && navigator.share) {
          try {
            const shareData: ShareData = {
              files: [file],
              title: "Photo Download",
            };

            if (navigator.canShare?.(shareData)) {
              await navigator.share(shareData);
              toast.success("Image shared successfully!");
              return;
            }
          } catch (error) {
            // User cancelled or share failed, fallback to download if possible or just log
            if ((error as Error).name !== "AbortError") {
              console.error("Share failed:", error);
              // Fallback to saving
              saveAs(blob, filename);
              toast.success("Image downloaded!");
            }
            return;
          }
        }

        // Desktop or Web Share API not supported/failed
        saveAs(blob, filename);
        toast.success("Image downloaded!");
      } catch (error) {
        console.error("Download failed:", error);
        toast.error("Failed to download image.");
      }
    },
    [isMobile],
  );

  return { downloadImage };
}
