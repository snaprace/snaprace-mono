"use client";

import { useState, useEffect } from "react";
import { Images, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import type { Event } from "@/server/services/events";
import type { Organizer } from "@/server/services/organizers";

interface HomeSearchProps {
  initialEvents: Event[];
  organizer: Organizer | null;
}

export function HomeSearch({ initialEvents, organizer }: HomeSearchProps) {
  const [bibNumber, setBibNumber] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const router = useRouter();

  const events = initialEvents;

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0]?.event_id ?? "");
    }
  }, [events, selectedEventId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (bibNumber.trim() && selectedEventId) {
      router.push(`/events/${selectedEventId}/${bibNumber.trim()}`);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Event Selection */}
        <div className="space-y-2">
          <label className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4" />
            Event
          </label>
          <Select
            value={selectedEventId}
            onValueChange={setSelectedEventId}
          >
            <SelectTrigger
              disabled={events.length === 0}
              className="bg-background border-border h-14! w-full text-sm font-medium"
            >
              <SelectValue
                placeholder={
                  events.length === 0
                    ? "No events available"
                    : "Select an event"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {events.length > 0 &&
                events.map((event) => (
                  <SelectItem
                    key={event.event_id}
                    value={event.event_id}
                    className="h-12 whitespace-normal md:min-h-14"
                  >
                    {event.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bib Number Input */}
        <div className="space-y-2">
          <label className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4" />
            Bib Number
          </label>
          <Input
            type="text"
            placeholder="Enter your bib number (e.g., 1234)"
            value={bibNumber}
            onChange={(e) => setBibNumber(e.target.value)}
            disabled={events.length === 0}
            className="bg-background border-border h-14 text-sm font-medium md:text-lg"
            style={{
              fontSize: "14px",
            }}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 w-full border-0 text-lg font-medium shadow-none"
          disabled={!bibNumber.trim() || !selectedEventId}
        >
          <Search className="mr-2 h-5 w-5" />
          Find My Photos
        </Button>

        <Button
          type="button"
          size="lg"
          className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 h-14 w-full border text-lg font-medium"
          onClick={() => router.push(`/events/${selectedEventId}`)}
          disabled={!selectedEventId}
        >
          <Images className="mr-2 h-5 w-5" />
          Go to All Photos
        </Button>
      </form>
    </div>
  );
}

