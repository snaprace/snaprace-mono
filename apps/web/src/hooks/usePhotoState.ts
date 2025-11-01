/**
 * Photo state management hook for URL and modal states
 */

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { calculateColumnCount, isMobileDevice, debounce } from "@/utils/device";
import {
  decodePhotoId,
} from "@/utils/photo";

export function usePhotoState(photos: string[] = []) {
  const params = useParams();
  const searchParams = useSearchParams();

  // URL parameters
  const event = params?.event as string;
  const bibParam = params?.bib as string;
  const isAllPhotos = bibParam === "null";
  const bibNumber = isAllPhotos ? "" : bibParam;

  // Local states
  const [searchBib, setSearchBib] = useState(bibNumber || "");
  const [columnCount, setColumnCount] = useState(4);
  const [isMobile, setIsMobile] = useState(false);
  const [clickedPhotoRect, setClickedPhotoRect] = useState<DOMRect | null>(
    null,
  );

  // Parse SingleView state from URL - support both idx and pid
  const photoIdParam = searchParams.get("pid");
  const photoIndexParam = searchParams.get("idx"); // backward compatibility

  // Calculate current photo index
  const currentPhotoIndex = useMemo(() => {
    if (photoIdParam && photos.length > 0) {
      const decodedId = decodePhotoId(photoIdParam);
      const foundUrl = photos.find((url) => {
        const urlId = /\/([^/]+)\.(jpg|jpeg|png|webp)$/i.exec(url)?.[1];
        return urlId === decodedId;
      });
      if (foundUrl) {
        return photos.indexOf(foundUrl);
      }
    }
    // Fallback to idx parameter for backward compatibility
    if (photoIndexParam) {
      return parseInt(photoIndexParam, 10);
    }
    return 0;
  }, [photoIdParam, photoIndexParam, photos]);

  const isModalOpen = photoIdParam !== null || photoIndexParam !== null;
  const currentPhotoId = photoIdParam ? decodePhotoId(photoIdParam) : null;

  // Responsive layout effect
  useEffect(() => {
    const updateLayout = debounce(() => {
      const width = window.innerWidth;
      setColumnCount(calculateColumnCount(width));
      setIsMobile(isMobileDevice());
    }, 100);

    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  return {
    // URL params
    event,
    bibParam,
    bibNumber,
    isAllPhotos,

    // Search state
    searchBib,
    setSearchBib,

    // Layout state
    columnCount,
    isMobile,

    // Modal state
    isModalOpen,
    currentPhotoIndex,
    currentPhotoId,
    clickedPhotoRect,
    setClickedPhotoRect,
  };
}
