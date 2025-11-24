import { getEventById } from "@/server/services/events";
import { notFound } from "next/navigation";
import { EventPageContent } from "./_components/EventPageContent";

export default async function EventPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const eventId = (await params).event;

  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return (
    <EventPageContent
      eventId={eventId}
      organizerId={event.organizer_id}
      eventName={event.name}
    />
  );
}
