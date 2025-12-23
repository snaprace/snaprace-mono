"use client";

import { useState } from "react";
import { SearchSelfieSection } from "@/app/events/[event]/_components/SearchSelfieSection";
import { SearchBibSection } from "@/app/events/[event]/_components/SearchBibSection";
import { EventInsightsPanel } from "@/app/events/[event]/_components/EventInsightsPanel";
import { LeaderboardSection } from "@/app/events/[event]/_components/LeaderboardSection";
import { FinishVideoSection } from "@/app/events/[event]/_components/FinishVideoSection";
import { PhotoGallery } from "@/app/events/[event]/_components/PhotoGallery";
import { TimingResultSection } from "@/app/events/[event]/_components/TimingResultSection";
import type { Photo } from "@/hooks/photos/usePhotoGallery";
import {
  useAnalyticsTracking,
  usePerformanceTracking,
} from "@/hooks/useAnalyticsTracking";
import type { Tables } from "@repo/supabase";
import { PartnerBanner, type Partner } from "../../_components/PartnerBanner";
import { api } from "@/trpc/react";

interface BibPageContentProps {
  event: Tables<"events">;
  bib: string;
}

export function BibPageContent({ event, bib }: BibPageContentProps) {
  const [extraPhotos, setExtraPhotos] = useState<Photo[] | null>(null);
  const [selectedSubEventId, setSelectedSubEventId] = useState<string | null>(
    null,
  );
  const { event_id, organizer_id, name, display_mode } = event;

  useAnalyticsTracking();
  usePerformanceTracking();

  const runnerQuery = api.results.getRunnerByBib.useQuery(
    { eventId: event_id, bib },
    {
      enabled: Boolean(
        event_id && bib && display_mode === "RESULTS_AND_PHOTOS",
      ),
      retry: false,
    },
  );

  const runnerGunTimeSeconds = runnerQuery.data?.gun_time_seconds ?? null;

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
              selectedSubEventId={selectedSubEventId}
              onSubEventChange={setSelectedSubEventId}
            />
          ),
          event.display_mode === "RESULTS_AND_PHOTOS" && (
            <FinishVideoSection
              key="finish-video"
              eventId={event_id}
              runnerGunTimeSeconds={runnerGunTimeSeconds}
              selectedSubEventId={selectedSubEventId}
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
          <SearchBibSection key="bib-search" eventId={event_id} />,
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
