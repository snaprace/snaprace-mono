"use client";

import { useState, useMemo } from "react";
import { PlayCircle } from "lucide-react";

import type { Event } from "@/server/api/routers/events";
import type { BibDetailResponse } from "@/server/services/timing-service";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getRowNumber } from "@/utils/video";

import { YouTubePlayer } from "./YouTubePlayer";
import { VideoError } from "./VideoError";

// TODO: Define strict type for finishline_video_info in Supabase schema
interface FinishVideoInfo {
  url: string;
  status: string;
  thumbnail?: string;
  rewindSeconds: number;
  firstParticipantGunTime: number;
  firstParticipantVideoTime: number;
}

interface FinishVideoProps {
  event: Event;
  timingDetail: BibDetailResponse | null;
  isAllPhotos: boolean;
}

/**
 * 비디오 시작 시간을 계산하는 함수
 * @param videoInfo 비디오 정보
 * @param timingDetail 참가자 타이밍 정보
 * @param isAllPhotos 모든 사진 보기 모드 여부
 * @returns 비디오 시작 시간 (초)
 */
function calculateVideoStartTime(
  videoInfo: FinishVideoInfo,
  timingDetail: BibDetailResponse | null,
  isAllPhotos: boolean,
): number {
  // 모든 사진 보기 모드이거나 타이밍 정보가 없으면 0초부터 시작
  if (isAllPhotos || !timingDetail) {
    return 0;
  }

  const participantGunTime = getRowNumber(timingDetail.row, "clock_time");
  const { firstParticipantGunTime, firstParticipantVideoTime, rewindSeconds } =
    videoInfo;

  // gunTime이 없으면 0초부터 시작
  if (participantGunTime === undefined || participantGunTime === 0) {
    return 0;
  }

  // 시작 시간 계산: 첫 참가자 비디오 시간 + (참가자 GunTime - 첫 참가자 GunTime) - rewindSeconds
  const startTime =
    firstParticipantVideoTime +
    (participantGunTime - firstParticipantGunTime) -
    rewindSeconds;

  // 음수 방지
  return Math.max(0, startTime);
}

export function FinishVideo({
  event,
  timingDetail,
  isAllPhotos,
}: FinishVideoProps) {
  const [hasError, setHasError] = useState(false);

  // Cast to known type since Supabase types might be loosely defined for JSON columns
  // const videoInfo = event.finishline_video_info as unknown as
  //   | FinishVideoInfo
  //   | undefined;

  // // Calculate video start time
  // const startTime = useMemo(() => {
  //   if (!videoInfo?.status || videoInfo.status !== "enabled") {
  //     return 0;
  //   }
  //   return calculateVideoStartTime(videoInfo, timingDetail, isAllPhotos);
  // }, [videoInfo, timingDetail, isAllPhotos]);

  // // Don't render if video info doesn't exist or is disabled
  // if (!videoInfo?.status || videoInfo.status !== "enabled") {
  //   return null;
  // }

  const handleError = () => {
    setHasError(true);
    console.error("Failed to load finish video");
  };

  const handleRetry = () => {
    setHasError(false);
  };

  const handleReady = () => {
    setHasError(false);
  };

  return (
    <article className="border-border/60 bg-background/95 overflow-hidden rounded-2xl border shadow-sm">
      <Accordion type="single" collapsible>
        <AccordionItem value="finish-video" className="border-0">
          <AccordionTrigger className="px-3 hover:no-underline">
            <div className="flex items-center gap-1.5 md:gap-2">
              <PlayCircle className="text-primary h-4 w-4 md:h-5 md:w-5" />
              <h2 className="text-sm font-semibold md:text-lg">Video Finish</h2>
            </div>
          </AccordionTrigger>
          <AccordionContent className="overflow-hidden pb-0">
            <div className="w-full max-w-full space-y-4 px-3 pb-4 md:px-6 md:pb-6">
              {/* Video Player */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                {hasError ? (
                  <VideoError onRetry={handleRetry} />
                ) : // <YouTubePlayer
                //   url={videoInfo.url}
                //   startTime={startTime}
                //   thumbnail={videoInfo.thumbnail}
                //   onReady={handleReady}
                //   onError={handleError}
                // />
                null}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}
