"use client";

import { useMemo } from "react";
import type { ChangeEvent, MouseEvent, RefObject } from "react";
import { AlertTriangle, MapPin, Timer } from "lucide-react";

import { api } from "@/trpc/react";
import type { BibDetailResponse } from "@/server/services/timing-service";
import type { Event } from "@/server/api/routers/events";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PerformanceTierBadge } from "@/components/performance/PerformanceTierBadge";

import { SelfieUploadCard } from "./SelfieUploadCard";
import { EventLeaderboard } from "./EventLeaderboard";
import { FinishVideo } from "./FinishVideo";

interface RunnerSpotlightProps {
  eventId: string;
  eventName: string;
  organizationId: string;
  event: Event | null;
  bibNumber: string;
  isAllPhotos: boolean;
  isUploading: boolean;
  uploadedFile: File | null;
  selfieEnhanced: boolean;
  selfieMatchedCount: number;
  isProcessed: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onLabelClick: (event: MouseEvent<HTMLLabelElement>) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRetryUpload: () => void;
}

export function RunnerSpotlight({
  eventId,
  eventName,
  organizationId,
  event,
  bibNumber,
  isAllPhotos,
  isUploading,
  uploadedFile,
  selfieEnhanced,
  selfieMatchedCount,
  isProcessed,
  inputRef,
  onLabelClick,
  onFileChange,
  onRetryUpload,
}: RunnerSpotlightProps) {
  const timingEnabled = !isAllPhotos && bibNumber.length > 0;

  const testEvent = eventId.includes("test");

  const timingQuery = api.results.getTimingByBib.useQuery(
    { eventId, bib: bibNumber },
    {
      enabled: timingEnabled && !testEvent,
    },
  );

  const timingStatus = useMemo<TimingStatus>(() => {
    if (!timingEnabled) return "disabled";
    if (timingQuery.isLoading || timingQuery.isFetching) return "loading";
    if (timingQuery.error) {
      return timingQuery.error.data?.code === "NOT_FOUND" ? "empty" : "error";
    }
    return timingQuery.data ? "ready" : "empty";
  }, [
    timingEnabled,
    timingQuery.data,
    timingQuery.error,
    timingQuery.isFetching,
    timingQuery.isLoading,
  ]);

  const detail = timingQuery.data ?? null;
  const showTimingCard =
    timingStatus === "loading" ||
    timingStatus === "error" ||
    timingStatus === "ready";

  const showNoMatches = Boolean(
    uploadedFile && !isUploading && isProcessed && selfieMatchedCount === 0,
  );

  return (
    <div className="container mx-auto mt-8 px-1 md:px-4">
      <section className="border-border/60 bg-muted/30 overflow-hidden rounded-3xl border p-4 shadow-sm md:p-6">
        <div className="grid gap-4">
          {showTimingCard ? (
            <TimingSummaryCard
              status={timingStatus}
              detail={detail}
              onRetry={() => timingQuery.refetch()}
            />
          ) : null}

          <EventLeaderboard
            eventId={eventId}
            eventName={eventName}
            organizationId={organizationId}
            highlightBib={!isAllPhotos ? bibNumber : undefined}
          />

          {event?.finishline_video_info && (
            <FinishVideo
              event={event}
              timingDetail={detail}
              isAllPhotos={isAllPhotos}
            />
          )}

          {bibNumber && (
            <SelfieUploadCard
              bibNumber={bibNumber}
              disabled={!bibNumber}
              isUploading={isUploading}
              uploadedFile={uploadedFile}
              selfieEnhanced={selfieEnhanced}
              matchedCount={selfieMatchedCount}
              showNoMatches={showNoMatches}
              inputRef={inputRef}
              onLabelClick={onLabelClick}
              onFileChange={onFileChange}
              onRetry={onRetryUpload}
            />
          )}
        </div>
      </section>
    </div>
  );
}

type TimingStatus = "disabled" | "loading" | "error" | "empty" | "ready";

interface TimingSummaryCardProps {
  status: TimingStatus;
  detail: BibDetailResponse | null;
  onRetry: () => void | Promise<unknown>;
}

