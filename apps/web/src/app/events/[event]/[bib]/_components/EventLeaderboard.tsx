"use client";

import { useState, useMemo } from "react";
import { Trophy } from "lucide-react";
import { api } from "@/trpc/react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LeaderboardTableAdvanced } from "./leaderboard-table/LeaderboardTableAdvanced";

interface EventLeaderboardProps {
  eventId: string;
  eventName: string; // Reserved for future use (analytics, etc.)
  organizationId: string;
  highlightBib?: string;
}

export function EventLeaderboard({
  eventId,
  eventName,
  organizationId,
  highlightBib,
}: EventLeaderboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const faceSearchOnly = eventId.includes("test");

  // Fetch all categories without filtering
  const resultsQuery = api.results.getAllResults.useQuery(
    {
      eventId,
      organizationId,
      // Don't filter by category - load all categories
    },
    {
      enabled: !!eventId && !!organizationId && !faceSearchOnly,
    },
  );

  // Get available categories
  const categories = useMemo(() => {
    if (!resultsQuery.data?.resultSets) return [];
    return resultsQuery.data.resultSets.map((rs) => ({
      id: rs.id,
      name: rs.category,
      count: rs.totalResults,
    }));
  }, [resultsQuery.data]);

  // Auto-select first category if none selected
  useMemo(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]!.id);
    }
  }, [categories, selectedCategory]);

  // Get current result set
  const currentResults = useMemo(() => {
    if (!resultsQuery.data?.resultSets) return [];
    if (!selectedCategory)
      return resultsQuery.data.resultSets[0]?.results ?? [];
    const resultSet = resultsQuery.data.resultSets.find(
      (rs) => rs.id === selectedCategory,
    );
    return resultSet?.results ?? [];
  }, [resultsQuery.data, selectedCategory]);

  if (resultsQuery.isLoading) {
    return <EventLeaderboardSkeleton />;
  }

  if (resultsQuery.error || !resultsQuery.data) {
    return null; // Silently fail - leaderboard is optional
  }

  if (currentResults.length === 0) {
    return null;
  }

  return (
    <article className="border-border/60 bg-background/95 overflow-hidden rounded-2xl border shadow-sm">
      <Accordion type="single" collapsible>
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
                  <div className="flex gap-1.5 overflow-x-auto md:gap-2">
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
                  <div className="text-muted-foreground shrink-0 text-xs md:text-sm">
                    {currentResults.length} result
                    {currentResults.length !== 1 ? "s" : ""} found
                  </div>
                </div>
              )}

              <LeaderboardTableAdvanced
                results={currentResults}
                highlightBib={highlightBib}
                eventId={eventId}
                organizationId={organizationId}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </article>
  );
}

export function EventLeaderboardSkeleton() {
  return (
    <article className="border-border/60 bg-background/95 rounded-2xl border p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-40" />
      </div>
    </article>
  );
}

// Inline skeleton removed; unified skeleton above
