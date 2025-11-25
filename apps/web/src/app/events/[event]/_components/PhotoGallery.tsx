"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { usePhotoGallery, type Photo } from "@/hooks/photos/usePhotoGallery";
import { useIsMobile } from "@/hooks/useMobile";
import { GalleryGrid, GalleryLightbox } from "@/components/photo-gallery";

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
  });

  const photos = useMemo(() => {
    if (overridePhotos) {
      return overridePhotos;
    }
    if (extraPhotos && extraPhotos.length > 0) {
      // 서버에서 이미 중복을 제거하고 내려주지만,
      // usePhotoGallery의 fetchedPhotos가 업데이트(pagination 등)되면서 발생할 수 있는
      // 혹시 모를 key 중복 에러를 방지하기 위해 간단한 중복 체크는 유지합니다.
      // 하지만 로직은 훨씬 단순화되었습니다.
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
      // pid가 없을 때 Lightbox가 열려있다면 닫기 (뒤로가기 대응)
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
