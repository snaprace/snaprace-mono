import { env } from "@/env";
import { ERROR_MESSAGES, trpcError } from "@/server/api/error-utils";
import { createServerClient, type Database, type Tables } from "@repo/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import z from "zod";

type DatabaseClient = SupabaseClient<Database>;

export const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  siteUrl: z.string(),
  imageUrl: z.string(),
});

export const PartnersSchema = z.array(PartnerSchema);
export type Partners = z.infer<typeof PartnersSchema>;

export type Event = Omit<Tables<"events">, "partners"> & {
  partners: Partners | null;
};

export async function listEvents(options: {
  supabase: DatabaseClient;
  organizationId?: string | null;
}): Promise<Event[]> {
  const { supabase, organizationId } = options;

  let query = supabase
    .from("events")
    .select("*")
    .eq("is_active", true)
    .order("event_date", { ascending: false, nullsFirst: false });

  if (organizationId) {
    query = query.eq("organizer_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("listEvents failed", error);
    throw trpcError.internal(ERROR_MESSAGES.EVENT.LIST_FAILED);
  }

  return (data ?? []) as Event[];
}

export const getEventById = cache(
  async (options: { eventId: string }): Promise<Event | null> => {
    const supabase = createServerClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
    );
    const { eventId } = options;

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("getEventById failed", error);
      throw trpcError.internal(ERROR_MESSAGES.EVENT.FETCH_FAILED);
    }

    if (!data) {
      return null;
    }

    return data as Event;
  },
);
