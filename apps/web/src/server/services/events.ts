import { env } from "@/env";
import { ERROR_MESSAGES, trpcError } from "@/server/api/error-utils";
import { createServerClient, type Database, type Tables } from "@repo/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

type EventRow = Tables<"events">;
type DatabaseClient = SupabaseClient<Database>;

export async function listEvents(options: {
  supabase: DatabaseClient;
  organizationId?: string | null;
}): Promise<EventRow[]> {
  const { supabase, organizationId } = options;

  let query = supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: false, nullsFirst: false });

  if (organizationId) {
    query = query.eq("organizer_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("listEvents failed", error);
    throw trpcError.internal(ERROR_MESSAGES.EVENT.LIST_FAILED);
  }

  return data ?? [];
}

export const getEventById = cache(
  async (options: { eventId: string }): Promise<EventRow | null> => {
    const supabase = createServerClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
    );
    const { eventId } = options;

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      console.error("getEventById failed", error);
      throw trpcError.internal(ERROR_MESSAGES.EVENT.FETCH_FAILED);
    }

    if (!data) {
      return null;
    }

    return data;
  },
);
