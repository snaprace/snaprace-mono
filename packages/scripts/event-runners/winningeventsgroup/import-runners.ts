import axios from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

/**
 * WinningEventsGroup (RaceResult) Runner Import Script
 *
 * Usage:
 *   pnpm --filter @repo/scripts tsx event-runners/winningeventsgroup/import-runners.ts \
 *     --event_id=EVENT_ID \
 *     --api_url=API_URL
 *
 * This script will automatically:
 *   1. Fetch all results from the RaceResult API
 *   2. Group runners by Contest (category)
 *   3. Create sub_events for each unique Contest
 *   4. Link runners to their respective sub_events
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
// Types
// ============================================================================

type RaceresultItem = {
  Contest?: string;
  Bib?: number;
  Name?: string;
  Hometown?: string;
  Age?: number;
  Gender?: string;
  AG?: string;
  "Start Time"?: string;
  "Finish Time"?: string;
  Announcer?: string;
  "Course Time Chip"?: string;
  "Course Time Gun"?: string;
  [key: string]: unknown;
};

type SubEventInsert = {
  event_id: string;
  name: string;
  slug: string;
  distance_km: number | null;
  distance_mi: number | null;
  is_relay: boolean;
  sort_order: number;
};

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
  source_payload: RaceresultItem;
  // Deprecated fields (for backward compatibility)
  event_slug: string | null;
  event_distance_km: number | null;
  event_distance_mi: number | null;
  is_relay: boolean;
};

// ============================================================================
// Utility Functions
// ============================================================================

const KM_TO_MI = 0.621371;

const slugify = (value?: string | null) => {
  if (!value) return null;
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || null
  );
};

const parseTimeToSeconds = (value?: string | null) => {
  if (!value) return null;
  const parts = value.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return null;

  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  }

  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!;
  }

  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

const extractDistanceKm = (contest?: string | null) => {
  if (!contest) return null;
  const match = contest.match(/([\d.]+)\s*K/i);
  if (match) {
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
};

const calculateAvgPaceSeconds = (
  contest?: string | null,
  chipTimeSeconds?: number | null
) => {
  const distanceKm = extractDistanceKm(contest ?? null);
  if (!distanceKm || !chipTimeSeconds || chipTimeSeconds <= 0) return null;

  const distanceMiles = distanceKm * KM_TO_MI;
  if (!distanceMiles) return null;

  const seconds = chipTimeSeconds / distanceMiles;
  if (!Number.isFinite(seconds)) return null;

  return Math.round(seconds);
};

const splitHometown = (hometown?: string | null) => {
  if (!hometown) return { city: null, state: null };
  const [cityPart, statePart] = hometown.split(",").map((part) => part.trim());
  return {
    city: cityPart || null,
    state: statePart || null,
  };
};

const buildNameParts = (fullName?: string | null) => {
  if (!fullName) {
    return { firstName: null, lastName: null };
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: null, lastName: null };
  }

  const nameParts = trimmed.split(/\s+/);
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: null };
  }

  const lastName = nameParts.pop() || null;
  const firstName = nameParts.join(" ") || null;
  return { firstName, lastName };
};

/**
 * Get sort order based on distance (Marathon first, then by distance descending)
 */
