import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getEventById } from "@/server/services/events";
import { EventHeader } from "./_components/EventHeader";

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ event: string }>;
}) {
  const eventId = (await params).event;
  const event = await getEventById({ eventId });

  if (!event) {
    notFound();
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white">
      <EventHeader event={event} />
      {children}
    </div>
  );
}
