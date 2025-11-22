import { EventInsightsPanel } from "./_components/EventInsightsPanel";
import { LeaderboardSection } from "./_components/LeaderboardSection";
import {  PhotoGallery } from "./_components/PhotoGallery";
export default async function EventPage({

  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const eventId = (await params).event;

  return (
    <>
      <EventInsightsPanel
        sections={[<LeaderboardSection key="leaderboard" eventId={eventId} />]}
      />
      <div className="container mx-auto mt-8 px-1 md:px-4">
        <PhotoGallery />
      </div>
    </>
  );
}
