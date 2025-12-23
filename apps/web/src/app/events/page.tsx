"use client";

import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import EventsGrid from "./_components/EventsGrid";
import { api } from "@/trpc/react";
import { EventsGridSkeleton } from "@/components/states/EventsSkeleton";
import { ErrorState } from "@/components/states/ErrorState";
import { NoEventsState } from "@/components/states/EmptyState";
import { useOrganizer } from "@/contexts/OrganizerContext";
import { getCountryFromLocale, type Locale } from "@/i18n/config";

export default function EventsPage() {
  const t = useTranslations("events");
  const { organizer } = useOrganizer();
  const locale = useLocale() as Locale;
  const country = organizer ? undefined : getCountryFromLocale(locale);

  const eventsQuery = api.events.getAll.useQuery({ country });

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-12 text-center">
        <h1 className="text-foreground mb-4 text-3xl font-bold">
          {organizer ? t("organizerEvents", { name: organizer.name }) : t("title")}
        </h1>
      </div>

      <div className="tablet:max-w-4xl desktop:max-w-6xl mx-auto max-w-sm">
        {eventsQuery.isLoading ? (
          <EventsGridSkeleton />
        ) : eventsQuery.error ? (
          <ErrorState
            title={t("loadError")}
            message={t("loadErrorMessage")}
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
