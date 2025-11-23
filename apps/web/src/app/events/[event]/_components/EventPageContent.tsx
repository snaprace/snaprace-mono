"use client";

import { useState } from "react";
import { SearchSelfieSection } from "./SearchSelfieSection";
import { EventInsightsPanel } from "./EventInsightsPanel";
import { LeaderboardSection } from "./LeaderboardSection";
import { PhotoGallery } from "./PhotoGallery";
import type { Photo } from "@/hooks/photos/usePhotoGallery";

interface EventPageContentProps {
  eventId: string;
  organizerId: string;
}

export function EventPageContent({
  eventId,
  organizerId,
}: EventPageContentProps) {
  const [searchedPhotos, setSearchedPhotos] = useState<Photo[] | null>(null);

  return (
    <>
      <EventInsightsPanel
        sections={[
          <LeaderboardSection key="leaderboard" eventId={eventId} />,
          <SearchSelfieSection
            key="selfie"
            eventId={eventId}
            organizerId={organizerId}
            onPhotosFound={setSearchedPhotos}
          />,
        ]}
      />
      <div>
        <PhotoGallery
          eventId={eventId}
          organizerId={organizerId}
          overridePhotos={searchedPhotos || undefined}
        />
      </div>
    </>
  );
}

