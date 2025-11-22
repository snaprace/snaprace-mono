import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { createServerClient } from "@repo/supabase";

import { env } from "@/env";
import { getEventById } from "@/server/services/events";
import { EventHeader } from "./_components/EventHeader";

export default async function EventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ event: string }>;
}) {
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const event = await getEventById({
    supabase,
    eventId: (await params).event,
  });

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
