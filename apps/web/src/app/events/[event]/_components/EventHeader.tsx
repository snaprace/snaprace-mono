"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Tables } from "@repo/supabase";
import { Input } from "@/components/ui/input";

export function EventHeader({ event }: { event: Tables<"events"> }) {
  const router = useRouter();

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // if (searchBib.trim()) {
    //   router.push(`/events/${event.id}/${searchBib.trim()}`);
    // }
  };

  return (
    <header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-30 flex h-16 items-center border-b backdrop-blur md:h-18">
      <div className="container mx-auto flex items-center justify-between px-1 md:px-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          onClick={() => router.push("/events")}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden md:inline">Back to Events</span>
        </Button>

        <div className="flex-1 text-center">
          <div className="text-muted-foreground text-xs tracking-wide uppercase md:text-sm">
            Event Overview
          </div>
          <h1 className="text-sm font-semibold md:text-xl">{event.name}</h1>
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
            {/* <Button type="submit" size="sm" disabled={!searchBib.trim()}> */}
            <Button type="submit" size="sm">
              <Search />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
