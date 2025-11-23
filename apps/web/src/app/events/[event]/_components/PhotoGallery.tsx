"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MasonryPhotoAlbum } from "react-photo-album";
import Lightbox, {
  isImageFitCover,
  isImageSlide,
  useLightboxProps,
  useLightboxState,
  type Slide,
  type SlideImage,
} from "yet-another-react-lightbox";
import "react-photo-album/masonry.css";
import "yet-another-react-lightbox/styles.css";
import type { RenderImageContext, RenderImageProps } from "react-photo-album";
import { api } from "@/trpc/react";
import { getBlurDataURL } from "@/utils/thumbhash";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LoaderCircle,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useMobile";
import { MasonryPhotoSkeleton } from "@/components/states/EventsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

export type Photo = {
  src: string;
  width: number;
  height: number;
  id: string;
  blurDataURL?: string;
};

declare module "yet-another-react-lightbox" {
  interface GenericSlide {
    id?: string;
    blurDataURL?: string;
  }
}

interface PhotoGalleryProps {
  eventId: string;
  organizerId: string;
}

function isNextJsImage(
  slide: Slide,
): slide is SlideImage & { width: number; height: number } {
  return (
    isImageSlide(slide) &&
    typeof slide.width === "number" &&
    typeof slide.height === "number"
  );
}

function NextJsImage({
  slide,
  offset,
  rect,
}: {
  slide: Slide;
  offset: number;
  rect: { width: number; height: number };
}) {
  const {
    on: { click },
    carousel: { imageFit },
  } = useLightboxProps();

  const { currentIndex } = useLightboxState();
  const cover = isImageSlide(slide) && isImageFitCover(slide, imageFit);

  if (!isNextJsImage(slide)) return undefined;

  const width = !cover
    ? Math.round(
        Math.min(rect.width, (rect.height / slide.height) * slide.width),
      )
    : rect.width;

  const height = !cover
    ? Math.round(
        Math.min(rect.height, (rect.width / slide.width) * slide.height),
      )
    : rect.height;

  return (
    <div style={{ position: "relative", width, height }}>
      <Image
        fill
        alt=""
        src={slide.src}
        loading="eager"
        draggable={false}
        placeholder={slide.blurDataURL ? "blur" : "empty"}
        blurDataURL={slide.blurDataURL}
        style={{
          objectFit: cover ? "cover" : "contain",
          cursor: click ? "pointer" : undefined,
        }}
        // SSR 안전성을 위해 window check 추가 권장 (혹은 고정값 사용)
        sizes={
          typeof window !== "undefined"
            ? `${Math.ceil((width / window.innerWidth) * 100)}vw`
            : "100vw"
        }
        onClick={
          offset === 0
            ? () => {
                click?.({ index: currentIndex });
              }
            : undefined
        }
      />
    </div>
  );
}

const InfiniteScrollTrigger = ({
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isMobile,
}: {
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isMobile: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        threshold: 0.1,
        rootMargin: isMobile ? "1000px" : "500px",
      },
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, isMobile]);

  return (
    <div
      ref={ref}
      className="mt-4 flex h-[100px] w-full items-center justify-center"
    >
      {isFetchingNextPage && (
        <LoaderCircle size={30} className="animate-spin text-gray-500" />
      )}
    </div>
  );
};

// --- Main Component ---

export function PhotoGallery({ eventId, organizerId }: PhotoGalleryProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [index, setIndex] = useState(-1);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    api.photosV2.getByEvent.useInfiniteQuery(
      {
        organizerId,
        eventId,
        limit: 100,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  const photos = useMemo(() => {
    return (
      data?.pages.flatMap((page) =>
        page.items.map((item) => ({
          id: item.key,
          src: item.imageUrl,
          width: item.width,
          height: item.height,
          blurDataURL: getBlurDataURL(item.thumbHash),
        })),
      ) ?? []
    );
  }, [data]);

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

  const handleView = ({ index: currentIndex }: { index: number }) => {
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

  // Grid Logic
  const columns = (containerWidth: number) => {
    if (containerWidth < 834) return 2;
    if (containerWidth < 1034) return 3;
    if (containerWidth < 1534) return 4;
    return 5;
  };

  const renderNextImage = (
    { alt = "", title, className, onClick }: RenderImageProps,
    { photo, width, height }: RenderImageContext,
  ) => {
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
      </div>
    );
  };

  if (isLoading) {
    return <MasonryPhotoSkeleton />;
  }

  return (
    <>
      <div className="w-full">
        <MasonryPhotoAlbum
          photos={photos}
          columns={columns}
          spacing={2}
          render={{ image: renderNextImage }}
          onClick={({ index }) => handlePhotoClick(index)}
        />

        <InfiniteScrollTrigger
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isMobile={isMobile}
        />
      </div>

      <Lightbox
        open={index >= 0}
        index={index}
        close={handleClose}
        slides={photos.map((photo) => ({
          src: photo.src,
          width: photo.width,
          height: photo.height,
          id: photo.id,
          blurDataURL: photo.blurDataURL,
        }))}
        render={{
          slide: NextJsImage,
          buttonPrev: () => null,
          buttonNext: () => null,
          slideContainer: ({ children }) => (
            <div
              style={{ position: "relative", width: "100%", height: "100%" }}
            >
              {/* Previous Click Area */}
              <div
                className="group"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "33.33%",
                  height: "100%",
                  cursor: "pointer",
                  zIndex: 2,
                  marginTop: 60,
                }}
                onClick={handlePrev}
              >
                {!isMobile && (
                  <div className="absolute top-1/2 left-4 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ChevronLeftIcon
                      size={30}
                      strokeWidth={1}
                      className="text-gray-500 drop-shadow-md hover:text-gray-800"
                    />
                  </div>
                )}
              </div>

              {/* Next Click Area */}
              <div
                className="group"
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: "33.33%",
                  height: "100%",
                  cursor: "pointer",
                  zIndex: 2,
                  marginTop: 60,
                }}
                onClick={handleNext}
              >
                {!isMobile && (
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <ChevronRightIcon
                      size={30}
                      strokeWidth={1}
                      className="text-gray-500 drop-shadow-md hover:text-gray-800"
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {children}
              </div>
            </div>
          ),
        }}
        on={{ view: handleView }}
        styles={{
          root: {
            "--yarl__color_backdrop": "#fff",
            "--yarl__button_filter": "none",
          },
        }}
        animation={{
          fade: 0.4,
          swipe: 0.4,
          navigation: 0.4,
          easing: {
            fade: "cubic-bezier(0.4, 0, 0.2, 1)",
            swipe: "cubic-bezier(0.4, 0, 0.2, 1)",
            navigation: "cubic-bezier(0.4, 0, 0.2, 1)",
          },
        }}
        toolbar={{
          buttons: [
            <button
              key="custom-close"
              className="cursor-pointer rounded-full p-2 text-gray-400 transition-colors duration-300 hover:bg-gray-100"
              style={{ position: "fixed", top: 20, left: 10, zIndex: 1000 }}
              onClick={handleClose}
            >
              <ArrowLeftIcon size={22} strokeWidth={1.5} />
            </button>,
          ],
        }}
      />
    </>
  );
}
