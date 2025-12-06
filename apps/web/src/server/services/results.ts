import { ERROR_MESSAGES, trpcError } from "@/server/api/error-utils";
import type { Database, Tables } from "@repo/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type EventRunner = Tables<"event_runners">;
type DatabaseClient = SupabaseClient<Database>;

export type FinishlineVideoInfo = {
  provider: string;
  url: string;
  providerVideoId: string;
  thumbnail: string | null;
  duration: number;
  status: string;
  firstParticipantGunTime: number;
  firstParticipantVideoTime: number;
  rewindSeconds: number;
};

export type LeaderboardSet = {
  subEventId: string;
  eventSlug: string | null;
  label: string | null;
  distanceKm: number | null;
  distanceMi: number | null;
  isRelay: boolean;
  total: number;
  results: EventRunner[];
  finishlineVideoInfo: FinishlineVideoInfo | null;
};

export type EventResultsResponse = {
  eventId: string;
  sets: LeaderboardSet[];
};

export async function fetchRunnerByBib(options: {
  supabase: DatabaseClient;
  eventId: string;
  bib: string | number;
}): Promise<EventRunner> {
  const { supabase, eventId } = options;
  const bibNumber = coerceBibNumber(options.bib);

  const { data, error } = await supabase
    .from("event_runners")
    .select("*")
    .eq("event_id", eventId)
    .eq("bib_number", bibNumber)
    .maybeSingle();

  if (error) {
    console.error("fetchRunnerByBib failed", error);
    throw trpcError.internal(ERROR_MESSAGES.RESULTS.FETCH_FAILED);
  }

  const runner = (data ?? null) as EventRunner | null;

  if (!runner) {
    throw trpcError.notFound(ERROR_MESSAGES.RESULTS.BIB_NOT_FOUND);
  }

  return runner;
}

export async function fetchEventResults(options: {
  supabase: DatabaseClient;
  eventId: string;
  eventSlug?: string | null;
}): Promise<EventResultsResponse> {
  const { supabase, eventId, eventSlug } = options;

  // 1. Fetch sub_events for this event (ordered by sort_order)
  let subEventsQuery = supabase
    .from("sub_events")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: true });

  if (eventSlug) {
    subEventsQuery = subEventsQuery.eq("slug", eventSlug);
  }

  const { data: subEvents, error: subError } = await subEventsQuery;

  if (subError) {
    console.error("fetchSubEvents failed", subError);
    throw trpcError.internal(ERROR_MESSAGES.RESULTS.FETCH_FAILED);
  }

  // If no sub_events found, fall back to legacy query (backward compatibility)
  if (!subEvents || subEvents.length === 0) {
    return fetchEventResultsLegacy(options);
  }

  // 2. Fetch runners for all sub_events
  const subEventIds = subEvents.map((s) => s.sub_event_id);

  const { data: runners, error: runnersError } = await supabase
    .from("event_runners")
    .select("*")
    .in("sub_event_id", subEventIds)
    .order("chip_time_seconds", { ascending: true, nullsFirst: false })
    .order("bib_number", { ascending: true });

  if (runnersError) {
    console.error("fetchRunners failed", runnersError);
    throw trpcError.internal(ERROR_MESSAGES.RESULTS.FETCH_FAILED);
  }

  // 3. Group runners by sub_event_id
  const runnersBySubEvent = new Map<string, EventRunner[]>();
  (runners ?? []).forEach((r) => {
    if (!r.sub_event_id) return;
    if (!runnersBySubEvent.has(r.sub_event_id)) {
      runnersBySubEvent.set(r.sub_event_id, []);
    }
    runnersBySubEvent.get(r.sub_event_id)!.push(r);
  });

  // 4. Build LeaderboardSets from sub_events (no guessing needed!)
  const sets: LeaderboardSet[] = subEvents.map((subEvent) => ({
    subEventId: subEvent.sub_event_id,
    eventSlug: subEvent.slug,
    label: subEvent.name,
    distanceKm: subEvent.distance_km,
    distanceMi: subEvent.distance_mi,
    isRelay: subEvent.is_relay ?? false,
    total: runnersBySubEvent.get(subEvent.sub_event_id)?.length ?? 0,
    results: runnersBySubEvent.get(subEvent.sub_event_id) ?? [],
    finishlineVideoInfo:
      subEvent.finishline_video_info as FinishlineVideoInfo | null,
  }));

  return { eventId, sets };
}

/**
 * Legacy query for events without sub_events (backward compatibility)
 * This will be deprecated once all events are migrated
 */
async function fetchEventResultsLegacy(options: {
  supabase: DatabaseClient;
  eventId: string;
  eventSlug?: string | null;
}): Promise<EventResultsResponse> {
  const { supabase, eventId, eventSlug } = options;
  const UNKNOWN_EVENT_SLUG = "__overall__";

  let query = supabase
    .from("event_runners")
    .select("*")
    .eq("event_id", eventId)
    .order("chip_time_seconds", { ascending: true, nullsFirst: false })
    .order("bib_number", { ascending: true });

  if (eventSlug) {
    query = query.eq("event_slug", eventSlug);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchEventResultsLegacy failed", error);
    throw trpcError.internal(ERROR_MESSAGES.RESULTS.FETCH_FAILED);
  }

  const rows = (data ?? []) as EventRunner[];

  if (rows.length === 0) {
    if (eventSlug) {
      throw trpcError.notFound(ERROR_MESSAGES.RESULTS.NOT_FOUND);
    }
    return { eventId, sets: [] };
  }

  // Group by event_slug (legacy)
  const grouped = new Map<string, EventRunner[]>();
  rows.forEach((runner) => {
    const slug = runner.event_slug ?? UNKNOWN_EVENT_SLUG;
    if (!grouped.has(slug)) {
      grouped.set(slug, []);
    }
    grouped.get(slug)!.push(runner);
  });

  const sets: LeaderboardSet[] = Array.from(grouped.entries()).map(
    ([slug, runners]) => {
      const first = runners[0];
      const isRelay = runners.some((r) => r.is_relay);

      return {
        subEventId: slug, // Use slug as ID for legacy
        eventSlug: slug === UNKNOWN_EVENT_SLUG ? null : slug,
        label: resolveLegacyLabel(runners),
        distanceKm: first?.event_distance_km ?? null,
        distanceMi: first?.event_distance_mi ?? null,
        isRelay,
        total: runners.length,
        results: runners,
        finishlineVideoInfo: null, // Legacy events don't have video info
      };
    },
  );

  // Sort legacy sets by distance (descending) - Marathon first
  sets.sort((a, b) => {
    const distA = a.distanceKm ?? 0;
    const distB = b.distanceKm ?? 0;
    return distB - distA;
  });

  return { eventId, sets };
}

function resolveLegacyLabel(runners: EventRunner[]): string | null {
  const [first] = runners;
  if (!first) return null;

  const payload = (first.source_payload ?? null) as Record<
    string,
    unknown
  > | null;
  const contestName =
    typeof payload?.Contest === "string" ? payload.Contest : null;
  if (contestName) return contestName;

  if (first.event_slug) {
    return first.event_slug.replace(/-/g, " ");
  }

  if (first.event_distance_km) {
    return `${first.event_distance_km}K`;
  }

  return null;
}

function coerceBibNumber(input: string | number): number {
  const bibNumber = Number(String(input).trim());
  if (!Number.isFinite(bibNumber)) {
    throw trpcError.badRequest("Bib must be a numeric value.");
  }
  return bibNumber;
}
