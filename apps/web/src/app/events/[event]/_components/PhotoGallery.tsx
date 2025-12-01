"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { usePhotoGallery, type Photo } from "@/hooks/photos/usePhotoGallery";
import { useIsMobile } from "@/hooks/useMobile";
import { GalleryGrid, GalleryLightbox } from "@/components/photo-gallery";
import { useEventPhotographers } from "@/hooks/photographers/useEventPhotographers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PhotoGalleryProps {
  eventId: string;
  organizerId: string;
  bib?: string;
  overridePhotos?: Photo[]; // For event page filtering (Selfie Search)
  extraPhotos?: Photo[]; // For bib page merging (Selfie Search)
}

export function PhotoGallery({
  eventId,
  organizerId,
  bib,
  overridePhotos,
  extraPhotos,
}: PhotoGalleryProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [index, setIndex] = useState(-1);
  const [selectedPhotographer, setSelectedPhotographer] = useState<
    string | null
  >(null);

  const { photographers } = useEventPhotographers(eventId);

  const {
    photos: fetchedPhotos,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = usePhotoGallery({
    eventId,
    organizerId,
    bib,
    instagramHandle: selectedPhotographer,
  });

  const photos = useMemo(() => {
    if (overridePhotos) {
      return overridePhotos;
    }
    if (extraPhotos && extraPhotos.length > 0) {
      const existingIds = new Set(fetchedPhotos.map((p) => p.pid));
      const newUniquePhotos = extraPhotos.filter(
        (p) => !existingIds.has(p.pid),
      );

      return [...newUniquePhotos, ...fetchedPhotos];
    }
    return fetchedPhotos;
  }, [fetchedPhotos, overridePhotos, extraPhotos]);

  // Sync URL -> State
  useEffect(() => {
    const pid = searchParams.get("pid");

    if (pid) {
      const newIndex = photos.findIndex((p) => p.pid === pid);
      if (newIndex >= 0 && newIndex !== index) {
        setIndex(newIndex);
        if (index === -1) {
          const element = document.getElementById(`photo-${pid}`);
          element?.scrollIntoView({ behavior: "auto", block: "center" });
        }
      }
    } else {
      if (index !== -1) {
        setIndex(-1);
      }
    }
  }, [searchParams, photos]);

  // Handlers
  const handlePhotoClick = (newIndex: number) => {
    setIndex(newIndex);
    const photo = photos[newIndex];
    if (photo) {
      const element = document.getElementById(`photo-${photo.pid}`);
      element?.scrollIntoView({ behavior: "auto", block: "center" });
      router.push(`${pathname}?pid=${encodeURIComponent(photo.pid)}`, {
        scroll: false,
      });
    }
  };

  const handleClose = () => {
    setIndex(-1);
    router.push(pathname, { scroll: false });
  };

  const handleView = (currentIndex: number) => {
    setIndex(currentIndex);
    const photo = photos[currentIndex];
    if (photo) {
      const element = document.getElementById(`photo-${photo.pid}`);
      element?.scrollIntoView({ behavior: "auto", block: "center" });
      router.replace(`${pathname}?pid=${encodeURIComponent(photo.pid)}`, {
        scroll: false,
      });
    }
  };

  const handlePrev = () => setIndex(index - 1);
  const handleNext = () => setIndex(index + 1);

  return (
    <>
      {!bib && photographers && photographers.length > 0 && (
        <div className="mb-4 flex items-center justify-end gap-2 px-1 md:mb-6 md:px-4">
          <Select
            value={selectedPhotographer ?? "all"}
            onValueChange={(value) =>
              setSelectedPhotographer(value === "all" ? null : value)
            }
          >
            <SelectTrigger
              size="sm"
              className="w-[180px] text-sm backdrop-blur-sm md:w-[200px]"
            >
              <div className="flex items-center gap-2 truncate">
                <SelectValue placeholder="All Photographers" />
              </div>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">
                <span className="text-muted-foreground">All Photographers</span>
              </SelectItem>
              {photographers.map((p) => (
                <SelectItem
                  key={p.instagramHandle}
                  value={p.instagramHandle ?? ""}
                >
                  {p.instagramHandle} ({p.imageCount ?? 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <GalleryGrid
        photos={photos}
        isLoading={isLoading && !overridePhotos} // Don't show loading if we have override photos
        hasNextPage={hasNextPage && !overridePhotos} // Disable pagination if filtering
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        onPhotoClick={handlePhotoClick}
        isMobile={isMobile}
      />

      <GalleryLightbox
        open={index >= 0}
        index={index}
        photos={photos}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
        onView={handleView}
        isMobile={isMobile}
      />
    </>
  );
}
