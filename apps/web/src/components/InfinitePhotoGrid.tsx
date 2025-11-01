"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { MasonryGrid } from "@egjs/grid";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Share2, Download, Check } from "lucide-react";
import { ShareDialog } from "@/components/ShareDialog";
import { generatePhotoFilename } from "@/utils/photo";
import { createDownloadClickHandler } from "@/utils/downloadClickHandler";

interface InfinitePhotoGridProps {
  photos: string[];
  columnCount: number;
  isMobile: boolean;
  onPhotoClick: (index: number) => void;
  photoRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
  selfieMatchedSet?: Set<string>;
  event?: string;
  bibNumber?: string;
  organizerId?: string;
  isSelectionMode?: boolean;
  selectedPhotos?: Set<number>;
  onPhotoSelect?: (index: number) => void;
}

export function InfinitePhotoGrid({
  photos,
  columnCount,
  isMobile,
  onPhotoClick,
  photoRefs,
  selfieMatchedSet,
  event,
  bibNumber,
  organizerId,
  isSelectionMode = false,
  selectedPhotos = new Set(),
  onPhotoSelect,
}: InfinitePhotoGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<MasonryGrid | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number>(0);

  const [isGridReady, setIsGridReady] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Magic numbers named for clarity
  const DEFAULT_GAP_PX = 6;
  const MOBILE_TWO_COLUMN_GAP_PX = 4;
  const gridGap =
    isMobile && columnCount === 2 ? MOBILE_TWO_COLUMN_GAP_PX : DEFAULT_GAP_PX;

  // Tune batch sizes
  const MIN_INITIAL_BATCH = 40;
  const PER_COLUMN_INITIAL_ROWS = 12; // rows per column initially
  const LOAD_MORE_BATCH = 60;

  // Track container width
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener("resize", updateContainerWidth);
    return () => window.removeEventListener("resize", updateContainerWidth);
  }, []);

  // Initialize MasonryGrid once per layout changes
  useEffect(() => {
    if (!containerRef.current) return;

    const grid = new MasonryGrid(containerRef.current, {
      gap: gridGap,
      observeChildren: true,
      useResizeObserver: true,
      column: columnCount,
      align: "stretch",
    });

    gridRef.current = grid;
    setIsGridReady(true);

    return () => {
      grid.destroy();
      gridRef.current = null;
    };
  }, [columnCount, gridGap]);

  // Debounced relayout helper for fast UI changes
  const scheduleRelayout = useCallback(() => {
    if (!gridRef.current) return;
    cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      const grid = gridRef.current;
      if (!grid) return;
      grid.syncElements();
      grid.renderItems();
    });
  }, []);

  // Re-render grid when items change
  useEffect(() => {
    if (!isGridReady) return;
    scheduleRelayout();
  }, [visibleCount, isGridReady, photos, scheduleRelayout]);

  // Observe container size for rapid resizes
  useEffect(() => {
    if (!containerRef.current || !isGridReady) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setContainerWidth(el.offsetWidth);
      scheduleRelayout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isGridReady, scheduleRelayout]);

  // Compute column width
  const columnWidth = useMemo(() => {
    if (containerWidth === 0) return 300;
    const gaps = (columnCount - 1) * gridGap;
    const padding = 0;
    return Math.floor((containerWidth - gaps - padding) / columnCount);
  }, [containerWidth, columnCount, gridGap]);

  // Reset visible count when photos or layout changes
  useEffect(() => {
    const initialByColumns = columnCount * PER_COLUMN_INITIAL_ROWS;
    const initial = Math.max(MIN_INITIAL_BATCH, initialByColumns);
    setVisibleCount(Math.min(initial, photos.length));
  }, [photos.length, columnCount]);

  // IntersectionObserver to load more
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          setVisibleCount((prev) => {
            const next = Math.min(prev + LOAD_MORE_BATCH, photos.length);
            return next;
          });
          // allow subsequent loads in next tick
          setTimeout(() => setIsLoadingMore(false), 0);
        }
      },
      { root: null, rootMargin: "400px 0px", threshold: 0 },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [photos.length, isLoadingMore]);

  const setPhotoRef = useCallback(
    (el: HTMLDivElement | null, index: number) => {
      if (el) {
        photoRefs.current.set(index, el);
      } else {
        photoRefs.current.delete(index);
      }
    },
    [photoRefs],
  );

  // Render only visible photos, but keep global index
  const items = useMemo(() => {
    return photos.slice(0, visibleCount).map((url, i) => ({ url, index: i }));
  }, [photos, visibleCount]);

  return (
    <>
      <div
        ref={containerRef}
        className="grid-container w-full"
        style={{ minHeight: "100vh" }}
      >
        {items.map(({ url, index }) => (
          <div
            key={index}
            ref={(el) => setPhotoRef(el, index)}
            className="cursor-pointer"
            onClick={() => {
              if (isSelectionMode && onPhotoSelect) {
                onPhotoSelect(index);
              } else {
                onPhotoClick(index);
              }
            }}
          >
            <div
              className="group relative overflow-hidden shadow-md transition-all duration-200 hover:shadow-2xl"
              style={{ width: `${columnWidth}px` }}
            >
              {/* Selection Checkbox for PC */}
              {!isMobile && isSelectionMode && (
                <div className="absolute top-2 right-2 z-10">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                      selectedPhotos.has(index)
                        ? "bg-blue-500 text-white"
                        : "border-2 border-gray-300 bg-white/90 hover:border-blue-500"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPhotoSelect) {
                        onPhotoSelect(index);
                      }
                    }}
                  >
                    {selectedPhotos.has(index) && <Check className="h-5 w-5" />}
                  </div>
                </div>
              )}
              {selfieMatchedSet?.has(url) && (
                <div className="absolute top-2 left-2 z-20">
                  <Badge variant="default">
                    <span className="text-xs">Selfie</span>
                  </Badge>
                </div>
              )}
              <div
                className={`absolute right-0 bottom-0 left-0 z-10 ${isSelectionMode ? "hidden" : "hidden"} translate-y-2 items-center justify-end bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:flex`}
              >
                {/* Share & Download Icons - Right Side */}
                <div className="flex items-center gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <ShareDialog
                      photoUrl={url}
                      filename={generatePhotoFilename(
                        event || "",
                        bibNumber,
                        index,
                      )}
                      isMobile={isMobile}
                      shareOptions={{ organizerId, eventId: event, bibNumber }}
                    >
                      <button
                        className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center bg-transparent text-white hover:scale-110"
                        title="Share"
                      >
                        <Share2 size={20} />
                      </button>
                    </ShareDialog>
                  </div>
                  <button
                    onClick={createDownloadClickHandler({
                      url,
                      event,
                      bibNumber,
                      index,
                      isMobile,
                    })}
                    className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center bg-transparent text-white hover:scale-110"
                    title="Download"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>

              <Image
                src={url}
                alt={`Photo ${index + 1}`}
                width={columnWidth}
                height={300}
                className="h-auto w-full object-cover"
                sizes="(min-width: 1550px) 20vw, (min-width: 1050px) 25vw, (min-width: 850px) 33vw, 50vw"
                priority={index < columnCount}
                loading={index < columnCount ? "eager" : "lazy"}
                onLoad={scheduleRelayout}
              />

              {/* for debugging */}
              {/* <div className="text-center text-xs text-gray-500">
                {index + 1} / {photos.length}
              </div> */}
            </div>
          </div>
        ))}
      </div>
      {/* Sentinel */}
      <div ref={sentinelRef} className="h-6" />
    </>
  );
}
