import { getEventById } from "@/server/services/events";
import { notFound } from "next/navigation";
import { EventPageContent } from "./_components/EventPageContent";
import { PartnerBanner } from "./_components/PartnerBanner";

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

  const partners = event.partners;

  return (
    <>
      {partners && <PartnerBanner partners={partners} />}
      <EventPageContent event={event} organizerId={event.organizer_id} />
    </>
  );
}
