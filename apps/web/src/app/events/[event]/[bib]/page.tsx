import { redirect } from "next/navigation";

import { EventInsightsPanel } from "@/app/events/[event]/_components/EventInsightsPanel";
import { LeaderboardSection } from "@/app/events/[event]/_components/LeaderboardSection";
import { PhotoGallery } from "@/app/events/[event]/_components/PhotoGallery";
import { TimingResultSection } from "@/app/events/[event]/_components/TimingResultSection";

export default async function EventBibPage({
  params,
}: {
  params: Promise<{ event: string; bib: string }>;
}) {
  const { event, bib } = await params;

  if (bib === "null") {
    redirect(`/events/${event}`);
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
      <div className="container mx-auto mt-8 px-1 md:px-4">
        <PhotoGallery />
      </div>
    </>
  );
}
