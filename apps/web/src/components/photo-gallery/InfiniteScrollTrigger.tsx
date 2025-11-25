import React, { useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

interface InfiniteScrollTriggerProps {
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isMobile: boolean;
}

export function InfiniteScrollTrigger({
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isMobile,
}: InfiniteScrollTriggerProps) {
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
}

