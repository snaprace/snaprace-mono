import { PhotoService } from "@/server/services/photo-service";
import { EventInsightsPanel } from "./_components/EventInsightsPanel";
import { LeaderboardSection } from "./_components/LeaderboardSection";
import { PhotoGallerySection } from "./_components/PhotoGallerySection";

export default async function EventPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const eventId = (await params).event;

  const photos = await PhotoService.getPhotosByEvent({
    organizerId: "winningeventsgroup",
    eventId,
  });

  // console.log("photos", photos);

  return (
    <>
      <EventInsightsPanel
        sections={[<LeaderboardSection key="leaderboard" eventId={eventId} />]}
      />
      <div className="container mx-auto mt-8 px-1 md:px-4">
        <PhotoGallerySection />
      </div>
    </>
  );
}
