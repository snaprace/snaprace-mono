"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { usePhotoGallery } from "@/hooks/photos/usePhotoGallery";
import { useIsMobile } from "@/hooks/useMobile";
import { GalleryGrid, GalleryLightbox } from "@/components/photo-gallery";

interface PhotoGalleryProps {
  eventId: string;
  organizerId: string;
  bib?: string;
}

export function PhotoGallery({ eventId, organizerId, bib }: PhotoGalleryProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [index, setIndex] = useState(-1);

  const { photos, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    usePhotoGallery({
      eventId,
      organizerId,
      bib,
    });

  // Sync URL -> State
  useEffect(() => {
    const photoId = searchParams.get("photoId");

    if (photoId) {
      const newIndex = photos.findIndex((p) => p.id === photoId);
      if (newIndex >= 0 && newIndex !== index) {
        setIndex(newIndex);
        if (index === -1) {
          const element = document.getElementById(`photo-${photoId}`);
          element?.scrollIntoView({ behavior: "auto", block: "center" });
        }
      }
    } else {
      // photoId가 없을 때 Lightbox가 열려있다면 닫기 (뒤로가기 대응)
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
      const element = document.getElementById(`photo-${photo.id}`);
      element?.scrollIntoView({ behavior: "auto", block: "center" });
      router.push(`${pathname}?photoId=${encodeURIComponent(photo.id)}`, {
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
      const element = document.getElementById(`photo-${photo.id}`);
      element?.scrollIntoView({ behavior: "auto", block: "center" });
      router.replace(`${pathname}?photoId=${encodeURIComponent(photo.id)}`, {
        scroll: false,
      });
    }
  };

  const handlePrev = () => setIndex(index - 1);
  const handleNext = () => setIndex(index + 1);

  return (
    <>
      <GalleryGrid
        photos={photos}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
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
