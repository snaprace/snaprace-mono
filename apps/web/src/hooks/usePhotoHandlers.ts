/**
 * Photo-related event handlers hook
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  downloadPhoto,
  scrollPhotoIntoView,
  extractPhotoId,
  encodePhotoId,
  generateShareablePhotoUrl,
} from "@/utils/photo";
import { trackPhotoView, trackPhotoDownload } from "@/lib/analytics";

interface UsePhotoHandlersProps {
  event: string;
  bibParam: string;
  isMobile: boolean;
  photoRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  setClickedPhotoRect: (rect: DOMRect | null) => void;
  photos?: string[];
}

export function usePhotoHandlers({
  event,
  bibParam,
  isMobile,
  photoRefs,
  setClickedPhotoRect,
  photos = [],
}: UsePhotoHandlersProps) {
  const router = useRouter();

  // Handle photo click to open SingleView
  const handlePhotoClick = useCallback(
    (index: number) => {
      const photoElement = photoRefs.current.get(index);
      if (photoElement) {
        setClickedPhotoRect(photoElement.getBoundingClientRect());
      }

      // Track photo view
      if (photos[index]) {
        trackPhotoView({
          event_id: event,
          bib_number: bibParam !== "null" ? bibParam : "",
          photo_url: photos[index],
          photo_index: index,
        });
      }

      // Update URL with photo ID if available, fallback to index
      const newParams = new URLSearchParams();
      if (photos[index]) {
        const photoId = extractPhotoId(photos[index]);
        const encodedId = encodePhotoId(photoId);
        newParams.set("pid", encodedId);
      } else {
        // Fallback to index for backward compatibility
        newParams.set("idx", index.toString());
      }
      router.push(`/events/${event}/${bibParam}?${newParams.toString()}`, {
        scroll: false,
      });
    },
    [event, bibParam, router, photoRefs, setClickedPhotoRect, photos],
  );

  // Handle photo index change in SingleView
  const handlePhotoIndexChange = useCallback(
    (newIndex: number) => {
      // Real-time scroll synchronization with background gallery
      scrollPhotoIntoView(photoRefs, newIndex);

      // Update URL with photo ID if available, fallback to index
      const newParams = new URLSearchParams();
      if (photos[newIndex]) {
        const photoId = extractPhotoId(photos[newIndex]);
        const encodedId = encodePhotoId(photoId);
        newParams.set("pid", encodedId);
      } else {
        // Fallback to index for backward compatibility
        newParams.set("idx", newIndex.toString());
      }
      router.push(`/events/${event}/${bibParam}?${newParams.toString()}`, {
        scroll: false,
      });
    },
    [event, bibParam, router, photoRefs, photos],
  );

  // Handle closing SingleView
  const handleCloseSingleView = useCallback(() => {
    router.push(`/events/${event}/${bibParam}`, { scroll: false });
  }, [event, bibParam, router]);

  // Handle photo sharing
  const handleShare = useCallback(
    async (photoUrl: string, _index?: number) => {
      try {
        const shareableUrl = generateShareablePhotoUrl(photoUrl);

        // On mobile, try native share first
        if (isMobile && typeof navigator !== "undefined" && navigator.share) {
          try {
            await navigator.share({
              title: "SnapRace Photo",
              text: "Check out this race photo!",
              url: shareableUrl,
            });

            // Track successful share
            // Photo share tracking removed - using SNS-specific tracking instead
            toast.success("Shared successfully!");
            return;
          } catch (error) {
            if ((error as Error).name === "AbortError") {
              return; // User cancelled, don't show error
            }
            // Fall through to clipboard copy
          }
        }

        // Fallback to clipboard copy
        await navigator.clipboard.writeText(shareableUrl);

        // Track successful clipboard share
        // Photo share tracking removed - using SNS-specific tracking instead
        toast.success("Share link copied to clipboard!");
      } catch {
        toast.error("Failed to share photo");
      }
    },
    [isMobile],
  );

  // Handle photo download
  const handleDownload = useCallback(
    async (photoUrl: string, index?: number) => {
      const filename = `photo-${event}-${index ? index + 1 : "unknown"}.jpg`;

      const result = await downloadPhoto(photoUrl, filename);

      if (result.success) {
        // Track successful download
        trackPhotoDownload({
          event_id: event,
          bib_number: bibParam !== "null" ? bibParam : "",
          download_type: "single",
          photo_count: 1,
          device_type: isMobile ? "mobile" : "desktop",
          download_method: result.method,
        });

        switch (result.method) {
          case "proxy":
          case "direct":
            toast.success("Photo download started!");
            break;
          case "newTab":
            toast.info("Photo opened in new tab. Right-click to save.");
            break;
        }
      } else {
        toast.error("Unable to download photo.");
      }
    },
    [event, bibParam, isMobile],
  );

  return {
    handlePhotoClick,
    handlePhotoIndexChange,
    handleCloseSingleView,
    handleShare,
    handleDownload,
  };
}
