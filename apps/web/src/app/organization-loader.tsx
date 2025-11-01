import { headers } from 'next/headers';
import { LayoutProviders } from "@/components/providers/LayoutProviders";
import { getOrganizationBySubdomain } from "@/lib/server-organization";
import type { ReactNode } from "react";

export async function OrganizationLoader({ children }: { children: ReactNode }) {
  // Get subdomain from headers (set by middleware)
  const headersList = await headers();
  const subdomain = headersList.get('x-organization');

  // Fetch organization data on server side if subdomain exists
  let initialOrganization = null;
  if (subdomain) {
    try {
      initialOrganization = await getOrganizationBySubdomain(subdomain);
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    }
  }

  return (
    <LayoutProviders
      subdomain={subdomain}
      initialOrganization={initialOrganization}
    >
      {children}
    </LayoutProviders>
  );
}