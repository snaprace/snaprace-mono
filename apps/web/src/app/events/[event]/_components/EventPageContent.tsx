"use client";

import { useState } from "react";
import { SearchSelfieSection } from "./SearchSelfieSection";
import { EventInsightsPanel } from "./EventInsightsPanel";
import { LeaderboardSection } from "./LeaderboardSection";
import { PhotoGallery } from "./PhotoGallery";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import {
  useAnalyticsTracking,
  usePerformanceTracking,
} from "@/hooks/useAnalyticsTracking";

interface EventPageContentProps {
  eventId: string;
  organizerId: string;
  eventName: string;
}

export function EventPageContent({
  eventId,
  organizerId,
  eventName,
}: EventPageContentProps) {
  const [searchedPhotos, setSearchedPhotos] = useState<Photo[] | null>(null);

  useAnalyticsTracking();
  usePerformanceTracking();

  return (
    <>
      <EventInsightsPanel
        sections={[
          <LeaderboardSection key="leaderboard" eventId={eventId} />,
          <SearchSelfieSection
            key="selfie"
            eventId={eventId}
            organizerId={organizerId}
            eventName={eventName}
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

