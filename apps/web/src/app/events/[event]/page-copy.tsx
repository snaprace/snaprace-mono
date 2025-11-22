// events/[event]/page.tsx
"use client";

import {
  useMemo,
  useRef,
  useState,
  useEffect,
  startTransition,
  use,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Camera, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { MasonryPhotoSkeleton } from "@/components/states/EventsSkeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState, NoPhotosState } from "@/components/states/EmptyState";
import { useSelfieUpload } from "@/hooks/useSelfieUpload";
import { PhotoSingleView } from "@/components/PhotoSingleView";
import { InfinitePhotoGrid } from "@/components/InfinitePhotoGrid";
import { usePhotoState } from "@/hooks/usePhotoState";
import { usePhotoHandlers } from "@/hooks/usePhotoHandlers";
import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventInsightsPanel } from "./_components/EventInsightsPanel";
import { LeaderboardSection } from "./_components/LeaderboardSection";

// 사진 URL에서 작가명 추출
function extractPhotographer(photoUrl: string): string | null {
  // URL 패턴: .../raw/@photographer-number.jpg
  const regex = /@([^-]+)-\d+\.(jpg|jpeg|png)/i;
  const match = regex.exec(photoUrl);
  return match?.[1] ?? null;
}

// 작가별로 사진 그룹화
function groupPhotosByPhotographer(photos: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};

  photos.forEach((photo) => {
    const photographer = extractPhotographer(photo);
    if (photographer) {
      if (!grouped[photographer]) {
        grouped[photographer] = [];
      }
      grouped[photographer].push(photo);
    }
  });

  return grouped;
}

interface EventAllPhotosPageProps {
  params: Promise<{ event: string }>;
}

