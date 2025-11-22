import { redirect } from "next/navigation";

import { EventInsightsPanel } from "@/app/events/[event]/_components/EventInsightsPanel";
import { LeaderboardSection } from "@/app/events/[event]/_components/LeaderboardSection";
import { PhotoGallerySection } from "@/app/events/[event]/_components/PhotoGallerySection";
import { TimingResultSection } from "@/app/events/[event]/_components/TimingResultSection";
import { PhotoService } from "@/server/services/photo-service";

export default async function EventBibPage({
  params,
}: {
  params: Promise<{ event: string; bib: string }>;
}) {
  const { event, bib } = await params;

  console.log("event", event);
  console.log("bib", bib);

  if (bib === "null") {
    redirect(`/events/${event}`);
  }

  const photos = await PhotoService.getPhotosByBib({
    organizerId: "winningeventsgroup",
    eventId: event,
    bibNumber: bib,
    limit: 20,
    cursor: undefined,
  });

  console.log("photos", photos);

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
      <div className="container mx-auto mt-8 px-1 md:px-4">
        <PhotoGallerySection />
      </div>
    </>
  );
}
