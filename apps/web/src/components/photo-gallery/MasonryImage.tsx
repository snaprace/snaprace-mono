import Image from "next/image";
import { useMemo } from "react";
import type { RenderImageContext, RenderImageProps } from "react-photo-album";
import { Skeleton } from "@/components/ui/skeleton";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import { getOriginalPhotoUrl } from "@/utils/photo";
import { getBlurDataURL } from "@/utils/thumbhash";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Camera, Forward } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { useImageDownloader } from "@/hooks/useImageDownloader";
import { ShareDialog } from "@/components/ShareDialog";
import { trackPhotoDownload } from "@/lib/analytics";

export function MasonryImage(
  { alt = "", title, className, onClick }: RenderImageProps,
  { photo: customPhoto, width, height }: RenderImageContext<Photo>,
) {
  const sizes = `
      (max-width: 480px) 240px,
      (max-width: 768px) 360px,
      (max-width: 1280px) 640px,
      1024px
    `;

  const isMobile = useIsMobile();
  const { downloadImage } = useImageDownloader({ isMobile });

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

  const instagramHandle = customPhoto.instagramHandle;
  const displayHandle = instagramHandle
    ? instagramHandle.startsWith("@")
      ? instagramHandle
      : `@${instagramHandle}`
    : null;
  const instagramUrl = instagramHandle
    ? `https://www.instagram.com/${instagramHandle.replace("@", "")}/`
    : null;

  return (
    <div
      id={`photo-${customPhoto.pid}`}
      style={{
        width: "100%",
        position: "relative",
        aspectRatio: `${width} / ${height}`,
      }}
      className={`${className} group`}
      onClick={onClick}
    >
      <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      <Image
        fill
        src={customPhoto.src}
        // src={`https://images.snap-race.com/${customPhoto.src}`}
        alt={alt}
        title={title}
        sizes={sizes}
        placeholder={blurDataURL ? "blur" : "empty"}
        blurDataURL={blurDataURL}
        className="cursor-pointer object-cover"
      />

      {/* Hover Overlay Gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60px] translate-y-4 bg-linear-to-t from-black/40 to-transparent opacity-0 transition-all duration-200 ease-in-out group-hover:translate-y-0 group-hover:opacity-100" />

      {/* Action Buttons */}
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

      {/* Instagram Handle */}
      {displayHandle && instagramUrl && (
        <div className="absolute bottom-3 left-3 z-20">
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-white/90 drop-shadow-md transition-colors duration-200 ease-in-out hover:text-white"
          >
            {displayHandle}
          </a>
        </div>
      )}

      {customPhoto.isSelfieMatch && (
        <div className="absolute top-2 left-2 z-10">
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
