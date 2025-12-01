import { headers } from "next/headers";
import { createServerClient } from "@repo/supabase";
import { env } from "@/env";
import { Footer } from "@/components/Footer";
import { getOrganizerBySubdomainServer } from "@/server/services/organizers-server";
import { listEvents, type Event } from "@/server/services/events";
import { HomeSearch } from "./_components/HomeSearch";

export default async function HomePage() {
  const headersList = await headers();
  const subdomain = headersList.get("x-organization");

  // Organizer Fetching
  let organizer = null;
  if (subdomain) {
    organizer = await getOrganizerBySubdomainServer(subdomain);
  }

  // Events Fetching
  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  let events: Event[] = [];

  try {
    events = await listEvents({
      supabase,
      organizationId: organizer?.organizer_id,
    });
  } catch (error) {
    console.error("Failed to fetch events:", error);
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      {/* Hero Section */}
      <section className="bg-background relative px-4 py-20 sm:py-32">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-foreground mb-12 text-3xl font-semibold tracking-tight whitespace-pre-wrap sm:text-4xl md:text-5xl">
            {organizer?.subdomain
              ? `${organizer.name}\nEvent Photos`
              : "Find your snap"}
          </h1>

          {/* Main Search Component (Client) */}
          <HomeSearch initialEvents={events} organizer={organizer} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
