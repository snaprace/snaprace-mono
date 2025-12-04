import axios from "axios";
import https from "https";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Create axios instance with Keep-Alive for connection reuse
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20, // Allow up to 20 concurrent connections
});

const api = axios.create({
  httpsAgent,
  timeout: 15000, // 15 second timeout
});

/**
 * Millennium Running (RaceRoster) Runner Import Script
 *
 * Usage:
 *   pnpm --filter @repo/scripts tsx event-runners/millenniumrunning/import-runners.ts \
 *     --event_id=EVENT_ID \
 *     --api_url=https://results.raceroster.com/v2/api/events/{eventCode}
 *
 * Example:
 *   pnpm --filter @repo/scripts tsx event-runners/millenniumrunning/import-runners.ts \
 *     --event_id=fisher-cats-thanksgiving-5k-2025 \
 *     --api_url=https://results.raceroster.com/v2/api/events/exhecqdv3uwxy2e4
 *
 * The script will automatically:
 *   1. Fetch event metadata from api_url (includes all sub-events)
 *   2. For each sub-event:
 *      - Create/update sub_event in database
 *      - Fetch all runner results and link them to the sub_event
 */

// Load environment variables from apps/web/.env
const envPath = path.resolve(__dirname, "../../../../apps/web/.env");
dotenv.config({ path: envPath });

// Supabase client will be initialized lazily when needed
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "Error: Supabase URL or Key not found in environment variables."
    );
    console.error(`Tried loading from: ${envPath}`);
    process.exit(1);
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

// ============================================================================
// Types for RaceRoster API responses
// ============================================================================

type RaceRosterSubEventInfo = {
  id: number;
  resultSubEventId: number;
  resultEventId: number;
  eventUniqueCode: string;
  name: string;
  distanceLabel: string;
  distance: number;
  distanceUnit: string;
  distanceMeters: number;
  resultCount: number;
  sortOrder: number;
  settings: {
    isRelayEnabled: boolean;
  };
  isPublic: boolean;
  hasResults: boolean;
};

type RaceRosterEventMetaResponse = {
  data: {
    id: string; // eventUniqueCode
    event: {
      resultEventId: number;
      uniqueCode: string;
      name: string;
      subEvents: RaceRosterSubEventInfo[];
    };
  };
};

type RaceRosterSubEventMetaResponse = {
  data: {
    id: number;
    resultEventId: number;
    eventUniqueCode: string;
    name: string;
    distanceLabel: string;
    distance: number;
    distanceUnit: string;
    distanceMeters: number;
    resultCount: number;
  };
};

type RaceRosterResultItem = {
  id: string;
  overallPlace: number;
  name: string;
  overallPace: string;
  gunTime: string;
  genderSexId: string;
  division: string;
  divisionPlace: string;
  fromCity: string;
  fromProvState: string;
  initials: string;
  hasAward: boolean;
};

type RaceRosterResultsResponse = {
  _id: number;
  data: RaceRosterResultItem[];
};

type RaceRosterDetailResponse = {
  data: {
    result: {
      resultId: number; // Numeric ID needed for video API
      bib: string;
      firstName: string;
      lastName: string;
      name: string;
      gender: string;
      age: number | null;
      gunTimeSec: number | null;
      chipTimeSec: number | null;
      overallPace: string;
      overallPlace: number;
      divisionPlace: number;
      division: string;
      fromCity: string;
      fromProvState: string;
      ageGroup: string | null;
      segments?: Array<{
        label: string;
        time: string;
        timeSec: number;
      }>;
    };
  };
};

// ============================================================================
// Sub Event Types
// ============================================================================