function TimingSummaryCard({
  status,
  detail,
  onRetry,
}: TimingSummaryCardProps) {
  if (status === "disabled") {
    return null;
  }

  if (status == "loading") {
    return <TimingSummarySkeleton />;
  }

  if (status === "error") {
    return (
      <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-destructive/10 text-destructive rounded-full p-2">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold">
                We couldn’t load timing data
              </h3>
              <p className="text-muted-foreground text-sm">
                Check your connection and try again later.
              </p>
            </div>
          </div>
          {/* <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => {
              void onRetry();
            }}
          >
            Retry
          </Button> */}
        </div>
      </article>
    );
  }

  if (status === "empty") {
    return null;
    //      return (
    //        <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
    //          <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-center">
    //            <div className="bg-muted/60 text-muted-foreground rounded-full p-2">
    //              <Timer className="h-5 w-5" />
    //            </div>
    //            <div className="space-y-2">
    //              <h3 className="text-base font-semibold">
    //                Timing results not available yet
    //              </h3>
    //              <p className="text-muted-foreground text-sm">
    //                We can’t find official timing data for this bib.
    //                <br />
    //                Results may still be publishing—check back soon.
    //              </p>
    //            </div>
    //            </div>
    //          </article>
    //        );
  }

  if (!detail) {
    return null;
  }

  const chipTime = getRowValue(detail.row, "chip_time");
  const clockTime = getRowValue(detail.row, "clock_time");
  const averagePace = getRowValue(detail.row, "avg_pace");
  const divisionPlace = getRowValue(detail.row, "division_place");
  const racePlacement = getRowValue(detail.row, "race_placement");
  const division = getRowValue(detail.row, "division");
  const city = getRowValue(detail.row, "city");
  const state = getRowValue(detail.row, "state");
  const gender = getRowValue(detail.row, "gender");
  const age = getRowNumber(detail.row, "age");
  const agePerformance = getRowNumber(detail.row, "age_performance_percentage");

  const location = [city, state].filter(Boolean).join(", ");

  return (
    <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs tracking-wide uppercase">
            <Timer className="h-4 w-4" />
            <span>Runner Spotlight</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold md:text-xl">
              {detail.meta.name && detail.meta.name.length > 0
                ? detail.meta.name
                : `Bib #${detail.meta.bib}`}
            </h2>
            <div className="text-muted-foreground text-sm">
              Bib #{detail.meta.bib}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {gender ? <Badge variant="secondary">{gender}</Badge> : null}
            {typeof age === "number" && age > 0 ? (
              <Badge variant="secondary">{age} yrs</Badge>
            ) : null}
          </div>
        </div>
        {agePerformance !== 0 && (
          <PerformanceTierBadge
            value={agePerformance}
            className="min-w-[180px] justify-between"
          />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3 md:gap-4">
        <TimingMetric label="Chip Time" value={chipTime} highlight />
        <TimingMetric
          label="Clock Time"
          value={clockTime === "" ? "-" : clockTime}
        />
        <TimingMetric label="Average Pace" value={averagePace} />
        <TimingMetric label="Division Place" value={divisionPlace} />
        <TimingMetric label="Overall Place" value={racePlacement} />
        <TimingMetric label="Division" value={division} />
      </dl>

      {location ? (
        <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" />
          <span>{location}</span>
        </div>
      ) : null}
    </article>
  );
}

function TimingSummarySkeleton() {
  return (
    <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-32" />
        <div className="mt-2 flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-18 rounded-xl" />
        ))}
      </div>
    </article>
  );
}

interface TimingMetricProps {
  label: string;
  value: string | number | undefined;
  highlight?: boolean;
}

function TimingMetric({ label, value, highlight = false }: TimingMetricProps) {
  const displayValue = value === "" || !value ? "—" : value;

  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border/60 bg-muted/20"
      }`}
    >
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-foreground mt-1 text-base font-semibold">
        {displayValue}
      </dd>
    </div>
  );
}

function getRowValue(
  row: BibDetailResponse["row"] | undefined,
  key: string,
): string | number | undefined {
  if (!row) return undefined;
  const value = row[key];
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return undefined;
}

function getRowNumber(
  row: BibDetailResponse["row"] | undefined,
  key: string,
): number | undefined {
  if (!row) return undefined;
  const value = row[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}
