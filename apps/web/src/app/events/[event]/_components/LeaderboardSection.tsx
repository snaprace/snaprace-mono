"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LeaderboardTableAdvanced } from "../[bib]/_components/leaderboard-table/LeaderboardTableAdvanced";
import { RelayLeaderboardTable } from "../[bib]/_components/leaderboard-table/RelayLeaderboardTable";
import type { LeaderboardResult } from "@/server/services/timing-service";
import type { Tables } from "@repo/supabase";
import { formatDuration, formatPace } from "@/utils/time";

type EventRunner = Tables<"event_runners">;

interface LeaderboardSectionProps {
  eventId: string;
  organizationId?: string;
  highlightBib?: string;
}

const OVERALL_KEY = "__overall__";

export function LeaderboardSection({
  eventId,
  organizationId,
  highlightBib,
}: LeaderboardSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const resultsQuery = api.results.getEventResults.useQuery(
    { eventId },
    { enabled: Boolean(eventId) },
  );

  const categories = useMemo(() => {
    if (!resultsQuery.data?.sets) return [];
    return resultsQuery.data.sets.map((set, index) => {
      const slug = set.eventSlug ?? `${OVERALL_KEY}-${index}`;
      const isRelay = set.results.some((r) => r.is_relay);
      return {
        id: slug,
        name: set.label ?? set.eventSlug ?? "Overall",
        count: set.total,
        results: adaptRunnersToLeaderboard(set.results),
        isRelay,
      };
    });
  }, [resultsQuery.data]);

  useMemo(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]!.id);
    }
  }, [categories, selectedCategory]);

  const currentResults = useMemo(() => {
    if (!categories.length) return { results: [], isRelay: false };
    if (!selectedCategory)
      return {
        results: categories[0]!.results,
        isRelay: categories[0]!.isRelay,
      };
    const match = categories.find((cat) => cat.id === selectedCategory);
    return {
      results: match?.results ?? [],
      isRelay: match?.isRelay ?? false,
    };
  }, [categories, selectedCategory]);

  if (resultsQuery.isLoading) {
    return <LeaderboardSkeleton />;
  }

  if (resultsQuery.error || !resultsQuery.data) {
    return null;
  }

  if (currentResults.results.length === 0) {
    return null;
  }

  return (
    <article className="border-border/60 bg-background/95 overflow-hidden rounded-2xl border shadow-sm">
      <Accordion type="single" collapsible defaultValue="leaderboard">
        <AccordionItem value="leaderboard" className="border-0">
          <AccordionTrigger className="px-3 hover:no-underline">
            <div className="flex items-center gap-1.5 md:gap-2">
              <Trophy className="text-primary h-4 w-4 md:h-5 md:w-5" />
              <h2 className="text-sm font-semibold md:text-lg">Leaderboard</h2>
            </div>
          </AccordionTrigger>
          <AccordionContent className="overflow-hidden">
            <div className="w-full max-w-full">
              {categories.length > 1 && (
                <div className="mb-3 flex flex-col gap-2 px-3 md:mb-4 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6">
                  <div
                    className="flex gap-1.5 overflow-x-auto md:gap-2"
                    style={{
                      scrollbarWidth: "none",
                    }}
                  >
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors md:px-4 md:py-2 md:text-sm ${
                          selectedCategory === category.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {category.name}
                        <span className="ml-1 text-[10px] opacity-70 md:ml-2 md:text-xs">
                          ({category.count})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentResults.isRelay ? (
                <RelayLeaderboardTable
                  results={currentResults.results}
                  highlightBib={highlightBib}
                  eventId={eventId}
                  organizationId={organizationId ?? ""}
                />
              ) : (
                <LeaderboardTableAdvanced
                  results={currentResults.results}
                  highlightBib={highlightBib}
                  eventId={eventId}
                  organizationId={organizationId ?? ""}
                />
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}

function adaptRunnersToLeaderboard(
  runners: EventRunner[],
): LeaderboardResult[] {
  return runners.map((runner, index) => {
    const name =
      [runner.first_name, runner.last_name].filter(Boolean).join(" ") ||
      `Bib #${runner.bib_number}`;
    return {
      rank: runner.overall_place ?? index + 1,
      bib: String(runner.bib_number),
      name,
      chipTime: formatDuration(runner.chip_time_seconds) ?? undefined,
      clockTime: formatDuration(runner.gun_time_seconds) ?? undefined,
      division: runner.age_group ?? undefined,
      gender: runner.gender ?? undefined,
      age: runner.age ?? undefined,
      divisionPlace: runner.division_place ?? undefined,
      racePlacement: runner.overall_place ?? undefined,
      agePerformance: undefined,
      avgPace: formatPace(runner.avg_pace_seconds) ?? undefined,
      city: runner.city ?? undefined,
      state: runner.state ?? undefined,
      sourcePayload: runner.source_payload,
    };
  });
}
function LeaderboardSkeleton() {
  return (
    <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-40" />
      </div>
    </article>
  );
}
