"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Tables } from "@repo/supabase";
import { Input } from "@/components/ui/input";
import { useEventStats } from "@/hooks/events/useEventStats";
import { Skeleton } from "@/components/ui/skeleton";
import { trackBibSearch } from "@/lib/analytics";

export function EventHeader({ event }: { event: Tables<"events"> }) {
  const router = useRouter();
  const params = useParams();
  const bib = params?.bib;
  const [searchBib, setSearchBib] = useState("");

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchBib.trim()) {
      trackBibSearch(event.event_id, searchBib.trim());
      router.push(`/events/${event.event_id}/${searchBib.trim()}`);
    }
  };

  const { label, count, isLoading, runnerName } = useEventStats(
    event.event_id,
    event.organizer_id,
    event.display_mode,
  );

  const handleBack = () => {
    if (bib) {
      router.push(`/events/${event.event_id}`);
    } else {
      router.push("/events");
    }
  };

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur md:h-18">
      <div className="container mx-auto flex items-center justify-between px-1 md:px-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden md:inline">Back</span>
        </Button>

        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold md:text-xl">{event.name}</h1>
          <div className="text-muted-foreground flex items-center justify-center text-xs tracking-wide md:text-sm">
            {isLoading ? (
              <Skeleton className="h-[16px] w-[140px] md:h-[20px] md:w-[160px]" />
            ) : (
              <span>{`${label} • ${runnerName ? `${runnerName} • ` : ""}${count} photos`}</span>
            )}
          </div>
        </div>

        <div className="w-10 md:w-auto">
          <form
            onSubmit={handleBibSearch}
            className="hidden items-center gap-2 md:flex"
          >
            <Input
              type="text"
              placeholder="Enter bib"
              value={searchBib}
              onChange={(e) => setSearchBib(e.target.value)}
              className="w-[100px] border border-gray-200 transition-all duration-300 focus:w-[140px]"
            />
            <Button type="submit" size="sm" disabled={!searchBib.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
