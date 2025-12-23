import React, { type MouseEventHandler } from "react";
import { MasonryPhotoAlbum } from "react-photo-album";
import "react-photo-album/masonry.css";
import { MasonryPhotoSkeleton } from "@/components/states/EventsSkeleton";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";
import { MasonryImage } from "./MasonryImage";
import type { Photo } from "@/hooks/photos/usePhotoGallery";

interface GalleryGridProps {
  photos: Photo[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onPhotoClick: (index: number) => void;
  isMobile: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  isSelectionMode?: boolean;
}

export function GalleryGrid({
  photos,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onPhotoClick,
  isMobile,
  selectedIds,
  onToggleSelection,
  isSelectionMode,
}: GalleryGridProps) {
  const columns = (containerWidth: number) => {
    if (containerWidth < 834) return 2;
    if (containerWidth < 1034) return 3;
    if (containerWidth < 1534) return 4;
    return 5;
  };

  if (isLoading) {
    return <MasonryPhotoSkeleton />;
  }

  return (
    <div className="w-full">
      <MasonryPhotoAlbum
        photos={photos}
        columns={columns}
        spacing={4}
        render={{
          image: (props, context) => (
            <MasonryImage
              {...props}
              {...context}
              selectedIds={selectedIds}
              onToggleSelection={onToggleSelection}
              isSelectionMode={isSelectionMode}
            />
          ),
          button: ({ onClick, ...rest }) => (
            // Override button rendering to div to avoid nested buttons
            <div
              {...(rest as React.HTMLAttributes<HTMLDivElement>)}
              onClick={onClick as unknown as MouseEventHandler<HTMLDivElement>}
              className="react-photo-album--photo react-photo-album--button cursor-pointer"
            />
          ),
        }}
        onClick={({ index }) => onPhotoClick(index)}
      />

      <InfiniteScrollTrigger
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isMobile={isMobile}
      />
    </div>
  );
}
