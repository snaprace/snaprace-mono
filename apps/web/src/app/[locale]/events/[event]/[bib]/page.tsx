import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getEventById } from "@/server/services/events";
import { BibPageContent } from "./_components/BibPageContent";
import { getPhotoMetadata } from "@/server/utils/metadata";

type Props = {
  params: Promise<{ event: string; bib: string; locale: string }>;
  searchParams: Promise<{ pid?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { pid } = await searchParams;

  if (!pid) {
    return {};
  }

  const eventId = (await params).event;
  const event = await getEventById({ eventId });

  if (!event) {
    return {};
  }

  const photoMetadata = await getPhotoMetadata({
    organizerId: event.organizer_id,
    eventId,
    pid,
  });

  return photoMetadata || {};
}

export default async function EventBibPage({
  params,
}: {
  params: Promise<{ event: string; bib: string; locale: string }>;
}) {
  const { event: eventId, bib, locale } = await params;
  setRequestLocale(locale);

  if (bib === "null") {
    redirect(`/${locale}/events/${eventId}`);
  }

  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return <BibPageContent event={event} bib={bib} />;
}
