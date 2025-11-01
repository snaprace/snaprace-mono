"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/trpc/react";
import type { Organization } from "@/server/api/routers/organizations";
import { oklch } from "culori";

interface OrganizationContextType {
  organization: Organization | null;
  isLoading: boolean;
  subdomain: string | null;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  isLoading: true,
  subdomain: null,
});

export function OrganizationProvider({
  children,
  subdomain,
  initialOrganization,
}: {
  children: ReactNode;
  subdomain: string | null;
  initialOrganization?: Organization | null;
}) {
  const [organization, setOrganization] = useState<Organization | null>(
    initialOrganization || null
  );

  // Fetch organization data by subdomain (skip if we have initial data)
  const { data, isLoading } = api.organizations.getBySubdomain.useQuery(
    { subdomain: subdomain || "" },
    {
      enabled: !!subdomain && !initialOrganization,
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
      initialData: initialOrganization || undefined,
    },
  );

  useEffect(() => {
    // Use initial organization or fetched data
    const orgData = initialOrganization || data;

    if (orgData) {
      setOrganization(orgData);

      // Only apply styles if they're not already set (client-side navigation)
      // Server-side styles are handled by OrganizationStyles component
      if (!initialOrganization && orgData.branding?.primary_color) {
        // Convert hex to oklch using culori
        const primaryOklchColor = oklch(orgData.branding.primary_color);
        if (primaryOklchColor) {
          // Format oklch values for CSS
          const l = primaryOklchColor.l ?? 0;
          const c = primaryOklchColor.c ?? 0;
          const h = primaryOklchColor.h ?? 0;
          const primaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;

          // Set CSS variables for primary colors
          document.documentElement.style.setProperty("--primary", primaryOklchString);

          // Calculate appropriate foreground color (white or black based on lightness)
          const foregroundColor = l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";
          document.documentElement.style.setProperty("--primary-foreground", foregroundColor);
        }

        // Keep organization-specific variables for custom use
        document.documentElement.style.setProperty(
          "--organization-primary",
          orgData.branding.primary_color,
        );
      }

      if (!initialOrganization && orgData.branding?.secondary_color) {
        // Also convert secondary color to oklch
        const secondaryOklchColor = oklch(orgData.branding.secondary_color);
        if (secondaryOklchColor) {
          const l = secondaryOklchColor.l ?? 0;
          const c = secondaryOklchColor.c ?? 0;
          const h = secondaryOklchColor.h ?? 0;
          const secondaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;

          document.documentElement.style.setProperty("--secondary", secondaryOklchString);
          const secondaryForeground = l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";
          document.documentElement.style.setProperty("--secondary-foreground", secondaryForeground);
        }

        document.documentElement.style.setProperty(
          "--organization-secondary",
          orgData.branding.secondary_color,
        );
      }
    } else if (!initialOrganization) {
      // Reset to default colors when no organization (only on client-side)
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-foreground");
      document.documentElement.style.removeProperty("--secondary");
      document.documentElement.style.removeProperty("--secondary-foreground");
      document.documentElement.style.removeProperty("--organization-primary");
      document.documentElement.style.removeProperty("--organization-secondary");
    }
  }, [data, initialOrganization]);

  return (
    <OrganizationContext.Provider
      value={{ organization, isLoading, subdomain }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider",
    );
  }
  return context;
};
