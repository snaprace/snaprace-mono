"use client";

import { toast } from "sonner";
import { downloadPhotoEnhanced, generatePhotoFilename } from "@/utils/photo";

export function createDownloadClickHandler(params: {
  url: string;
  event?: string;
  bibNumber?: string;
  index: number;
  isMobile: boolean;
}): (e: { stopPropagation?: () => void }) => Promise<void> {
  const { url, event, bibNumber, index, isMobile } = params;

  return async (e: { stopPropagation?: () => void }) => {
    try {
      e?.stopPropagation?.();

      const filename = generatePhotoFilename(event || "", bibNumber, index);
      const result = await downloadPhotoEnhanced(url, filename, isMobile);

      if (result.success) {
        switch (result.method) {
          case "native_share":
            toast.success("Shared to save on device!");
            break;
          case "new_tab":
            toast.info("Opened in new tab. Use browser save.");
            break;
          case "proxy":
          case "direct":
            toast.success("Photo download started!");
            break;
          case "newTab":
            toast.info("Photo opened in new tab. Right-click to save.");
            break;
          default:
            toast.success("Photo download started!");
        }
      } else {
        toast.error("Unable to download photo.");
      }
    } catch {
      toast.error("Unable to download photo.");
    }
  };
}
