"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePhotoGallery, type Photo } from "@/hooks/photos/usePhotoGallery";
import { useIsMobile } from "@/hooks/useMobile";
import { GalleryGrid, GalleryLightbox } from "@/components/photo-gallery";
import { useEventPhotographers } from "@/hooks/photographers/useEventPhotographers";
import { NoPhotosState } from "@/components/states/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ArrowDownToLine } from "lucide-react";
import { useBulkDownloader, MAX_SELECTION_LIMIT } from "@/hooks/useBulkDownloader";
import { toast } from "sonner";

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
  const t = useTranslations("photos");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toast");

  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [index, setIndex] = useState(-1);
  const [selectedPhotographer, setSelectedPhotographer] = useState<
    string | null
  >(null);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { downloadSelected, isDownloading, progress, total } =
    useBulkDownloader();

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

  // Selection Handlers
  const handleToggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      // Check if we've reached the limit
      if (next.size >= MAX_SELECTION_LIMIT) {
        toast.warning(tToast("selectionLimitReached", { max: MAX_SELECTION_LIMIT }));
        return;
      }
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDownloadSelected = async () => {
    const selectedPhotos = photos.filter((p) => selectedIds.has(p.pid));
    await downloadSelected(selectedPhotos);
    handleClearSelection();
  };

  const showEmptyState =
    photos.length === 0 && (!isLoading || !!overridePhotos);

  return (
    <>
      <div className="relative">
        {/* Floating Selection Bar (Desktop) */}
        {!isMobile && selectedIds.size > 0 && (
          <div className="fixed bottom-8 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 transform flex-col items-center gap-2 px-4 shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300">
             <div className="flex w-full items-center justify-between rounded-full border bg-zinc-900/90 p-2 pl-6 pr-2 text-white shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      {tCommon("selected", { count: selectedIds.size })}
                    </span>
                  </div>
                  <div className="h-4 w-px bg-zinc-700" />
                  <button 
                    onClick={handleClearSelection}
                    className="text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    {tCommon("clear")}
                  </button>
                </div>

                <Button 
                  size="sm" 
                  onClick={handleDownloadSelected} 
                  disabled={isDownloading}
                  className="rounded-full bg-white text-black hover:bg-gray-200"
                >
                  {isDownloading ? (
                   <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     {progress > 0 && total > 0 ? `${Math.round((progress/total)*100)}%` : tCommon("downloading")}
                   </>
                  ) : (
                    <>
                      <ArrowDownToLine className="h-4 w-4" />
                      {tCommon("download")}
                    </>
                  )}
                </Button>
             </div>
          </div>
        )}

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
                  <SelectValue placeholder={t("allPhotographers")} />
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all">
                  <span className="text-muted-foreground">{t("allPhotographers")}</span>
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

        {showEmptyState ? (
          <div className="mt-8">
            <NoPhotosState
              isAllPhotos={!bib && !overridePhotos}
              bibNumber={bib}
              onViewAllPhotos={
                bib || overridePhotos
                  ? () => router.push(`/events/${eventId}`)
                  : () => router.push("/events")
              }
              actionLabel={
                bib || overridePhotos
                  ? t("viewAllEventPhotos")
                  : t("viewAllEvents")
              }
            />
          </div>
        ) : (
          <GalleryGrid
            photos={photos}
            isLoading={isLoading && !overridePhotos}
            hasNextPage={hasNextPage && !overridePhotos}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            onPhotoClick={handlePhotoClick}
            isMobile={isMobile}
            selectedIds={selectedIds}
            onToggleSelection={handleToggleSelection}
            isSelectionMode={selectedIds.size > 0}
          />
        )}

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
      </div>
    </>
  );
}
