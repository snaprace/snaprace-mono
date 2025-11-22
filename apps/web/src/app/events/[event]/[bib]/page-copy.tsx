// events/[event]/[bib].page.tsx
"use client";

import {
  useMemo,
  useRef,
  useCallback,
  useState,
  useEffect,
  startTransition,
} from "react";
import { useRouter, useParams, redirect } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { MasonryPhotoSkeleton } from "@/components/states/EventsSkeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { NoPhotosState } from "@/components/states/EmptyState";
import { useSelfieUpload } from "@/hooks/useSelfieUpload";
import { PhotoSingleView } from "@/components/PhotoSingleView";
import { InfinitePhotoGrid } from "@/components/InfinitePhotoGrid";
import { usePhotoState } from "@/hooks/usePhotoState";
import { usePhotoHandlers } from "@/hooks/usePhotoHandlers";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkDownloadButton } from "@/components/BulkDownloadButton";
import { PhotoSelectionControls } from "@/components/PhotoSelectionControls";
import { usePhotoSelection } from "@/hooks/usePhotoSelection";
import {
  useAnalyticsTracking,
  usePerformanceTracking,
} from "@/hooks/useAnalyticsTracking";
import {
  trackSelfieUpload,
  trackSelfieResults,
  trackSelfieConsentOpen,
  trackSelfieConsentDecision,
  trackSelfieStart,
  trackSelfieError,
  trackSelfieRetry,
} from "@/lib/analytics";
import { FacialRecognitionConsentModal } from "@/components/modals/FacialRecognitionConsentModal";
import {
  storeFacialRecognitionConsent,
  hasFacialRecognitionConsent,
} from "@/lib/consent-storage";
import { useOrganizationHelper } from "@/hooks/useOrganizationHelper";
import Link from "next/link";
import { RunnerSpotlight } from "./_components/RunnerSpotlight";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EventBibPage() {
  const router = useRouter();
  const photoRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  const org = useOrganizationHelper();
  const partners = org.partners;

  useAnalyticsTracking();
  usePerformanceTracking();

  const params = useParams();
  const event = params?.event as string;
  const bibParam = params?.bib as string;

  // 기존 .../null 링크에 대한 방어 코드
  if (bibParam === "null") {
    redirect(`/events/${event}`);
  }

  const bibNumber = bibParam;
  const isAllPhotos = false; // 항상 개별 뷰

  const eventQuery = api.events.getById.useQuery(
    { eventId: event },
    { enabled: !!event },
  );

  const faceSearchOnly = eventQuery.data?.display_mode === "PHOTOS_ONLY";
  const cloudfrontUrl = "https://images.snap-race.com/";

  const galleryQuery = api.galleries.getByBibNumber.useQuery(
    { eventId: event, bibNumber },
    { enabled: !!event && !!bibNumber && !faceSearchOnly },
  );

  const bibPhotosQueryV2 = api.photos.getByBibV2.useQuery(
    {
      organizer: eventQuery.data?.organizer_id ?? "",
      eventId: event,
      bibNumber,
    },
    { enabled: !!event && !!bibNumber && faceSearchOnly },
  );

  const photos = useMemo(() => {
    if (faceSearchOnly && bibPhotosQueryV2.data) {
      return (
        bibPhotosQueryV2.data.map((photo) =>
          encodeURI(cloudfrontUrl + photo.s3Path),
        ) ?? []
      );
    }

    if (galleryQuery.data) {
      const data = galleryQuery.data;
      const selfiePhotos = data.selfie_matched_photos ?? [];
      const bibPhotos = data.bib_matched_photos ?? [];
      return [...selfiePhotos, ...bibPhotos];
    }

    return [];
  }, [galleryQuery.data, faceSearchOnly, bibPhotosQueryV2.data]);

  const {
    searchBib,
    setSearchBib,
    columnCount,
    isMobile,
    isModalOpen,
    currentPhotoIndex,
    setClickedPhotoRect,
  } = usePhotoState(photos);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const {
    selectedPhotos,
    selectedCount,
    isSelectionMode,
    togglePhotoSelection,
    selectAll,
    clearSelection,
    toggleSelectionMode,
    getSelectedPhotoUrls,
  } = usePhotoSelection(photos);

  const handlePhotoSelect = useCallback(
    (index: number) => {
      togglePhotoSelection(index);
    },
    [togglePhotoSelection],
  );

  const { handlePhotoClick, handlePhotoIndexChange, handleCloseSingleView } =
    usePhotoHandlers({
      event,
      bibParam,
      isMobile,
      photoRefs,
      setClickedPhotoRect,
      photos,
    });

  const {
    isProcessed,
    isProcessing,
    uploadSelfie,
    uploadedFile,
    reset,
    response,
    hasError: selfieUploadError,
  } = useSelfieUpload({
    eventId: event,
    bibNumber,
    organizerId: eventQuery.data?.organizer_id ?? "",
    existingPhotos: photos,
    faceSearchOnly: eventQuery.data?.display_mode === "PHOTOS_ONLY",
  });

  const isUploading =
    isProcessing || galleryQuery.isLoading || galleryQuery.isFetching;

  const handleLabelClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (!bibNumber || isUploading) return;

    if (hasFacialRecognitionConsent(event)) {
      fileInputRef.current?.click();
    } else {
      trackSelfieConsentOpen(event, bibNumber);
      setIsConsentModalOpen(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        trackSelfieStart(
          event,
          bibNumber,
          file.type,
          Math.round(file.size / 1024),
        );

        const startedAt = performance.now();

        const uploadResult = await uploadSelfie(file);

        let matchedCount = 0;
        if (faceSearchOnly) {
          matchedCount = uploadResult.matchedPhotos.length;
        } else {
          const { data } = await galleryQuery.refetch();
          matchedCount = data?.selfie_matched_photos?.length ?? 0;
        }

        const latencyMs = Math.round(performance.now() - startedAt);
        trackSelfieUpload({
          event_id: event,
          bib_number: bibNumber,
          success: true,
          matched_photos: matchedCount,
          latency_ms: latencyMs,
          file_type: file.type,
          file_size_kb: Math.round(file.size / 1024),
        });

        trackSelfieResults(event, bibNumber, matchedCount, {
          latency_ms: latencyMs,
        });
      } catch (error) {
        console.error("Selfie upload error:", error);
        trackSelfieUpload({
          event_id: event,
          bib_number: bibNumber,
          success: false,
        });
        trackSelfieError(
          event,
          bibNumber,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConsentAgree = () => {
    storeFacialRecognitionConsent(true, event);
    setIsConsentModalOpen(false);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
    trackSelfieConsentDecision(event, bibNumber, true);
  };

  const handleConsentDeny = () => {
    setIsConsentModalOpen(false);
    trackSelfieConsentDecision(event, bibNumber, false);
  };

  const resetAndPromptSelfieUpload = useCallback(() => {
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
    trackSelfieRetry(event, bibNumber);
  }, [reset, event, bibNumber]);

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchBib.trim()) {
      setIsSearchModalOpen(false);
      router.push(`/events/${event}/${searchBib.trim()}`);
    }
  };

  const selfieMatchedSet = useMemo(() => {
    if (faceSearchOnly && response?.selfie_matched_photos) {
      return new Set(response.selfie_matched_photos);
    }
    if (galleryQuery.data?.selfie_matched_photos?.length) {
      return new Set(galleryQuery.data.selfie_matched_photos);
    }
    return new Set<string>();
  }, [
    galleryQuery.data?.selfie_matched_photos,
    faceSearchOnly,
    response?.selfie_matched_photos,
  ]);

  const isLoading =
    eventQuery.isLoading ||
    galleryQuery.isLoading ||
    bibPhotosQueryV2.isLoading;

  const selfieMatchedCount = faceSearchOnly
    ? (response?.selfie_matched_photos?.length ?? 0)
    : Array.isArray(galleryQuery.data?.selfie_matched_photos)
      ? galleryQuery.data.selfie_matched_photos.length
      : 0;

  const selfieEnhanced = faceSearchOnly
    ? (response?.selfie_matched_photos?.length ?? 0) > 0
    : typeof galleryQuery.data?.selfie_enhanced === "boolean"
      ? galleryQuery.data.selfie_enhanced
      : false;

  const displayedPhotos = useMemo(() => {
    if (isProcessing || galleryQuery.isFetching) {
      return photos;
    }

    if (faceSearchOnly && response?.selfie_matched_photos?.length) {
      return [...(response.selfie_matched_photos ?? []), ...photos];
    }
    if (faceSearchOnly && selfieEnhanced) {
      return [...(response?.selfie_matched_photos ?? []), ...photos];
    }
    return photos;
  }, [
    faceSearchOnly,
    response?.selfie_matched_photos,
    selfieEnhanced,
    photos,
    isProcessing,
    galleryQuery.isFetching,
  ]);

  const displayedPhotoCount = displayedPhotos.length;

  const hasError = eventQuery.error || galleryQuery.error;

  if (hasError) {
    return <ErrorState message="Failed to load event data" />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur md:h-18">
        <div className="container mx-auto px-1 md:px-4">
          <div className="flex items-center">
            <div className="w-10 md:w-auto">
              <Button
                variant="ghost"
                onClick={() => router.push(`/events/${event}`)}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-2 w-2 md:h-4 md:w-4" />
                <span className="hidden md:block">Back to Event</span>
              </Button>
            </div>

            <div className="flex-1 text-center">
              {isLoading ? (
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                  <Skeleton className="h-5 w-48 md:h-6 md:w-70" />
                  <Skeleton className="h-3 w-40 md:w-56" />
                </div>
              ) : (
                <div>
                  <h1 className="text-sm font-semibold md:text-xl">
                    {eventQuery.data?.name}
                  </h1>
                  <p className="text-muted-foreground text-xs md:text-sm">
                    Bib #{bibNumber}{" "}
                    {galleryQuery.data?.runner_name && (
                      <>• {galleryQuery.data.runner_name}</>
                    )}
                    {" • "}
                    {displayedPhotoCount} photo
                    {displayedPhotoCount !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </div>

            <div className="w-10 md:w-auto">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsSearchModalOpen(true)}
                aria-label="Open search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <form
                onSubmit={handleBibSearch}
                className="hidden items-center gap-2 md:flex"
              >
                <Input
                  type="text"
                  placeholder="Enter bib"
                  value={searchBib}
                  onChange={(e) => setSearchBib(e.target.value)}
                  className="w-[100px] border border-gray-200"
                />
                <Button type="submit" size="sm" disabled={!searchBib.trim()}>
                  <Search />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <RunnerSpotlight
        eventId={event}
        eventName={eventQuery.data?.name ?? ""}
        organizationId={eventQuery.data?.organizer_id ?? ""}
        event={eventQuery.data ?? null}
        bibNumber={bibNumber}
        isAllPhotos={isAllPhotos}
        isUploading={isUploading}
        uploadedFile={uploadedFile}
        selfieEnhanced={selfieEnhanced}
        selfieMatchedCount={selfieMatchedCount}
        isProcessed={isProcessed}
        hasError={selfieUploadError}
        inputRef={fileInputRef}
        onLabelClick={handleLabelClick}
        onFileChange={handleFileUpload}
        onRetryUpload={resetAndPromptSelfieUpload}
      />

      {partners.length > 0 && (
        <div className="bg-background/60 top-16 z-10 w-full">
          <div className="container mx-auto flex items-center justify-center gap-8 py-3 md:gap-12">
            {partners.map((partner) => (
              <Link
                key={partner.id}
                href={partner.website_url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative h-8 w-28 md:h-10 md:w-36"
              >
                <Image
                  src={org.getPartnerImageUrl(partner)}
                  alt={partner.name}
                  fill
                  className="object-contain opacity-80 transition-all duration-200 group-hover:scale-105 group-hover:opacity-100"
                  sizes="(max-width: 768px) 112px, 144px"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Photo Selection and Bulk Download Controls */}
      {!isMobile && photos.length > 0 && (
        <div className="container mx-auto mt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-xs">
              {isSelectionMode && selectedCount > 0 ? (
                selectedCount >= 10 ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                    Selected photos will be downloaded as ZIP
                  </span>
                ) : (
                  <span>Selected photos will be downloaded individually</span>
                )
              ) : photos.length >= 10 ? (
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                  All photos will be downloaded as ZIP
                </span>
              ) : (
                <span>All photos will be downloaded individually</span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <PhotoSelectionControls
                isSelectionMode={isSelectionMode}
                selectedCount={selectedCount}
                totalCount={photos.length}
                onToggleSelectionMode={toggleSelectionMode}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
              />

              <BulkDownloadButton
                photos={photos}
                selectedPhotos={getSelectedPhotoUrls}
                event={eventQuery.data?.name || ""}
                bibNumber={bibNumber}
                isSelectionMode={isSelectionMode}
              />
            </div>
          </div>
        </div>
      )}

      {/* Photo Grid - Only Individual Photos */}
      <div className="mt-4 w-full px-[4px] sm:px-[20px]">
        {isLoading ? (
          <MasonryPhotoSkeleton />
        ) : displayedPhotos.length > 0 ? (
          <InfinitePhotoGrid
            photos={displayedPhotos}
            columnCount={columnCount}
            isMobile={isMobile}
            onPhotoClick={handlePhotoClick}
            photoRefs={photoRefs}
            selfieMatchedSet={selfieMatchedSet}
            event={event}
            bibNumber={bibNumber}
            organizerId={eventQuery.data?.organizer_id}
            isSelectionMode={isSelectionMode}
            selectedPhotos={selectedPhotos}
            onPhotoSelect={handlePhotoSelect}
          />
        ) : (
          <NoPhotosState
            isAllPhotos={false}
            bibNumber={bibNumber}
            onViewAllPhotos={() => router.push(`/events/${event}`)}
          />
        )}
      </div>

      <section className="bg-muted/20 mt-auto border-t px-4 py-4">
        <div className="text-muted-foreground text-center text-xs">
          <p>© {new Date().getFullYear()} SnapRace. All rights reserved.</p>
        </div>
      </section>

      <PhotoSingleView
        isOpen={isModalOpen}
        onClose={handleCloseSingleView}
        photos={displayedPhotos}
        currentIndex={Math.min(currentPhotoIndex, displayedPhotos.length - 1)}
        onIndexChange={handlePhotoIndexChange}
        event={event}
        bibNumber={bibNumber}
        organizerId={eventQuery.data?.organizer_id}
        onPhotoChange={(index) => {
          const photoElement = photoRefs.current.get(index);
          if (photoElement) {
            setClickedPhotoRect(photoElement.getBoundingClientRect());
          }
        }}
        selfieMatchedSet={selfieMatchedSet}
      />

      <FacialRecognitionConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onAgree={handleConsentAgree}
        onDeny={handleConsentDeny}
        eventName={eventQuery.data?.name}
      />

      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Search by Bib Number</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBibSearch} className="space-y-4">
            <Input
              type="text"
              placeholder="Enter bib number"
              value={searchBib}
              onChange={(e) => setSearchBib(e.target.value)}
              className="bg-background border-border w-full text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={!searchBib.trim()}
              >
                <Search className="h-5 w-5" />
                Search
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
