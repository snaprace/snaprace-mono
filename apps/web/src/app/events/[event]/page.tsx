import { getEventById } from "@/server/services/events";
import { notFound } from "next/navigation";
import { EventPageContent } from "./_components/EventPageContent";
import { PartnerBanner } from "./_components/PartnerBanner";
import type { Metadata } from "next";
import { getPhotoMetadata } from "@/server/utils/metadata";

type Props = {
  params: Promise<{ event: string }>;
  searchParams: Promise<{ pid?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const eventId = (await params).event;
  const { pid } = await searchParams;

  if (!pid) {
    return {};
  }

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

export default async function EventPage({
  params,
}: {
  params: Promise<{ event: string }>;
}) {
  const eventId = (await params).event;

  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  const partners = event.partners;

  return (
    <>
      {partners && <PartnerBanner partners={partners} />}
      <EventPageContent event={event} organizerId={event.organizer_id} />
    </>
  );
}
