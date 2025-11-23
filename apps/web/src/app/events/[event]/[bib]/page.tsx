import { notFound, redirect } from "next/navigation";
import { EventInsightsPanel } from "@/app/events/[event]/_components/EventInsightsPanel";
import { LeaderboardSection } from "@/app/events/[event]/_components/LeaderboardSection";
import { PhotoGallery } from "@/app/events/[event]/_components/PhotoGallery";
import { TimingResultSection } from "@/app/events/[event]/_components/TimingResultSection";
import { getEventById } from "@/server/services/events";

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
    <>
      <EventInsightsPanel
        sections={[
          <TimingResultSection key="timing" eventId={event} bib={bib} />,
          <LeaderboardSection
            key="leaderboard"
            eventId={event}
            highlightBib={bib}
          />,
        ]}
      />
      <div>
        <PhotoGallery
          eventId={event}
          organizerId={eventData.organizer_id}
          bib={bib}
        />
      </div>
    </>
  );
}
