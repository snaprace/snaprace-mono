"use client";

import { useState, useMemo } from "react";
import { PlayCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { api } from "@/trpc/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getYouTubeId } from "@/utils/video";

interface FinishVideoSectionProps {
  eventId: string;
  /** Gun time in seconds for the runner (used in BibPageContent to seek to their finish) */
  runnerGunTimeSeconds?: number | null;
  /** Selected sub-event ID from LeaderboardSection */
  selectedSubEventId?: string | null;
}

export function FinishVideoSection({
  eventId,
  runnerGunTimeSeconds,
  selectedSubEventId,
}: FinishVideoSectionProps) {
  const t = useTranslations("video");
  const [hasError, setHasError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const resultsQuery = api.results.getEventResults.useQuery(
    { eventId },
    { enabled: Boolean(eventId) },
  );

  // Get video info for the selected sub-event (or first available if none selected)
  const currentVideo = useMemo(() => {
    if (!resultsQuery.data?.sets) return null;

    // If a sub-event is selected, check if it has video
    if (selectedSubEventId) {
      const selectedSet = resultsQuery.data.sets.find(
        (set) => set.subEventId === selectedSubEventId,
      );
      if (selectedSet?.finishlineVideoInfo?.status === "enabled") {
        return {
          subEventId: selectedSet.subEventId,
          label: selectedSet.label ?? selectedSet.eventSlug ?? "Overall",
          videoInfo: selectedSet.finishlineVideoInfo,
        };
      }
      // Selected sub-event has no video
      return null;
    }

    // No selection - find first sub-event with video
    const firstWithVideo = resultsQuery.data.sets.find(
      (set) => set.finishlineVideoInfo?.status === "enabled",
    );
    if (!firstWithVideo) return null;

    return {
      subEventId: firstWithVideo.subEventId,
      label: firstWithVideo.label ?? firstWithVideo.eventSlug ?? "Overall",
      videoInfo: firstWithVideo.finishlineVideoInfo!,
    };
  }, [resultsQuery.data, selectedSubEventId]);

  // Calculate start time for the video
  const startTime = useMemo(() => {
    if (!currentVideo || !runnerGunTimeSeconds) return 0;

    const {
      firstParticipantGunTime,
      firstParticipantVideoTime,
      rewindSeconds,
    } = currentVideo.videoInfo;

    // startTime = firstParticipantVideoTime + (runnerGunTime - firstParticipantGunTime) - rewindSeconds
    const calculatedTime =
      firstParticipantVideoTime +
      (runnerGunTimeSeconds - firstParticipantGunTime) -
      rewindSeconds;

    return Math.max(0, Math.floor(calculatedTime));
  }, [currentVideo, runnerGunTimeSeconds]);

  if (resultsQuery.isLoading) {
    return null;
  }

  // Don't render if no videos available
  if (!currentVideo) {
    return null;
  }

  const videoId = getYouTubeId(currentVideo.videoInfo.url);
  const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${startTime}&rel=0&modestbranding=1`;

  const handleLoad = () => {
    setIframeLoaded(true);
    setHasError(false);
  };

  const handleError = () => {
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setIframeLoaded(false);
  };

  return (
    <article className="border-border/60 bg-background/95 overflow-hidden rounded-2xl border shadow-sm">
      <Accordion type="single" collapsible defaultValue="finish-video">
        <AccordionItem value="finish-video" className="border-0">
          <AccordionTrigger className="px-3 hover:no-underline">
            <div className="flex items-center gap-1.5 md:gap-2">
              <PlayCircle className="text-primary h-4 w-4 md:h-5 md:w-5" />
              <h2 className="text-sm font-semibold md:text-lg">{t("finishVideo")}</h2>
            </div>
          </AccordionTrigger>
          <AccordionContent className="overflow-hidden pb-0">
            <div className="w-full max-w-full space-y-3 px-3 pb-4 md:px-6 md:pb-6">
              {/* Video Player */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                {hasError ? (
                  <VideoErrorDisplay onRetry={handleRetry} />
                ) : (
                  <div className="relative h-full w-full">
                    {/* Thumbnail placeholder */}
                    {!iframeLoaded && (
                      <div
                        className="absolute inset-0 rounded-lg bg-cover bg-center"
                        style={{
                          backgroundImage: currentVideo.videoInfo.thumbnail
                            ? `url(${currentVideo.videoInfo.thumbnail})`
                            : undefined,
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <PlayCircle className="h-16 w-16 text-white/80" />
                        </div>
                      </div>
                    )}

                    {/* YouTube iframe */}
                    <iframe
                      key={`${currentVideo.subEventId}-${startTime}`}
                      src={embedUrl}
                      className="h-full w-full rounded-lg"
                      onLoad={handleLoad}
                      onError={handleError}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ display: iframeLoaded ? "block" : "none" }}
                    />
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}

function VideoErrorDisplay({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("video");
  const tCommon = useTranslations("common");
  return (
    <div className="bg-muted flex aspect-video w-full flex-col items-center justify-center rounded-lg p-6 text-center">
      <PlayCircle className="text-muted-foreground mb-4 h-12 w-12" />
      <h3 className="text-foreground mb-2 font-semibold">
        {t("unableToLoad")}
      </h3>
      <p className="text-muted-foreground mb-4 text-sm">
        {t("tryAgainLater")}
      </p>
      <button
        onClick={onRetry}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        {tCommon("retry")}
      </button>
    </div>
  );
}
