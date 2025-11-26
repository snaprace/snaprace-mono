"use client";

import { type ReactNode } from "react";
import { TRPCReactProvider } from "@/trpc/react";
import { OrganizerProvider } from "@/contexts/OrganizerContext";
import type { Organizer } from "@/server/services/organizers";

interface LayoutProvidersProps {
  children: ReactNode;
  subdomain: string | null;
  initialOrganizer?: Organizer | null;
}

export function LayoutProviders({
  children,
  subdomain,
  initialOrganizer,
}: LayoutProvidersProps) {
  return (
    <TRPCReactProvider>
      <OrganizerProvider subdomain={subdomain} initialOrganizer={initialOrganizer}>
        {children}
      </OrganizerProvider>
    </TRPCReactProvider>
  );
}
