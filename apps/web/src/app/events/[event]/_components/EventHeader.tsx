"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Tables } from "@repo/supabase";

export function EventHeader({ event }: { event: Tables<"events"> }) {
  const router = useRouter();

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

        <div className="w-10" />
      </div>
    </header>
  );
}
