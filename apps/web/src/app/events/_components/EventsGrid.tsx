"use client";

import EventCard from "./EventCard";
import { type EventEntity } from "@/types/trpc";

interface EventsGridProps {
  events: EventEntity[];
}

export default function EventsGrid({ events }: EventsGridProps) {
  return (
    <div className="tablet:grid-cols-2 desktop:grid-cols-3 tablet:gap-8 desktop:gap-10 grid grid-cols-1 gap-6">
      {events.map((event) => (
        <EventCard
          key={event.event_id}
          id={event.event_id}
          name={event.event_name}
          image={event.event_image_url}
          date={event.event_date}
        />
      ))}
    </div>
  );
}
