"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useMobile";

export function EventCardSkeleton() {
  return (
    <div className="text-center">
      {/* Event Image Skeleton */}
      <Skeleton className="relative mb-4 aspect-[4/3] w-full rounded-none" />

      {/* Event Info Skeleton */}
      <div className="space-y-2">
        <Skeleton className="mx-auto h-6 w-3/4" />
        <Skeleton className="mx-auto h-4 w-1/2" />
      </div>
    </div>
  );
}

export function EventsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="tablet:grid-cols-2 desktop:grid-cols-3 tablet:gap-8 desktop:gap-10 grid grid-cols-1 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function EventSelectSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

// Random heights for masonry skeleton effect
const getSkeletonHeight = (index: number) => {
  const heights = [200, 250, 300, 350, 280, 320, 240, 380, 260, 340];
  return heights[index % heights.length];
};

export function PhotoGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {/* Photo Count Skeleton */}
      <div className="mb-6 text-center">
        <Skeleton className="mx-auto h-4 w-32" />
      </div>

      {/* Main Photo Display Skeleton */}
      <div className="mx-auto max-w-4xl">
        <Skeleton className="relative mb-6 aspect-[4/3]" />

        {/* Photo Thumbnails Skeleton */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
          {Array.from({ length: count }).map((_, index) => (
            <Skeleton key={index} className="aspect-square" />
          ))}
        </div>
      </div>
    </>
  );
}

// New Masonry-style skeleton for photo grid
export function MasonryPhotoSkeleton({ count = 12 }: { count?: number }) {
  const isMobile = useIsMobile();
  return (
    <div className="mx-auto mt-4">
      <div
        className="masonry-skeleton-grid gap-2"
        style={{
          columnCount: isMobile ? 2 : 4,
          columnGap: "8px",
        }}
      >
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className="masonry-item mb-2 break-inside-avoid"
            style={{
              display: "inline-block",
              width: "100%",
            }}
          >
            <Skeleton
              className="w-full rounded-none"
              style={{
                height: `${getSkeletonHeight(index)}px`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventHeaderSkeleton() {
  return (
    <div className="mb-8 text-center">
      <Skeleton className="mx-auto mb-4 h-10 w-96" />
      <div className="flex justify-center gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
