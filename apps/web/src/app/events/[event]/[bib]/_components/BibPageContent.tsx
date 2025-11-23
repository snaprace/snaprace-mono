"use client";

import { useState } from "react";
import { SearchSelfieSection } from "@/app/events/[event]/_components/SearchSelfieSection";
import { EventInsightsPanel } from "@/app/events/[event]/_components/EventInsightsPanel";
import { LeaderboardSection } from "@/app/events/[event]/_components/LeaderboardSection";
import { PhotoGallery } from "@/app/events/[event]/_components/PhotoGallery";
import { TimingResultSection } from "@/app/events/[event]/_components/TimingResultSection";
import type { Photo } from "@/hooks/photos/usePhotoGallery";

interface BibPageContentProps {
  eventId: string;
  organizerId: string;
  bib: string;
}

export function BibPageContent({
  eventId,
  organizerId,
  bib,
}: BibPageContentProps) {
  const [extraPhotos, setExtraPhotos] = useState<Photo[] | null>(null);

  return (
    <>
      <EventInsightsPanel
        sections={[
          <TimingResultSection key="timing" eventId={eventId} bib={bib} />,
          <LeaderboardSection
            key="leaderboard"
            eventId={eventId}
            highlightBib={bib}
          />,
          <SearchSelfieSection
            key="selfie"
            eventId={eventId}
            organizerId={organizerId}
            bib={bib}
            onPhotosFound={setExtraPhotos}
          />,
        ]}
      />
      <div>
        <PhotoGallery
          eventId={eventId}
          organizerId={organizerId}
          bib={bib}
          extraPhotos={extraPhotos || undefined}
        />
      </div>
    </>
  );
}