type FinishlineVideoInfo = {
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

type SubEventInsert = {
  event_id: string;
  name: string;
  slug: string;
  distance_km: number | null;
  distance_mi: number | null;
  is_relay: boolean;
  sort_order: number;
  finishline_video_info?: FinishlineVideoInfo | null;
};

type RaceRosterVideoResponse = Array<{
  resultEventId: number;
  subEventId: number;
  segmentId: number | null;
  firstParticipantTimeType: string;
  firstParticipantGunTime: number;
  firstParticipantLocalTime: string | null;
  firstParticipantVideoTime: number;
  participantVideoTime: number;
  provider: string;
  name: string;
  url: string;
  thumbnail: string;
  rewindSeconds: number;
  duration: number;
  status: string;
  providerVideoId: string;
}>;

type RunnerInsert = {
  event_id: string;
  sub_event_id: string;
  bib_number: number;
  age: number | null;
  gender: string | null;
  first_name: string | null;
  last_name: string | null;
  chip_time_seconds: number | null;
  gun_time_seconds: number | null;
  start_time_seconds: number | null;
  avg_pace_seconds: number | null;
  age_group: string | null;
  source: string;
  city: string | null;
  state: string | null;
  division_place: string | null;
  overall_place: number | null;
  source_payload: Record<string, unknown>;
  // Deprecated fields (kept for backward compatibility during transition)
  event_slug: string | null;
  event_distance_km: number | null;
  event_distance_mi: number | null;
  is_relay: boolean;
};

// ============================================================================
// Utility Functions
// ============================================================================

const KM_TO_MI = 0.621371;

const slugify = (value?: string | null): string | null => {
  if (!value) return null;
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || null
  );
};

const parsePaceToSeconds = (pace?: string | null): number | null => {
  if (!pace) return null;
  const trimmed = pace.trim();
  const parts = trimmed.split(":").map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((p) => Number.isNaN(p))) return null;
  return parts[0]! * 60 + parts[1]!;
};

const parseNumber = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const normalizeGender = (gender?: string | null): string | null => {
  if (!gender) return null;
  const lower = gender.toLowerCase();
  if (lower === "male" || lower === "m") return "M";
  if (lower === "female" || lower === "f") return "F";
  return gender;
};

