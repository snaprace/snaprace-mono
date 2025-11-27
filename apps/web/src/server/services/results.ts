import { ERROR_MESSAGES, trpcError } from "@/server/api/error-utils";
import type { Database, Tables } from "@repo/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type EventRunner = Tables<"event_runners">;
type DatabaseClient = SupabaseClient<Database>;

export type LeaderboardSet = {
  eventSlug: string | null;
  label: string | null;
  distanceKm: number | null;
  distanceMi: number | null;
  total: number;
  results: EventRunner[];
};

export type EventResultsResponse = {
  eventId: string;
  sets: LeaderboardSet[];
};

const UNKNOWN_EVENT_SLUG = "__overall__";

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
    console.error("fetchEventResults failed", error);
    throw trpcError.internal(ERROR_MESSAGES.RESULTS.FETCH_FAILED);
  }

  const rows = (data ?? []) as EventRunner[];

  if (rows.length === 0) {
    if (eventSlug) {
      throw trpcError.notFound(ERROR_MESSAGES.RESULTS.NOT_FOUND);
    }

    return {
      eventId,
      sets: [],
    };
  }

  const grouped = groupByEventSlug(rows);
  const sets: LeaderboardSet[] = Array.from(grouped.entries()).map(
    ([slug, runners]) => ({
      eventSlug: slug === UNKNOWN_EVENT_SLUG ? null : slug,
      label: resolveLabel(runners),
      distanceKm: runners[0]?.event_distance_km ?? null,
      distanceMi: runners[0]?.event_distance_mi ?? null,
      total: runners.length,
      results: runners,
    }),
  );

  return {
    eventId,
    sets,
  };
}

function coerceBibNumber(input: string | number): number {
  const bibNumber = Number(String(input).trim());
  if (!Number.isFinite(bibNumber)) {
    throw trpcError.badRequest("Bib must be a numeric value.");
  }
  return bibNumber;
}

function groupByEventSlug(runners: EventRunner[]) {
  const map = new Map<string, EventRunner[]>();
  runners.forEach((runner) => {
    const slug = runner.event_slug ?? UNKNOWN_EVENT_SLUG;
    if (!map.has(slug)) {
      map.set(slug, []);
    }
    map.get(slug)!.push(runner);
  });
  return map;
}

function resolveLabel(runners: EventRunner[]): string | null {
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

