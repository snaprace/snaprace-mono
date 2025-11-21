"use client";

import EventsGrid from "./_components/EventsGrid";
import { api } from "@/trpc/react";
import { EventsGridSkeleton } from "@/components/states/EventsSkeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { NoEventsState } from "@/components/states/EmptyState";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function EventsPage() {
  const { organization } = useOrganization();

  const eventsQuery = api.events.getAll.useQuery();

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-foreground mb-4 text-3xl font-bold">
          {organization ? `${organization.name} Events` : "Events"}
        </h1>
      </div>

      {/* Events Grid */}
      <div className="tablet:max-w-4xl desktop:max-w-6xl mx-auto max-w-sm">
        {eventsQuery.isLoading ? (
          <EventsGridSkeleton />
        ) : eventsQuery.error ? (
          <ErrorState
            title="Failed to load events"
            message="There was an error loading the events. Please try again."
            onRetry={() => eventsQuery.refetch()}
          />
        ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
          <EventsGrid events={eventsQuery.data} />
        ) : (
          <NoEventsState />
        )}
      </div>
    </div>
  );
}
