import { notFound, redirect } from "next/navigation";
import { setRequestLocale, getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { getEventById } from "@/server/services/events";
import { BibPageContent } from "./_components/BibPageContent";
import { getPhotoMetadata } from "@/server/utils/metadata";

type Props = {
  params: Promise<{ event: string; bib: string }>;
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
  params: Promise<{ event: string; bib: string }>;
}) {
  const { event: eventId, bib } = await params;
  const locale = await getLocale();
  setRequestLocale(locale);

  if (bib === "null") {
    redirect(`/events/${eventId}`);
  }

  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return <BibPageContent event={event} bib={bib} />;
}