function getDistanceSortOrder(distanceKm: number | null): number {
  if (!distanceKm) return 999;

  // Marathon (42.195km) → 1
  // Half Marathon (21.0975km) → 2
  // 10K → 3
  // 5K → 4
  // etc.
  if (distanceKm >= 40) return 1; // Marathon
  if (distanceKm >= 20) return 2; // Half Marathon
  if (distanceKm >= 10) return 3; // 10K
  if (distanceKm >= 5) return 4; // 5K
  if (distanceKm >= 1) return 5; // 1K

  return 10;
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
  const { data: existing } = await (client
    .from("sub_events") as any)
    .select("sub_event_id")
    .eq("event_id", subEvent.event_id)
    .eq("slug", subEvent.slug)
    .maybeSingle();

  if (existing) {
    // Update existing
    const updateData = {
      name: subEvent.name,
      distance_km: subEvent.distance_km,
      distance_mi: subEvent.distance_mi,
      is_relay: subEvent.is_relay,
      sort_order: subEvent.sort_order,
    };
    const { error } = await (client
      .from("sub_events") as any)
      .update(updateData)
      .eq("sub_event_id", (existing as any).sub_event_id);

    if (error) {
      console.error("SubEvent update failed:", error.message);
      throw error;
    }

    return (existing as any).sub_event_id;
  }

  // Insert new
  const { data, error } = await (client
    .from("sub_events") as any)
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
// Runner Processing
// ============================================================================

const assignDivisionPlaces = (runners: RunnerInsert[]) => {
  // Group by sub_event_id + age_group
  const groups = new Map<string, RunnerInsert[]>();

  for (const runner of runners) {
    const key = `${runner.sub_event_id}__${runner.age_group ?? "__unknown__"}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(runner);
  }

  groups.forEach((group) => {
    const sortable = group
      .filter((runner) => runner.chip_time_seconds !== null)
      .sort(
        (a, b) =>
          (a.chip_time_seconds ?? Number.MAX_SAFE_INTEGER) -
          (b.chip_time_seconds ?? Number.MAX_SAFE_INTEGER)
      );

    sortable.forEach((runner, index) => {
      runner.division_place = String(index + 1);
    });
  });
};

const assignOverallPlaces = (runners: RunnerInsert[]) => {
  // Group by sub_event_id
  const groups = new Map<string, RunnerInsert[]>();

  for (const runner of runners) {
    const key = runner.sub_event_id;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(runner);
  }

  groups.forEach((group) => {
    const sortable = group
      .filter((runner) => runner.chip_time_seconds !== null)
      .sort(
        (a, b) =>
          (a.chip_time_seconds ?? Number.MAX_SAFE_INTEGER) -
          (b.chip_time_seconds ?? Number.MAX_SAFE_INTEGER)
      );

    sortable.forEach((runner, index) => {
      runner.overall_place = index + 1;
    });
  });
};

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
      description: "RaceResult API URL to fetch results from",
    })
    .option("dry_run", {
      type: "boolean",
      default: false,
      description: "If true, do not insert into database",
    })
    .help().argv;

  const { event_id, api_url, dry_run } = argv;

  console.log(`\n📡 Fetching data from ${api_url}...`);

  try {
    const response = await axios.get(api_url);
    const data: RaceresultItem[] = response.data;

    if (!Array.isArray(data)) {
      throw new Error("API response is not an array");
    }

    console.log(`✅ Fetched ${data.length} records.`);

    // 1. Group raw data by Contest (category)
    const contestGroups = new Map<string, RaceresultItem[]>();
    data.forEach((item) => {
      const contest = item.Contest?.trim() || "__default__";
      if (!contestGroups.has(contest)) {
        contestGroups.set(contest, []);
      }
      contestGroups.get(contest)!.push(item);
    });

    console.log(`\n📁 Found ${contestGroups.size} categories:`);
    contestGroups.forEach((items, contest) => {
      console.log(`  - ${contest}: ${items.length} runners`);
    });

    // 2. Create sub_events for each Contest
    console.log(`\n📁 Creating/updating sub-events...`);

    const subEventMap = new Map<string, string>(); // contest -> sub_event_id
    const subEventMetaMap = new Map<
      string,
      { distanceKm: number | null; distanceMi: number | null; isRelay: boolean }
    >();

    // Sort contests by distance (Marathon first)
    const sortedContests = Array.from(contestGroups.keys()).sort((a, b) => {
      const distA = extractDistanceKm(a);
      const distB = extractDistanceKm(b);
      return getDistanceSortOrder(distA) - getDistanceSortOrder(distB);
    });

    for (let i = 0; i < sortedContests.length; i++) {
      const contest = sortedContests[i]!;
      const slug = slugify(contest) || "default";
      const distanceKm = extractDistanceKm(contest);
      const distanceMi =
        distanceKm !== null ? Number((distanceKm * KM_TO_MI).toFixed(3)) : null;
      const isRelay = contest.toLowerCase().includes("relay");

      const subEventData: SubEventInsert = {
        event_id,
        name: contest === "__default__" ? "General" : contest,
        slug,
        distance_km: distanceKm,
        distance_mi: distanceMi,
        is_relay: isRelay,
        sort_order: i, // Auto-assign sort order based on distance
      };

      if (dry_run) {
        console.log(`  [DRY RUN] Would create: ${contest} (sort: ${i})`);
        subEventMap.set(contest, `dry-run-${slug}`);
      } else {
        const subEventId = await upsertSubEvent(subEventData);
        console.log(`  ✅ ${contest} → ${subEventId}`);
        subEventMap.set(contest, subEventId);
      }

      subEventMetaMap.set(contest, { distanceKm, distanceMi, isRelay });
    }

    // 3. Process runners with sub_event_id
    console.log(`\n🔄 Processing runners...`);

    const runners: RunnerInsert[] = data.map((item) => {
      const contest = item.Contest?.trim() || "__default__";
      const subEventId = subEventMap.get(contest)!;
      const meta = subEventMetaMap.get(contest)!;

      const eventSlug = slugify(contest);

      const chipTimeSeconds = parseTimeToSeconds(
        item["Course Time Chip"]?.trim() ?? null
      );
      const gunTimeSeconds = parseTimeToSeconds(
        item["Course Time Gun"]?.trim() ?? null
      );
      const startTimeSeconds = parseTimeToSeconds(
        item["Start Time"]?.trim() ?? null
      );

      const avgPaceSeconds = calculateAvgPaceSeconds(contest, chipTimeSeconds);

      const hometown = splitHometown(item.Hometown);
      const nameParts = buildNameParts(item.Name);

      return {
        event_id,
        sub_event_id: subEventId,
        bib_number: parseNumber(item.Bib) ?? 0,
        age: parseNumber(item.Age),
        gender: item.Gender ?? null,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
        chip_time_seconds: chipTimeSeconds,
        gun_time_seconds: gunTimeSeconds,
        start_time_seconds: startTimeSeconds,
        avg_pace_seconds: avgPaceSeconds,
        age_group: item.AG ?? null,
        source: "raceresult",
        city: hometown.city,
        state: hometown.state,
        division_place: null,
        overall_place: null,
        source_payload: item,
        // Deprecated fields (for backward compatibility)
        event_slug: eventSlug,
        event_distance_km: meta.distanceKm,
        event_distance_mi: meta.distanceMi,
        is_relay: meta.isRelay,
      };
    });

    // 4. Assign division and overall places
    assignDivisionPlaces(runners);
    assignOverallPlaces(runners);

    // 5. Upsert to Supabase
    if (dry_run) {
      console.log(`\n🧪 [DRY RUN] Would insert ${runners.length} runners`);
      console.log("\nSample:", JSON.stringify(runners[0], null, 2));
      return;
    }

    console.log(`\n💾 Saving ${runners.length} runners to database...`);

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
