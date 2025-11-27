"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/trpc/react";
import type { Organizer } from "@/server/services/organizers";
import { oklch } from "culori";

interface OrganizerContextType {
  organizer: Organizer | null;
  isLoading: boolean;
  subdomain: string | null;
}

const OrganizerContext = createContext<OrganizerContextType>({
  organizer: null,
  isLoading: true,
  subdomain: null,
});

export function OrganizerProvider({
  children,
  subdomain,
  initialOrganizer,
}: {
  children: ReactNode;
  subdomain: string | null;
  initialOrganizer?: Organizer | null;
}) {
  const [organizer, setOrganizer] = useState<Organizer | null>(
    initialOrganizer || null,
  );

  // Fetch organizer data by subdomain (skip if we have initial data)
  const { data, isLoading } = api.organizers.getBySubdomain.useQuery(
    { subdomain: subdomain || "" },
    {
      enabled: !!subdomain && !initialOrganizer,
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
      initialData: initialOrganizer || undefined,
    },
  );

  useEffect(() => {
    // Use initial organizer or fetched data
    const orgData = initialOrganizer || data;

    if (orgData) {
      setOrganizer(orgData);

      const primaryColor = orgData?.branding_meta?.branding?.primaryColor;
      const secondaryColor = orgData?.branding_meta?.branding?.secondaryColor;

      // Only apply styles if they're not already set (client-side navigation)
      // Server-side styles are handled by OrganizerStyles component
      if (!initialOrganizer && primaryColor) {
        // Convert hex to oklch using culori
        const primaryOklchColor = oklch(primaryColor);
        if (primaryOklchColor) {
          // Format oklch values for CSS
          const l = primaryOklchColor.l ?? 0;
          const c = primaryOklchColor.c ?? 0;
          const h = primaryOklchColor.h ?? 0;
          const primaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;

          // Set CSS variables for primary colors
          document.documentElement.style.setProperty(
            "--primary",
            primaryOklchString,
          );

          // Calculate appropriate foreground color (white or black based on lightness)
          const foregroundColor =
            l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";
          document.documentElement.style.setProperty(
            "--primary-foreground",
            foregroundColor,
          );
        }

        // Keep organizer-specific variables for custom use
        document.documentElement.style.setProperty(
          "--organizer-primary",
          primaryColor,
        );
      }

      if (!initialOrganizer && secondaryColor) {
        // Also convert secondary color to oklch
        const secondaryOklchColor = oklch(secondaryColor);
        if (secondaryOklchColor) {
          const l = secondaryOklchColor.l ?? 0;
          const c = secondaryOklchColor.c ?? 0;
          const h = secondaryOklchColor.h ?? 0;
          const secondaryOklchString = `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;

          document.documentElement.style.setProperty(
            "--secondary",
            secondaryOklchString,
          );
          const secondaryForeground =
            l > 0.6 ? "oklch(0.1 0 0)" : "oklch(0.98 0 0)";
          document.documentElement.style.setProperty(
            "--secondary-foreground",
            secondaryForeground,
          );
        }

        document.documentElement.style.setProperty(
          "--organizer-secondary",
          secondaryColor,
        );
      }
    } else if (!initialOrganizer) {
      // Reset to default colors when no organizer (only on client-side)
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-foreground");
      document.documentElement.style.removeProperty("--secondary");
      document.documentElement.style.removeProperty("--secondary-foreground");
      document.documentElement.style.removeProperty("--organizer-primary");
      document.documentElement.style.removeProperty("--organizer-secondary");
    }
  }, [data, initialOrganizer]);

  return (
    <OrganizerContext.Provider value={{ organizer, isLoading, subdomain }}>
      {children}
    </OrganizerContext.Provider>
  );
}

export const useOrganizer = () => {
  const context = useContext(OrganizerContext);
  if (!context) {
    throw new Error("useOrganizer must be used within an OrganizerProvider");
  }
  return context;
};