// Parallel execution with concurrency limit
async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex]!, currentIndex);
      completed++;
      onProgress?.(completed, items.length);
    }
  }

  const workers = Array(Math.min(limit, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

// ============================================================================
// API URL Builders
// ============================================================================

const RACEROSTER_BASE = "https://results.raceroster.com/v2/api";

function buildSubEventMetaUrl(
  eventUniqueCode: string,
  subEventId: number
): string {
  return `${RACEROSTER_BASE}/events/${eventUniqueCode}/sub-events/${subEventId}`;
}

function buildResultsApiUrl(resultEventId: number, subEventId: number): string {
  return `${RACEROSTER_BASE}/result-events/${resultEventId}/sub-events/${subEventId}/results`;
}

function buildDetailApiUrl(eventUniqueCode: string, runnerId: string): string {
  return `${RACEROSTER_BASE}/events/${eventUniqueCode}/detail/${runnerId}?v3Cert=true`;
}

function buildVideoApiUrl(subEventId: number, resultId: string): string {
  return `${RACEROSTER_BASE}/videos?subEventId=${subEventId}&resultId=${resultId}`;
}

// ============================================================================
// API Fetching Functions
// ============================================================================

async function fetchEventMeta(
  apiUrl: string
): Promise<RaceRosterEventMetaResponse["data"]> {
  const response = await api.get<RaceRosterEventMetaResponse>(apiUrl);
  return response.data.data;
}

async function fetchSubEventMeta(
  metaApiUrl: string
): Promise<RaceRosterSubEventMetaResponse["data"]> {
  const response = await api.get<RaceRosterSubEventMetaResponse>(metaApiUrl);
  return response.data.data;
}

async function fetchAllResults(
  resultsApiUrl: string,
  expectedCount: number
): Promise<RaceRosterResultItem[]> {
  const allResults: RaceRosterResultItem[] = [];
  const limit = 250;
  let start = 0;

  while (start < expectedCount) {
    const url = `${resultsApiUrl}?filter_search=&start=${start}&limit=${limit}`;

    try {
      const response = await api.get<RaceRosterResultsResponse>(url);
      const results = response.data.data;

      if (!results || results.length === 0) {
        break;
      }

      allResults.push(...results);
      process.stdout.write(
        `\r    Fetched ${allResults.length}/${expectedCount} runners...`
      );

      if (results.length < limit) {
        break;
      }

      start += limit;
    } catch (error) {
      console.error(`\n    Error fetching start=${start}`);
      if (axios.isAxiosError(error)) {
        console.error(`    Status: ${error.response?.status}`);
        console.error(`    URL: ${url}`);
        console.error(`    Data:`, error.response?.data);
      } else {
        console.error(`    Error:`, error);
      }
      break;
    }
  }

  console.log(); // New line after progress
  return allResults;
}

async function fetchRunnerDetail(
  eventUniqueCode: string,
  runnerId: string
): Promise<RaceRosterDetailResponse["data"]["result"] | null> {
  const url = buildDetailApiUrl(eventUniqueCode, runnerId);

  try {
    const response = await api.get<RaceRosterDetailResponse>(url);
    return response.data.data.result;
  } catch {
    return null;
  }
}

/**
 * Fetch finish line video info for a sub-event
 * Requires numeric resultId from detail API response
 */
async function fetchVideoInfo(
  subEventId: number,
  numericResultId: number
): Promise<FinishlineVideoInfo | null> {
  const url = buildVideoApiUrl(subEventId, String(numericResultId));

  try {
    const response = await api.get<RaceRosterVideoResponse>(url);
    const videos = response.data;

    if (!videos || videos.length === 0) {
      return null;
    }

    // Take the first video (usually there's only one)
    const video = videos[0]!;

    if (video.status !== "enabled") {
      return null;
    }

    return {
      provider: video.provider,
      url: video.url,
      providerVideoId: video.providerVideoId,
      thumbnail: video.thumbnail || null,
      duration: video.duration,
      status: video.status,
      firstParticipantGunTime: video.firstParticipantGunTime,
      firstParticipantVideoTime: video.firstParticipantVideoTime,
      rewindSeconds: video.rewindSeconds,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Sub Event Management
// ============================================================================

/**
 * Creates or updates a sub_event and returns its ID
 */
async function upsertSubEvent(subEvent: SubEventInsert): Promise<string> {
  const client = getSupabaseClient();

  // Try to find existing sub_event
  const { data: existing } = await (client.from("sub_events") as any)
    .select("sub_event_id")
    .eq("event_id", subEvent.event_id)
    .eq("slug", subEvent.slug)
    .maybeSingle();

  if (existing) {
    // Update existing
    const updateData: Record<string, unknown> = {
      name: subEvent.name,
      distance_km: subEvent.distance_km,
      distance_mi: subEvent.distance_mi,
      is_relay: subEvent.is_relay,
      sort_order: subEvent.sort_order,
    };

    // Only update video info if provided
    if (subEvent.finishline_video_info !== undefined) {
      updateData.finishline_video_info = subEvent.finishline_video_info;
    }

    const { error } = await (client.from("sub_events") as any)
      .update(updateData)
      .eq("sub_event_id", (existing as any).sub_event_id);

    if (error) {
      console.error("SubEvent update failed:", error.message);
      throw error;
    }

    return (existing as any).sub_event_id;
  }

  // Insert new
  const { data, error } = await (client.from("sub_events") as any)
    .insert(subEvent)
    .select("sub_event_id")
    .single();

  if (error) {
    console.error("SubEvent insert failed:", error.message);
    throw error;
  }

  return (data as any).sub_event_id;
}

// ============================================================================
// Process Single Sub-Event
// ============================================================================

async function processSubEvent(options: {
  eventId: string;
  eventUniqueCode: string;
  subEventInfo: RaceRosterSubEventInfo;
  sortOrderIndex: number;
  concurrency: number;
  dryRun: boolean;
}): Promise<{ inserted: number; errors: number }> {
  const {
    eventId,
    eventUniqueCode,
    subEventInfo,
    sortOrderIndex,
    concurrency,
    dryRun,
  } = options;

  console.log(
    `\n  📋 ${subEventInfo.name} | ${subEventInfo.distanceLabel} | ${subEventInfo.resultCount} participants`
  );

  // Skip if no results
  if (!subEventInfo.hasResults || subEventInfo.resultCount === 0) {
    console.log(`    ⏭️  Skipping - no results`);
    return { inserted: 0, errors: 0 };
  }

  const eventSlug = slugify(subEventInfo.name)!;
  const eventDistanceKm = subEventInfo.distanceMeters / 1000;
  const eventDistanceMi = Number((eventDistanceKm * KM_TO_MI).toFixed(3));

  // Detect relay from settings or name
  const isRelay =
    subEventInfo.settings?.isRelayEnabled ||
    subEventInfo.name.toLowerCase().includes("relay");

  // 1. Create/Update SubEvent
  const subEventData: SubEventInsert = {
    event_id: eventId,
    name: subEventInfo.name,
    slug: eventSlug,
    distance_km: eventDistanceKm,
    distance_mi: eventDistanceMi,
    is_relay: isRelay,
    sort_order: sortOrderIndex,
  };

  let subEventId: string;

  if (dryRun) {
    console.log(`    [DRY RUN] Would create sub-event:`, subEventData);
    subEventId = "dry-run-sub-event-id";
  } else {
    subEventId = await upsertSubEvent(subEventData);
    console.log(`    ✅ SubEvent: ${subEventId}`);
  }

  // 2. Fetch all results
  const resultsApiUrl = buildResultsApiUrl(
    subEventInfo.resultEventId,
    subEventInfo.id
  );

  console.log(`    📥 Fetching leaderboard...`);
  const results = await fetchAllResults(
    resultsApiUrl,
    subEventInfo.resultCount
  );

  if (results.length === 0) {
    console.log(`    ⚠️  No results fetched`);
    return { inserted: 0, errors: 0 };
  }

  // 3. Fetch detailed info for each runner - PARALLEL
  console.log(`    🔍 Fetching runner details (${concurrency} concurrent)...`);
  const startTime = Date.now();

  const detailResults = await parallelLimit(
    results,
    concurrency,
    async (result) => {
      const detail = await fetchRunnerDetail(eventUniqueCode, result.id);

      if (!detail || !detail.bib) return null;

      const bibNumber = parseNumber(detail.bib);
      if (bibNumber === null) return null;

      const avgPaceSeconds = parsePaceToSeconds(detail.overallPace);

      // Detect relay for individual runner (segments or division name)
      const runnerIsRelay = !!(
        detail.segments?.length ||
        detail.division?.toLowerCase().includes("relay")
      );

      return {
        event_id: eventId,
        sub_event_id: subEventId,
        bib_number: bibNumber,
        age: detail.age ?? null,
        gender: normalizeGender(detail.gender),
        first_name: runnerIsRelay ? detail.name : detail.firstName || null,
        last_name: runnerIsRelay ? null : detail.lastName || null,
        chip_time_seconds:
          detail.chipTimeSec != null ? Math.round(detail.chipTimeSec) : null,
        gun_time_seconds:
          detail.gunTimeSec != null ? Math.round(detail.gunTimeSec) : null,
        start_time_seconds: null,
        avg_pace_seconds: avgPaceSeconds,
        age_group: detail.ageGroup ?? detail.division ?? null,
        source: "raceroster",
        city: detail.fromCity || null,
        state: detail.fromProvState || null,
        division_place: String(detail.divisionPlace) || null,
        overall_place: detail.overallPlace ?? null,
        source_payload: { listItem: result, detail },
        // Deprecated fields (for backward compatibility)
        event_slug: eventSlug,
        event_distance_km: eventDistanceKm,
        event_distance_mi: eventDistanceMi,
        is_relay: runnerIsRelay,
      } as RunnerInsert;
    },
    (completed, total) => {
      process.stdout.write(`\r    Progress: ${completed}/${total}`);
    }
  );

  const runners = detailResults.filter((r): r is RunnerInsert => r !== null);
  const failCount = results.length - runners.length;
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `\n    ✅ Processed: ${runners.length} valid, ${failCount} skipped (${elapsedSec}s)`
  );

  if (runners.length === 0) {
    return { inserted: 0, errors: 0 };
  }

  // 3.5. Fetch finish line video info (using first runner's numeric resultId)
  const firstRunnerPayload = runners[0]?.source_payload as {
    detail?: { resultId?: number };
  } | null;
  const numericResultId = firstRunnerPayload?.detail?.resultId;

  if (numericResultId && !dryRun) {
    const videoInfo = await fetchVideoInfo(subEventInfo.id, numericResultId);

    if (videoInfo) {
      console.log(`    🎬 Finish video found: ${videoInfo.provider}`);
      const client = getSupabaseClient();
      await (client.from("sub_events") as any)
        .update({ finishline_video_info: videoInfo })
        .eq("sub_event_id", subEventId);
    }
  }

  // 4. Upsert to Supabase
  if (dryRun) {
    console.log(`    🧪 [DRY RUN] Would insert ${runners.length} runners`);
    return { inserted: runners.length, errors: 0 };
  }

  console.log(`    💾 Saving to database...`);

  const client = getSupabaseClient();
  const BATCH_SIZE = 500;
  let insertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < runners.length; i += BATCH_SIZE) {
    const batch = runners.slice(i, i + BATCH_SIZE);
    const { error } = await client
      .from("event_runners")
      .upsert(batch as any, { onConflict: "event_id,bib_number" });

    if (error) {
      errorCount += batch.length;
      console.error(
        `    Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
        error.message
      );
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(`    ✅ Saved: ${insertedCount}, Errors: ${errorCount}`);

  return { inserted: insertedCount, errors: errorCount };
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("event_id", {
      type: "string",
      demandOption: true,
      description: "Supabase event_id to store runners under",
    })
    .option("api_url", {
      type: "string",
      demandOption: true,
      description:
        "RaceRoster event API URL (e.g., https://results.raceroster.com/v2/api/events/{eventCode})",
    })
    .option("concurrency", {
      type: "number",
      default: 10,
      description: "Number of concurrent API calls for fetching runner details",
    })
    .option("dry_run", {
      type: "boolean",
      default: false,
      description: "If true, do not insert into database",
    })
    .help().argv;

  const { event_id, api_url, concurrency, dry_run } = argv;

  try {
    // 1. Fetch event metadata (includes all sub-events)
    console.log(`\n📡 Fetching event metadata from ${api_url}...`);
    const eventMeta = await fetchEventMeta(api_url);

    const eventName = eventMeta.event.name;
    const subEvents = eventMeta.event.subEvents || [];
    const eventUniqueCode = eventMeta.event.uniqueCode;

    console.log(`📋 Event: ${eventName}`);
    console.log(`📁 Found ${subEvents.length} sub-events:`);

    // Filter public sub-events with results and sort by sortOrder
    const validSubEvents = subEvents
      .filter((se) => se.isPublic && se.hasResults)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    validSubEvents.forEach((se, index) => {
      console.log(
        `  ${index + 1}. ${se.name} (${se.resultCount} runners) [sortOrder: ${se.sortOrder}]`
      );
    });

    if (validSubEvents.length === 0) {
      console.log("No valid sub-events found. Exiting.");
      return;
    }

    // 2. Process each sub-event
    console.log(`\n🚀 Processing ${validSubEvents.length} sub-events...`);

    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < validSubEvents.length; i++) {
      const subEventInfo = validSubEvents[i]!;

      const { inserted, errors } = await processSubEvent({
        eventId: event_id,
        eventUniqueCode,
        subEventInfo,
        sortOrderIndex: i, // Use index as sort order (0, 1, 2, ...)
        concurrency,
        dryRun: dry_run,
      });

      totalInserted += inserted;
      totalErrors += errors;
    }

    // 3. Summary
    console.log(`\n${"=".repeat(50)}`);
    console.log(`✅ All done!`);
    console.log(`   Sub-events processed: ${validSubEvents.length}`);
    console.log(`   Total runners inserted: ${totalInserted}`);
    console.log(`   Total errors: ${totalErrors}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
