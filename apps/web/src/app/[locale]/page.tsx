import { headers } from "next/headers";
import { createServerClient } from "@repo/supabase";
import { setRequestLocale } from "next-intl/server";
import { env } from "@/env";
import { Footer } from "@/components/Footer";
import { getOrganizerBySubdomainServer } from "@/server/services/organizers-server";
import { listEvents, type Event } from "@/server/services/events";
import { HomeSearch } from "@/app/_components/HomeSearch";
import { getCountryFromLocale, type Locale } from "@/i18n/config";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const headersList = await headers();
  const subdomain = headersList.get("x-organization");

  let organizer = null;
  if (subdomain) {
    organizer = await getOrganizerBySubdomainServer(subdomain);
  }

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  let events: Event[] = [];

  try {
    const country = organizer ? undefined : getCountryFromLocale(locale as Locale);
    events = await listEvents({
      supabase,
      organizationId: organizer?.organizer_id,
      country,
    });
  } catch (error) {
    console.error("Failed to fetch events:", error);
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      <section className="bg-background relative px-4 py-20 sm:py-32">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-foreground mb-12 text-3xl font-semibold tracking-tight whitespace-pre-wrap sm:text-4xl md:text-5xl">
            {organizer?.subdomain
              ? `${organizer.name}\nEvent Photos`
              : "Find your snap"}
          </h1>
          <HomeSearch initialEvents={events} organizer={organizer} />
        </div>
      </section>
      <Footer />
    </div>
  );
}

