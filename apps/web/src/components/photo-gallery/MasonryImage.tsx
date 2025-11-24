import Image from "next/image";
import type { RenderImageContext, RenderImageProps } from "react-photo-album";
import { Skeleton } from "@/components/ui/skeleton";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToLine, Camera, Forward } from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { useImageDownloader } from "@/hooks/useImageDownloader";
import { ShareDialog } from "@/components/ShareDialog";

export function MasonryImage(
  { alt = "", title, className, onClick }: RenderImageProps,
  { photo, width, height }: RenderImageContext,
) {
  const sizes = `
      (max-width: 480px) 240px,
      (max-width: 768px) 360px,
      (max-width: 1280px) 640px,
      1024px
    `;
  const customPhoto = photo as Photo;
  const isMobile = useIsMobile();
  const { downloadImage } = useImageDownloader({ isMobile });

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Extract ULID from key (format: <ulid>.jpg or folder/<ulid>.jpg)
    const ulid =
      customPhoto.id.split("/").pop()?.split(".")[0] ?? customPhoto.id;
    await downloadImage(
      customPhoto.src,
      `${customPhoto.organizerId}-${customPhoto.eventId}-${ulid}.jpg`,
    );
  };

  return (
    <div
      id={`photo-${customPhoto.id}`}
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
        alt={alt}
        title={title}
        sizes={sizes}
        placeholder={customPhoto.blurDataURL ? "blur" : "empty"}
        blurDataURL={customPhoto.blurDataURL}
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
          photoUrl={customPhoto.src}
          filename={`${customPhoto.organizerId}-${customPhoto.eventId}-${customPhoto.id.split("/").pop()?.split(".")[0] ?? customPhoto.id}.jpg`}
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

      {customPhoto.isSelfieMatch && (
        <div className="absolute top-2 left-2 z-10">
          <Badge
            variant="secondary"
            className="flex items-center gap-1 bg-black/50 text-white backdrop-blur-sm"
          >
            <Camera className="h-3 w-3" />
            <span className="text-xs">Selfie</span>
          </Badge>
        </div>
      )}
    </div>
  );
}
