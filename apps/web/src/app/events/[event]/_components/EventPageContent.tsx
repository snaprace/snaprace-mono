"use client";

import { useState } from "react";
import { SearchSelfieSection } from "./SearchSelfieSection";
import { SearchBibSection } from "./SearchBibSection";
import { EventInsightsPanel } from "./EventInsightsPanel";
import { LeaderboardSection } from "./LeaderboardSection";
import { FinishVideoSection } from "./FinishVideoSection";
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
  const [selectedSubEventId, setSelectedSubEventId] = useState<string | null>(
    null,
  );

  useAnalyticsTracking();
  usePerformanceTracking();

  return (
    <>
      <EventInsightsPanel
        sections={[
          event.display_mode === "RESULTS_AND_PHOTOS" && (
            <LeaderboardSection
              key="leaderboard"
              eventId={event.event_id}
              selectedSubEventId={selectedSubEventId}
              onSubEventChange={setSelectedSubEventId}
            />
          ),
          event.display_mode === "RESULTS_AND_PHOTOS" && (
            <FinishVideoSection
              key="finish-video"
              eventId={event.event_id}
              selectedSubEventId={selectedSubEventId}
            />
          ),
          <SearchSelfieSection
            key="selfie"
            eventId={event.event_id}
            organizerId={organizerId}
            eventName={event.name}
            onPhotosFound={setSearchedPhotos}
          />,
          <SearchBibSection key="bib-search" eventId={event.event_id} />,
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
