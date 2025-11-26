import { headers } from "next/headers";
import { LayoutProviders } from "@/components/providers/LayoutProviders";
import { getOrganizerBySubdomainServer } from "@/server/services/organizers-server";
import type { ReactNode } from "react";

export async function OrganizerLoader({ children }: { children: ReactNode }) {
  // Get subdomain from headers (set by middleware)
  const headersList = await headers();
  const subdomain = headersList.get("x-organization");

  // Fetch organizer data on server side if subdomain exists
  let initialOrganizer = null;
  if (subdomain) {
    try {
      initialOrganizer = await getOrganizerBySubdomainServer(subdomain);
    } catch (error) {
      console.error("Failed to fetch organizer:", error);
    }
  }

  return (
    <LayoutProviders subdomain={subdomain} initialOrganizer={initialOrganizer}>
      {children}
    </LayoutProviders>
  );
}

