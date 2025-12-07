"use client";

import { toast } from "sonner";
import { downloadPhotoEnhanced, generatePhotoFilename } from "@/utils/photo";

export function createDownloadClickHandler(params: {
  url: string;
  event?: string;
  bibNumber?: string;
  index: number;
  isMobile: boolean;
  t: (key: string) => string;
}): (e: { stopPropagation?: () => void }) => Promise<void> {
  const { url, event, bibNumber, index, isMobile, t } = params;

  return async (e: { stopPropagation?: () => void }) => {
    try {
      e?.stopPropagation?.();

      const filename = generatePhotoFilename(event || "", bibNumber, index);
      const result = await downloadPhotoEnhanced(url, filename, isMobile);

      if (result.success) {
        switch (result.method) {
          case "native_share":
            toast.success(t("sharedToSave"));
            break;
          case "new_tab":
            toast.info(t("openedInNewTab"));
            break;
          case "proxy":
          case "direct":
            toast.success(t("downloadStarted"));
            break;
          case "newTab":
            toast.info(t("openedInNewTabRightClick"));
            break;
          default:
            toast.success(t("downloadStarted"));
        }
      } else {
        toast.error(t("unableToDownload"));
      }
    } catch {
      toast.error(t("unableToDownload"));
    }
  };
}
