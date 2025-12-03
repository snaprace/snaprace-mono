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
 *     --meta_api_url=https://results.raceroster.com/v2/api/events/{eventCode}/sub-events/{subEventId}
 *
 * Example:
 *   pnpm --filter @repo/scripts tsx event-runners/millenniumrunning/import-runners.ts \
 *     --event_id=maudslay-turkey-trot-2025 \
 *     --meta_api_url=https://results.raceroster.com/v2/api/events/ed6uq2eahq9bpsj4/sub-events/246781
 *
 * The script will automatically:
 *   1. Fetch event metadata from meta_api_url
 *   2. Extract resultEventId, subEventId, eventUniqueCode
 *   3. Build results API URL: https://results.raceroster.com/v2/api/result-events/{resultEventId}/sub-events/{subEventId}/results
 *   4. Build detail API URL: https://results.raceroster.com/v2/api/events/{eventUniqueCode}/detail/{runnerId}
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

type RaceRosterMetaResponse = {
  data: {
    id: number; // subEventId
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

type RunnerInsert = {
  event_id: string;
  bib_number: number;
  age: number | null;
  gender: string | null;
  first_name: string | null;
  last_name: string | null;
  event_slug: string | null;
  event_distance_km: number | null;
  event_distance_mi: number | null;
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
  is_relay: boolean;
  source_payload: Record<string, unknown>;
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

function buildResultsApiUrl(resultEventId: number, subEventId: number): string {
  return `${RACEROSTER_BASE}/result-events/${resultEventId}/sub-events/${subEventId}/results`;
}

function buildDetailApiUrl(eventUniqueCode: string, runnerId: string): string {
  return `${RACEROSTER_BASE}/events/${eventUniqueCode}/detail/${runnerId}?v3Cert=true`;
}

// ============================================================================
// API Fetching Functions
// ============================================================================

async function fetchEventMeta(
  metaApiUrl: string
): Promise<RaceRosterMetaResponse["data"]> {
  const response = await api.get<RaceRosterMetaResponse>(metaApiUrl);
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
        `\r  Fetched ${allResults.length}/${expectedCount} runners...`
      );

      if (results.length < limit) {
        break;
      }

      start += limit;
    } catch (error) {
      console.error(`\n  Error fetching start=${start}`);
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
    .option("meta_api_url", {
      type: "string",
      demandOption: true,
      description:
        "RaceRoster event metadata API URL (e.g., https://results.raceroster.com/v2/api/events/{code}/sub-events/{id})",
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

  const { event_id, meta_api_url, concurrency, dry_run } = argv;

  try {
    // 1. Fetch event metadata
    const eventMeta = await fetchEventMeta(meta_api_url);

    console.log(
      `📋 ${eventMeta.name} | ${eventMeta.distanceLabel} | ${eventMeta.resultCount} participants`
    );

    const eventSlug = slugify(eventMeta.name);
    const eventDistanceKm = eventMeta.distanceMeters / 1000;
    const eventDistanceMi = Number((eventDistanceKm * KM_TO_MI).toFixed(3));

    // 2. Build results API URL from metadata
    const resultsApiUrl = buildResultsApiUrl(
      eventMeta.resultEventId,
      eventMeta.id
    );

    // 3. Fetch all results from leaderboard
    console.log(`\n📥 Fetching leaderboard...`);
    const results = await fetchAllResults(resultsApiUrl, eventMeta.resultCount);
    console.log(
      `✅ Fetched ${results.length}/${eventMeta.resultCount} runners`
    );

    if (results.length === 0) {
      console.log("No results found. Exiting.");
      return;
    }

    // 4. Fetch detailed info for each runner (to get bib number) - PARALLEL
    console.log(`\n🔍 Fetching runner details (${concurrency} concurrent)...`);
    const startTime = Date.now();

    const detailResults = await parallelLimit(
      results,
      concurrency,
      async (result) => {
        const detail = await fetchRunnerDetail(
          eventMeta.eventUniqueCode,
          result.id
        );

        if (!detail || !detail.bib) return null;

        const bibNumber = parseNumber(detail.bib);
        if (bibNumber === null) return null;

        const avgPaceSeconds = parsePaceToSeconds(detail.overallPace);

        // Detect relay: check if segments exist or division contains "relay"
        const isRelay = !!(
          detail.segments?.length ||
          detail.division?.toLowerCase().includes("relay")
        );

        return {
          event_id,
          bib_number: bibNumber,
          age: detail.age ?? null,
          gender: normalizeGender(detail.gender),
          first_name: isRelay ? detail.name : detail.firstName || null,
          last_name: isRelay ? null : detail.lastName || null,
          event_slug: eventSlug,
          event_distance_km: eventDistanceKm,
          event_distance_mi: eventDistanceMi,
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
          is_relay: isRelay,
          source_payload: { listItem: result, detail },
        } as RunnerInsert;
      },
      (completed, total) => {
        process.stdout.write(`\r  Progress: ${completed}/${total}`);
      }
    );

    const runners = detailResults.filter((r): r is RunnerInsert => r !== null);
    const failCount = results.length - runners.length;
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `\n✅ Processed: ${runners.length} valid, ${failCount} skipped (${elapsedSec}s)`
    );

    if (runners.length === 0) {
      console.log("No valid runners to insert. Exiting.");
      return;
    }

    // 5. Upsert to Supabase
    if (dry_run) {
      console.log(`\n🧪 [DRY RUN] Would insert ${runners.length} runners`);
      console.log("\nSample:", JSON.stringify(runners[0], null, 2));
      return;
    }

    console.log(`\n💾 Saving to database...`);

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
          `  Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`,
          error.message
        );
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`✅ Done! Inserted: ${insertedCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
