import Image from "next/image";
import { useMemo } from "react";
import type { RenderImageContext, RenderImageProps } from "react-photo-album";
import { Skeleton } from "@/components/ui/skeleton";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import { getOriginalPhotoUrl } from "@/utils/photo";
import { getBlurDataURL } from "@/utils/thumbhash";
import { formatInstagramHandle } from "@/utils/instagram";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Camera, Forward, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { useImageDownloader } from "@/hooks/useImageDownloader";
import { ShareDialog } from "@/components/ShareDialog";
import { trackPhotoDownload } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// Define props by omitting conflicting fields from RenderImageProps (width/height usually strings or numbers in Attributes)
// and strict fields from RenderImageContext (width/height always numbers)
interface MasonryImageProps extends Omit<RenderImageProps, "width" | "height">, RenderImageContext<Photo> {
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  isSelectionMode?: boolean;
}

export function MasonryImage({
  alt = "",
  title,
  className,
  onClick,
  photo: customPhoto,
  width,
  height,
  selectedIds,
  onToggleSelection,
  isSelectionMode = false,
}: MasonryImageProps) {
  const sizes = `
      (max-width: 480px) 240px,
      (max-width: 768px) 360px,
      (max-width: 1280px) 640px,
      1024px
    `;

  const isMobile = useIsMobile();
  const { downloadImage } = useImageDownloader({ isMobile });

  const isSelected = selectedIds?.has(customPhoto.pid) ?? false;

  const blurDataURL = useMemo(
    () => getBlurDataURL(customPhoto.thumbHash ?? undefined),
    [customPhoto.thumbHash],
  );

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ulid = customPhoto.pid;

    trackPhotoDownload({
      event_id: customPhoto.eventId,
      bib_number: "",
      download_type: "single",
      photo_count: 1,
      device_type: isMobile ? "mobile" : "desktop",
    });

    const downloadUrl = getOriginalPhotoUrl(customPhoto.src);

    await downloadImage(
      downloadUrl,
      `${customPhoto.organizerId}-${customPhoto.eventId}-${ulid}.jpg`,
    );
  };

  const handleSelectionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelection?.(customPhoto.pid);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMobile && isSelectionMode) {
      // In selection mode, clicking image toggles selection
      e.stopPropagation();
      onToggleSelection?.(customPhoto.pid);
    } else {
      // Otherwise regular behavior (lightbox)
      // Cast event to satisfy onClick signature which expects HTMLImageElement related event from RenderImageProps
      if (onClick) {
        onClick(e as unknown as React.MouseEvent<HTMLImageElement>);
      }
    }
  };

  const { displayHandle, instagramUrl } = formatInstagramHandle(
    customPhoto.instagramHandle,
  );

  return (
    <div
      id={`photo-${customPhoto.pid}`}
      style={{
        width: "100%",
        position: "relative",
        aspectRatio: `${width} / ${height}`,
      }}
      className={cn(className, "group cursor-pointer", {
        "opacity-90": isSelected, // Slight visual cue
      })}
      onClick={handleClick}
    >
      <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      <Image
        fill
        src={customPhoto.src}
        alt={alt}
        title={title}
        sizes={sizes}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
        className={cn("object-cover transition-transform duration-200", {
          "scale-95": isSelected, // Google Photos style shrink
        })}
      />

      {/* Selection Checkmark Overlay (Desktop Only) */}
      {!isMobile && (
        <div
          className={cn(
            "absolute top-2 left-2 z-30 transition-opacity duration-200",
            {
              "opacity-100": isSelected || isSelectionMode,
              "opacity-0 group-hover:opacity-100":
                !isSelected && !isSelectionMode,
            },
          )}
          onClick={handleSelectionToggle}
        >
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
              {
                "border-blue-500 bg-blue-500": isSelected,
                "border-white/70 bg-black/20 hover:bg-black/40": !isSelected,
              },
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
          </div>
        </div>
      )}

      {/* Hover Overlay Gradient */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[60px] translate-y-4 bg-linear-to-t from-black/40 to-transparent opacity-0 transition-all duration-200 ease-in-out group-hover:translate-y-0 group-hover:opacity-100",
          {
            "opacity-0": isSelectionMode, // Hide clutter in selection mode if preferred
          },
        )}
      />

      {/* Action Buttons - Hide in selection mode to prevent confusion */}
      {!isSelectionMode && !isMobile && ( // Hide actions in selection mode
        <div className="absolute right-4 bottom-4 z-20 flex translate-y-4 gap-2 opacity-0 transition-all duration-200 ease-in-out group-hover:translate-y-0 group-hover:opacity-100">
          <button
            className="flex w-8 cursor-pointer items-center justify-center text-white hover:opacity-80"
            onClick={handleDownload}
          >
            <ArrowDownToLine size={22} strokeWidth={1.5} />
          </button>

          <ShareDialog
            pid={customPhoto.pid}
            photoUrl={getOriginalPhotoUrl(customPhoto.src)}
            filename={`${customPhoto.organizerId}-${customPhoto.eventId}-${customPhoto.pid}.jpg`}
            isMobile={isMobile}
            shareOptions={{
              eventId: customPhoto.eventId,
              organizerId: customPhoto.organizerId,
            }}
          >
            <button
              className="flex w-8 cursor-pointer items-center justify-center text-white hover:opacity-80"
              onClick={(e) => e.stopPropagation()}
            >
              <Forward size={22} strokeWidth={1.5} />
            </button>
          </ShareDialog>
        </div>
      )}

      {/* Instagram Handle */}
      {displayHandle && instagramUrl && !isSelectionMode && (
        <div className="absolute bottom-0 left-1 z-20 md:bottom-1 md:left-2">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-medium text-white/90 drop-shadow-md transition-colors duration-200 ease-in-out hover:text-white md:text-xs"
          >
            {displayHandle}
          </a>
        </div>
      )}

      {/* Selfie Badge */}
      {customPhoto.isSelfieMatch && (
         <div className={cn("absolute top-2 z-10", {
            "right-2": !isMobile,
            "left-2": isMobile 
        })}>
          <Badge
            variant="secondary"
            className="flex items-center gap-1 bg-black/50 text-white backdrop-blur-sm"
          >
            <Camera className="h-2.5 w-2.5 md:h-3 md:w-3" />
            <span className="text-[10px] md:text-xs">Selfie</span>
          </Badge>
        </div>
      )}
    </div>
  );
}
