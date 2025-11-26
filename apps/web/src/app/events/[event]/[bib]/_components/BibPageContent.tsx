"use client";

import { useState } from "react";
import { SearchSelfieSection } from "@/app/events/[event]/_components/SearchSelfieSection";
import { EventInsightsPanel } from "@/app/events/[event]/_components/EventInsightsPanel";
import { LeaderboardSection } from "@/app/events/[event]/_components/LeaderboardSection";
import { PhotoGallery } from "@/app/events/[event]/_components/PhotoGallery";
import { TimingResultSection } from "@/app/events/[event]/_components/TimingResultSection";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import {
  useAnalyticsTracking,
  usePerformanceTracking,
} from "@/hooks/useAnalyticsTracking";
import type { Tables } from "@repo/supabase";
import { PartnerBanner, type Partner } from "../../_components/PartnerBanner";

interface BibPageContentProps {
  event: Tables<"events">;
  bib: string;
}

export function BibPageContent({ event, bib }: BibPageContentProps) {
  const [extraPhotos, setExtraPhotos] = useState<Photo[] | null>(null);
  const { event_id, organizer_id, name } = event;

  useAnalyticsTracking();
  usePerformanceTracking();

  return (
    <>
      <EventInsightsPanel
        sections={[
          event.display_mode === "RESULTS_AND_PHOTOS" && (
            <TimingResultSection key="timing" eventId={event_id} bib={bib} />
          ),
          event.display_mode === "RESULTS_AND_PHOTOS" && (
            <LeaderboardSection
              key="leaderboard"
              eventId={event_id}
              highlightBib={bib}
            />
          ),
          <SearchSelfieSection
            key="selfie"
            eventId={event_id}
            organizerId={organizer_id}
            eventName={name}
            bib={bib}
            onPhotosFound={setExtraPhotos}
          />,
        ]}
      />
      <div>
        <PhotoGallery
          eventId={event_id}
          organizerId={organizer_id}
          bib={bib}
          extraPhotos={extraPhotos || undefined}
        />
        {event.partners &&
          Array.isArray(event.partners) &&
          event.partners.length > 0 && (
            <PartnerBanner partners={event.partners as unknown as Partner[]} />
          )}
      </div>
    </>
  );
}
