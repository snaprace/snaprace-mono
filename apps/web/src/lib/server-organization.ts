import { createServerClient } from "@repo/supabase";
import { env } from "@/env";
import type { Organization } from "@/server/api/routers/organizations";

export async function getOrganizationBySubdomain(
  subdomain: string,
): Promise<Organization | null> {
  if (!subdomain) return null;

  const supabase = createServerClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase
      .from("organizers")
      .select("*")
      .eq("subdomain", subdomain)
      .single();

    if (error || !data) {
      // console.error("Error fetching organization by subdomain:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error fetching organization by subdomain:", error);
    return null;
  }
}
