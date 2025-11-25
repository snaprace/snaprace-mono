"use client";

import { AlertTriangle, Timer } from "lucide-react";

import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatPace } from "@/utils/time";
import { Badge } from "@/components/ui/badge";

interface TimingResultSectionProps {
  eventId: string;
  bib: string;
}

export function TimingResultSection({
  eventId,
  bib,
}: TimingResultSectionProps) {
  const query = api.resultsV2.getRunnerByBib.useQuery(
    { eventId, bib },
    { enabled: Boolean(bib) },
  );

  const status = getTimingStatus(query.isLoading, query.error, query.data);

  if (status === "disabled") return null;
  if (status === "loading") return <TimingSummarySkeleton />;
  if (status === "error")
    return (
      <TimingErrorCard
        message={
          query.error?.message ?? "We couldn’t load timing data right now."
        }
      />
    );
  if (status === "empty") return null;

  const runner = query.data!;
  const fullName =
    [runner.first_name, runner.last_name].filter(Boolean).join(" ") ||
    `Bib #${runner.bib_number}`;

  const chipTime = formatDuration(runner.chip_time_seconds) ?? "–";
  const clockTime = formatDuration(runner.gun_time_seconds) ?? "–";
  const avgPace = formatPace(runner.avg_pace_seconds) ?? "–";
  const divisionPlace = runner.division_place ?? "–";
  const overallPlace =
    runner.overall_place !== null ? runner.overall_place : "–";
  const division = runner.age_group ?? "–";
  const location = [runner.city, runner.state].filter(Boolean).join(", ");

  return (
    <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="text-muted-foreground flex items-center gap-2 text-xs tracking-wide uppercase">
            <Timer className="h-4 w-4" />
            <span>Runner Spotlight</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold md:text-xl">{fullName}</h2>
            <div className="mt-2 flex items-center gap-2">
              {runner.gender && (
                <Badge variant="outline">{runner.gender}</Badge>
              )}
              {runner.age && <Badge variant="outline">{runner.age} yrs</Badge>}
              {location && <Badge variant="outline">{location}</Badge>}
            </div>
            {/* <div className="text-muted-foreground text-sm">
              Bib #{runner.bib_number} {location ? `(${location})` : ""}
            </div> */}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3 md:gap-4">
        <TimingMetric label="Chip Time" value={chipTime} highlight />
        <TimingMetric label="Clock Time" value={clockTime} />
        <TimingMetric label="Average Pace" value={avgPace} />
        <TimingMetric label="Division Place" value={divisionPlace} />
        <TimingMetric label="Overall Place" value={overallPlace} />
        <TimingMetric label="Division" value={division} />
      </dl>
    </article>
  );
}

function getTimingStatus(
  isLoading: boolean,
  error: unknown,
  data?: unknown,
): "loading" | "error" | "empty" | "ready" | "disabled" {
  if (isLoading) return "loading";
  if (error) return "error";
  if (!data) return "empty";
  return "ready";
}

function TimingMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
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
      <dd className="text-foreground mt-1 text-base font-semibold">{value}</dd>
    </div>
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

function TimingErrorCard({ message }: { message: string }) {
  return (
    <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 text-center">
        <div className="bg-destructive/10 text-destructive rounded-full p-2">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold">
            Unable to load timing data
          </h3>
          <p className="text-muted-foreground text-sm">{message}</p>
        </div>
      </div>
    </article>
  );
}
