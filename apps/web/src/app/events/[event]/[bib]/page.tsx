import { notFound, redirect } from "next/navigation";
import { getEventById } from "@/server/services/events";
import { BibPageContent } from "./_components/BibPageContent";

export default async function EventBibPage({
  params,
}: {
  params: Promise<{ event: string; bib: string }>;
}) {
  const { event, bib } = await params;

  if (bib === "null") {
    redirect(`/events/${event}`);
  }

  const eventData = await getEventById({ eventId: event });

  if (!eventData) {
    notFound();
  }

  return (
    <BibPageContent
      eventId={event}
      organizerId={eventData.organizer_id}
      eventName={eventData.name}
      bib={bib}
    />
  );
}
