import { env } from "@/env";
import { createServerClient } from "@repo/supabase";
import { cache } from "react";
import { getOrganizerBySubdomain, type Organizer } from "./organizers";

export type { Organizer };

/**
 * Cached server-side organizer fetch by subdomain
 * Used by Server Components (layout, organizer-loader)
 */
export const getOrganizerBySubdomainServer = cache(
  async (subdomain: string): Promise<Organizer | null> => {
    if (!subdomain) {
      return null;
    }

    const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    try {
      return await getOrganizerBySubdomain({ supabase, subdomain });
    } catch (error) {
      console.error("getOrganizerBySubdomainServer failed:", error);
      return null;
    }
  },
);

