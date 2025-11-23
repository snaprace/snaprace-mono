import { EventInsightsPanel } from "./_components/EventInsightsPanel";
import { LeaderboardSection } from "./_components/LeaderboardSection";
import { PhotoGallery } from "./_components/PhotoGallery";
import { getEventById } from "@/server/services/events";
import { notFound } from "next/navigation";

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
    <>
      <EventInsightsPanel
        sections={[<LeaderboardSection key="leaderboard" eventId={eventId} />]}
      />
      <div>
        <PhotoGallery eventId={eventId} organizerId={event.organizer_id} />
      </div>
    </>
  );
}
