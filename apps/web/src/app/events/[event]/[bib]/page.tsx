import { notFound, redirect } from "next/navigation";
import { getEventById } from "@/server/services/events";
import { BibPageContent } from "./_components/BibPageContent";

export default async function EventBibPage({
  params,
}: {
  params: Promise<{ event: string; bib: string }>;
}) {
  const eventId = (await params).event;
  const bib = (await params).bib;

  if (bib === "null") {
    redirect(`/events/${eventId}`);
  }

  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return <BibPageContent event={event} bib={bib} />;
}
