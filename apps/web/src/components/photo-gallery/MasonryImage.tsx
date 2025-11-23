import Image from "next/image";
import type { RenderImageContext, RenderImageProps } from "react-photo-album";
import { Skeleton } from "@/components/ui/skeleton";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import { Badge } from "@/components/ui/badge";
import { Camera } from "lucide-react";

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

  return (
    <div
      id={`photo-${customPhoto.id}`}
      style={{
        width: "100%",
        position: "relative",
        aspectRatio: `${width} / ${height}`,
      }}
      className={className}
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
        className="cursor-pointer object-cover transition-opacity duration-300 hover:opacity-90"
      />
      {customPhoto.isSelfieMatch && (
        <div className="absolute top-2 left-2 z-10">
          <Badge
            variant="secondary"
            className="flex items-center gap-1 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
          >
            <Camera className="h-3 w-3" />
            <span className="text-xs">Selfie Match</span>
          </Badge>
        </div>
      )}
    </div>
  );
}
