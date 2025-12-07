"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { Tables } from "@repo/supabase";
import { Input } from "@/components/ui/input";
import { useEventStats } from "@/hooks/events/useEventStats";
import { Skeleton } from "@/components/ui/skeleton";
import { trackBibSearch } from "@/lib/analytics";

export function EventHeader({ event }: { event: Tables<"events"> }) {
  const t = useTranslations("eventHeader");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const bib = params?.bib;
  const [searchBib, setSearchBib] = useState(bib ? String(bib) : "");

  const handleClear = () => {
    setSearchBib("");
    router.push(`/events/${event.event_id}`);
  };

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBib = searchBib.trim();

    if (trimmedBib) {
      trackBibSearch(event.event_id, trimmedBib);
      router.push(`/events/${event.event_id}/${trimmedBib}`);
    } else {
      router.push(`/events/${event.event_id}`);
    }
  };

  const { label, count, isLoading, runnerName } = useEventStats(
    event.event_id,
    event.organizer_id,
    event.display_mode,
  );

  console.log(label, count, isLoading, runnerName);

  const handleBack = () => {
    if (bib) {
      router.push(`/events/${event.event_id}`);
    } else {
      router.push("/events");
    }
  };

  const statsText = runnerName
    ? t("statsWithRunnerFormat", { label, runnerName, count: count ?? 0 })
    : t("statsFormat", { label, count: count ?? 0 });

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur md:h-18">
      <div className="container mx-auto flex items-center justify-between px-1 md:px-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={handleBack}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden md:inline">{tCommon("back")}</span>
        </Button>

        <div className="flex-1 text-center">
          <h1 className="text-sm font-semibold md:text-xl">{event.name}</h1>
          <div className="text-muted-foreground flex items-center justify-center text-xs tracking-wide md:text-sm">
            {isLoading ? (
              <Skeleton className="h-[16px] w-[140px] md:h-[20px] md:w-[160px]" />
            ) : (
              <span>{statsText}</span>
            )}
          </div>
        </div>

        <div className="w-10 md:w-auto">
          <form
            onSubmit={handleBibSearch}
            className="relative hidden items-center gap-2 md:flex"
          >
            <div className="relative">
              <Input
                type="text"
                placeholder={t("enterBib")}
                value={searchBib}
                onChange={(e) => setSearchBib(e.target.value)}
                className="w-[100px] border border-gray-200 pr-8 transition-all duration-300 focus:w-[140px]"
              />
              {(searchBib || bib) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <Button type="submit" size="sm">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
