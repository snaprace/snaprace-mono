"use client";

import { type ReactNode } from "react";
import { TRPCReactProvider } from "@/trpc/react";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import type { Organization } from "@/server/api/routers/organizations";

interface LayoutProvidersProps {
  children: ReactNode;
  subdomain: string | null;
  initialOrganization?: Organization | null;
}

export function LayoutProviders({
  children,
  subdomain,
  initialOrganization
}: LayoutProvidersProps) {
  return (
    <TRPCReactProvider>
      <OrganizationProvider
        subdomain={subdomain}
        initialOrganization={initialOrganization}
      >
        {children}
      </OrganizationProvider>
    </TRPCReactProvider>
  );
}