export default function EventAllPhotosPage({
  params,
}: EventAllPhotosPageProps) {
  const { event } = use(params);

  const router = useRouter();

  const photoRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [selectedPhotographer, setSelectedPhotographer] =
    useState<string>("all");

  const org = useOrganizationHelper();
  const partners = org.partners;

  useAnalyticsTracking();
  usePerformanceTracking();

  // const params = useParams();
  // const event = params?.event as string;
  // 전체 사진 페이지이므로 bibNumber는 없음
  const bibNumber = "";
  const isAllPhotos = true;

  const eventQuery = api.events.getById.useQuery(
    { eventId: event },
    { enabled: !!event },
  );

  if (!eventQuery.data) {
    return (
      <EmptyState
        icon={<Camera className="text-muted-foreground h-10 w-10" />}
        title="Event Not Found"
        message="The event you are looking for does not exist. Please check the event URL and try again."
        action={{
          label: "Back to Events",
          onClick: () => router.push("/events"),
        }}
      />
    );
  }

  const faceSearchOnly = eventQuery.data?.display_mode === "PHOTOS_ONLY";
  const cloudfrontUrl = "https://images.snap-race.com/";

  // 전체 사진 쿼리만 유지
  // const allPhotosQuery = api.photos.getByEventId.useQuery(
  //   { eventId: event },
  //   { enabled: !!event && !faceSearchOnly },
  // );

  // const allPhotosQueryV2 = api.photos.getByEventV2.useQuery(
  //   { organizer: eventQuery.data?.organizer_id ?? "", eventId: event },
  //   {
  //     enabled: !!eventQuery.data?.organizer_id && !!event && faceSearchOnly,
  //   },
  // );

  // const photos = useMemo(() => {
  //   if (faceSearchOnly && allPhotosQueryV2.data) {
  //     return (
  //       allPhotosQueryV2.data?.map((photo) =>
  //         encodeURI(cloudfrontUrl + photo.s3Path),
  //       ) ?? []
  //     );
  //   }

  //   if (allPhotosQuery.data) {
  //     const allPhotos: string[] = [];
  //     if (allPhotosQuery.data) {
  //       allPhotosQuery.data.forEach((photo) => {
  //         allPhotos.push(photo.imageUrl);
  //       });
  //     }
  //     return allPhotos;
  //   }

  //   return [];
  // }, [allPhotosQuery.data, faceSearchOnly, allPhotosQueryV2.data]);

  // const {
  //   searchBib,
  //   setSearchBib,
  //   columnCount,
  //   isMobile,
  //   isModalOpen,
  //   currentPhotoIndex,
  //   setClickedPhotoRect,
  // } = usePhotoState(photos);

  // const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // 선택 기능은 전체 페이지에서는 지원하지 않거나 필요 시 추가 (기존 로직상 !isAllPhotos일 때만 표시되었으므로 제거)
  // 단, 로직 자체는 훅을 사용하더라도 UI 렌더링을 안 하면 됨.

  // const { handlePhotoClick, handlePhotoIndexChange, handleCloseSingleView } =
  //   usePhotoHandlers({
  //     event,
  //     bibParam: "null",
  //     isMobile,
  //     photoRefs,
  //     setClickedPhotoRect,
  //     photos,
  //   });

  // const {
  //   isProcessed,
  //   isProcessing,
  //   uploadSelfie,
  //   uploadedFile,
  //   reset,
  //   response,
  //   hasError: selfieUploadError,
  // } = useSelfieUpload({
  //   eventId: event,
  //   bibNumber,
  //   organizerId: eventQuery.data?.organizer_id ?? "",
  //   existingPhotos: undefined, // 전체 사진일 때는 undefined
  //   faceSearchOnly: eventQuery.data?.display_mode === "PHOTOS_ONLY",
  // });

  // const isUploading = isProcessing; // galleryQuery가 없으므로 isProcessing만 체크

  // const handleLabelClick = (e: React.MouseEvent) => {
  //   e.preventDefault();

  //   if (!faceSearchOnly || isUploading) return; // bibNumber가 없으므로 faceSearchOnly일 때만

  //   if (hasFacialRecognitionConsent(event)) {
  //     fileInputRef.current?.click();
  //   } else {
  //     trackSelfieConsentOpen(event, bibNumber);
  //     setIsConsentModalOpen(true);
  //   }
  // };

  // const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   if (file) {
  //     try {
  //       trackSelfieStart(
  //         event,
  //         bibNumber,
  //         file.type,
  //         Math.round(file.size / 1024),
  //       );

  //       const startedAt = performance.now();

  //       const uploadResult = await uploadSelfie(file);
  //       const matchedCount = uploadResult.matchedPhotos.length;

  //       const latencyMs = Math.round(performance.now() - startedAt);
  //       trackSelfieUpload({
  //         event_id: event,
  //         bib_number: bibNumber,
  //         success: true,
  //         matched_photos: matchedCount,
  //         latency_ms: latencyMs,
  //         file_type: file.type,
  //         file_size_kb: Math.round(file.size / 1024),
  //       });

  //       trackSelfieResults(event, bibNumber, matchedCount, {
  //         latency_ms: latencyMs,
  //       });
  //     } catch (error) {
  //       console.error("Selfie upload error:", error);
  //       trackSelfieUpload({
  //         event_id: event,
  //         bib_number: bibNumber,
  //         success: false,
  //       });
  //       trackSelfieError(
  //         event,
  //         bibNumber,
  //         error instanceof Error ? error.message : String(error),
  //       );
  //     }
  //   }
  //   if (fileInputRef.current) {
  //     fileInputRef.current.value = "";
  //   }
  // };

  // const handleConsentAgree = () => {
  //   storeFacialRecognitionConsent(true, event);
  //   setIsConsentModalOpen(false);
  //   setTimeout(() => {
  //     fileInputRef.current?.click();
  //   }, 100);
  //   trackSelfieConsentDecision(event, bibNumber, true);
  // };

  // const handleConsentDeny = () => {
  //   setIsConsentModalOpen(false);
  //   trackSelfieConsentDecision(event, bibNumber, false);
  // };

  // const resetAndPromptSelfieUpload = () => {
  //   reset();
  //   if (fileInputRef.current) {
  //     fileInputRef.current.value = "";
  //     fileInputRef.current.click();
  //   }
  //   trackSelfieRetry(event, bibNumber);
  // };

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // if (searchBib.trim()) {
    //   setIsSearchModalOpen(false);
    //   router.push(`/events/${event}/${searchBib.trim()}`);
    // }
  };

  // const selfieMatchedSet = useMemo(() => {
  //   if (faceSearchOnly && response?.selfie_matched_photos) {
  //     return new Set(response.selfie_matched_photos);
  //   }
  //   return new Set<string>();
  // }, [faceSearchOnly, response?.selfie_matched_photos]);

  const isLoading = eventQuery.isLoading;

  // const selfieMatchedCount = response?.selfie_matched_photos?.length ?? 0;
  // const selfieEnhanced = (response?.selfie_matched_photos?.length ?? 0) > 0;

  // const hasSelfieResults = selfieEnhanced || selfieMatchedCount > 0;

  // useEffect(() => {
  //   if (hasSelfieResults && selectedPhotographer !== "all") {
  //     setSelectedPhotographer("all");
  //   }
  // }, [hasSelfieResults, selectedPhotographer]);

  // const displayedPhotos = useMemo(() => {
  //   if (isProcessing) {
  //     return photos;
  //   }

  //   if (faceSearchOnly && response?.selfie_matched_photos?.length) {
  //     return response.selfie_matched_photos;
  //   }

  //   // 일반 모드에서 셀카 검색 결과가 있어도 전체 페이지에서는 어떻게 보여줄지?
  //   // 기존 코드: faceSearchOnly가 아니어도 전체 뷰일때는 처리 없음 (기존 코드는 bib뷰랑 섞여서 복잡했음)
  //   // 여기서는 faceSearchOnly일때만 처리

  //   return photos;
  // }, [faceSearchOnly, response?.selfie_matched_photos, photos, isProcessing]);

  // const photosByPhotographer = useMemo(() => {
  //   return groupPhotosByPhotographer(displayedPhotos);
  // }, [displayedPhotos]);

  // const photographers = useMemo(() => {
  //   if (!photosByPhotographer) return [];
  //   return Object.entries(photosByPhotographer)
  //     .map(([name, photos]) => ({ name, count: photos.length }))
  //     .sort((a, b) => b.count - a.count);
  // }, [photosByPhotographer]);

  // const filteredPhotos = useMemo(() => {
  //   if (selectedPhotographer === "all" || !photosByPhotographer) {
  //     return displayedPhotos;
  //   }
  //   return photosByPhotographer[selectedPhotographer] || [];
  // }, [selectedPhotographer, photosByPhotographer, displayedPhotos]);

  // const displayedPhotoCount = filteredPhotos.length;

  // const hasError = eventQuery.error || allPhotosQuery.error;

  // if (hasError) {
  //   return <ErrorState message="Failed to load event data" />;
  // }

  const insightSections = [
    <LeaderboardSection
      key="leaderboard"
      eventId={event}
      organizationId={eventQuery.data?.organizer_id}
    />,
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur md:h-18">
        <div className="container mx-auto px-1 md:px-4">
          <div className="flex items-center">
            <div className="w-10 md:w-auto">
              <Button
                variant="ghost"
                // onClick={() => router.push("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-2 w-2 md:h-4 md:w-4" />
                <span className="hidden md:block">Back</span>
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
                  {/* <p className="text-muted-foreground text-xs md:text-sm">
                    All Photos
                    {" • "}
                    {displayedPhotoCount} photo
                    {displayedPhotoCount !== 1 ? "s" : ""}
                  </p> */}
                </div>
              )}
            </div>

            <div className="w-10 md:w-auto">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                // onClick={() => setIsSearchModalOpen(true)}
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
                  // value={searchBib}
                  // onChange={(e) => setSearchBib(e.target.value)}
                  className="w-[100px] border border-gray-200"
                />
                {/* <Button type="submit" size="sm" disabled={!searchBib.trim()}>
                  <Search />
                </Button> */}
              </form>
            </div>
          </div>
        </div>
      </div>

      <EventInsightsPanel
        // title="Race Insights"
        // description="Track leading finishers and divisions as results stream in."
        sections={insightSections}
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

      {/* Photographer Filter - Only for All Photos */}
      {/* {photographers.length > 1 && !hasSelfieResults && (
        <div className="container mx-auto mt-4 px-[4px] md:mt-6 md:px-4">
          <div className="flex items-center gap-2">
            <Select
              value={selectedPhotographer}
              onValueChange={(value) => {
                startTransition(() => {
                  setSelectedPhotographer(value);
                });
              }}
            >
              <SelectTrigger className="bg-background border-border w-full md:w-[280px]">
                <SelectValue placeholder="Select photographer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      All Photographers
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({displayedPhotos.length})
                    </span>
                  </div>
                </SelectItem>
                {photographers.map((photographer) => (
                  <SelectItem key={photographer.name} value={photographer.name}>
                    <div className="flex items-center justify-between gap-3">
                      <span>@{photographer.name}</span>
                      <span className="text-muted-foreground text-xs">
                        ({photographer.count})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedPhotographer !== "all" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setSelectedPhotographer("all");
                  });
                }}
                className="text-muted-foreground text-xs md:text-sm"
              >
                <span className="md:hidden">Clear</span>
                <span className="hidden md:inline">Clear filter</span>
              </Button>
            )}
          </div>
        </div>
      )} */}

      {/* Full-width Photo Grid */}
      {/* <div className="mt-4 w-full px-[4px] sm:px-[20px]">
        {isLoading ? (
          <MasonryPhotoSkeleton />
        ) : filteredPhotos.length > 0 ? (
          <InfinitePhotoGrid
            photos={filteredPhotos}
            columnCount={columnCount}
            isMobile={isMobile}
            onPhotoClick={handlePhotoClick}
            photoRefs={photoRefs}
            selfieMatchedSet={selfieMatchedSet}
            event={event}
            bibNumber={bibNumber}
            organizerId={eventQuery.data?.organizer_id}
            isSelectionMode={false}
            selectedPhotos={new Set()}
            onPhotoSelect={() => {}}
          />
        ) : (
          <NoPhotosState
            isAllPhotos={isAllPhotos}
            bibNumber={bibNumber}
            onViewAllPhotos={() => {}}
          />
        )}
      </div> */}

      {/* <section className="bg-muted/20 mt-auto border-t px-4 py-4">
        <div className="text-muted-foreground text-center text-xs">
          <p>© {new Date().getFullYear()} SnapRace. All rights reserved.</p>
        </div>
      </section> */}

      {/* <PhotoSingleView
        isOpen={isModalOpen}
        onClose={handleCloseSingleView}
        photos={filteredPhotos}
        currentIndex={Math.min(currentPhotoIndex, filteredPhotos.length - 1)}
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
      /> */}

      {/* <FacialRecognitionConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onAgree={handleConsentAgree}
        onDeny={handleConsentDeny}
        eventName={eventQuery.data?.name}
      /> */}

      {/* <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
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
      </Dialog> */}
    </div>
  );
}
