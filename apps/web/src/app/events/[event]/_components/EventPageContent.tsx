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
import type { Tables } from "@repo/supabase";

interface EventPageContentProps {
  event: Tables<"events">;
  organizerId: string;
}

export function EventPageContent({
  event,
  organizerId,
}: EventPageContentProps) {
  const [searchedPhotos, setSearchedPhotos] = useState<Photo[] | null>(null);

  useAnalyticsTracking();
  usePerformanceTracking();

  return (
    <>
      <EventInsightsPanel
        sections={[
          event.display_mode === "RESULTS_AND_PHOTOS" && (
            <LeaderboardSection key="leaderboard" eventId={event.event_id} />
          ),
          <SearchSelfieSection
            key="selfie"
            eventId={event.event_id}
            organizerId={organizerId}
            eventName={event.name}
            onPhotosFound={setSearchedPhotos}
          />,
        ]}
      />
      <div>
        <PhotoGallery
          eventId={event.event_id}
          organizerId={organizerId}
          overridePhotos={searchedPhotos || undefined}
        />
      </div>
    </>
  );
}
