import axios from "axios";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

// Usage: pnpm --filter @repo/scripts import-runners --organizer_id=ORG_ID --event_id=EVENT_ID --api_url=API_URL

// Load environment variables from apps/web/.env
dotenv.config({ path: path.resolve(__dirname, "../../../apps/web/.env") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Error: Supabase URL or Key not found in environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
  [key: string]: any;
};

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

const parseNumber = (value: any): number | null => {
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
  source_payload: RaceresultItem;
};

const assignDivisionPlaces = (runners: RunnerInsert[]) => {
  const groups = new Map<string, RunnerInsert[]>();

  for (const runner of runners) {
    const key = runner.age_group ?? "__unknown__";
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
  const groups = new Map<string, RunnerInsert[]>();

  for (const runner of runners) {
    const key = runner.event_slug ?? "__overall__";
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

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("organizer_id", { type: "string", demandOption: true })
    .option("event_id", { type: "string", demandOption: true })
    .option("api_url", { type: "string", demandOption: true })
    .help().argv;

  const { organizer_id, event_id, api_url } = argv;

  console.log(`Fetching data from ${api_url}...`);

  try {
    const response = await axios.get(api_url);
    const data: RaceresultItem[] = response.data;

    if (!Array.isArray(data)) {
      throw new Error("API response is not an array");
    }

    console.log(`Fetched ${data.length} records. Processing...`);

    const runners: RunnerInsert[] = data.map((item) => {
      const eventLabel = item.Contest?.trim() || null;
      const eventSlug = slugify(eventLabel);
      const eventDistanceKm = extractDistanceKm(eventLabel);
      const eventDistanceMi =
        eventDistanceKm !== null
          ? Number((eventDistanceKm * KM_TO_MI).toFixed(3))
          : null;

      const chipTimeSeconds = parseTimeToSeconds(
        item["Course Time Chip"]?.trim() ?? null
      );
      const gunTimeSeconds = parseTimeToSeconds(
        item["Course Time Gun"]?.trim() ?? null
      );
      const startTimeSeconds = parseTimeToSeconds(
        item["Start Time"]?.trim() ?? null
      );

      const avgPaceSeconds = calculateAvgPaceSeconds(
        eventLabel,
        chipTimeSeconds
      );

      const hometown = splitHometown(item.Hometown);
      const nameParts = buildNameParts(item.Name);

      return {
        event_id,
        bib_number: parseNumber(item.Bib) ?? 0,
        age: parseNumber(item.Age),
        gender: item.Gender ?? null,
        first_name: nameParts.firstName,
        last_name: nameParts.lastName,
        event_slug: eventSlug,
        event_distance_km: eventDistanceKm,
        event_distance_mi: eventDistanceMi,
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
      };
    });

    assignDivisionPlaces(runners);
    assignOverallPlaces(runners);

    // Upsert data
    // We use upsert based on event_id and bib_number (assuming unique constraint exists)
    const { error } = await supabase
      .from("event_runners")
      .upsert(runners, { onConflict: "event_id,bib_number" });

    if (error) {
      console.error("Error inserting data:", error);
    } else {
      console.log(`Successfully inserted/updated ${runners.length} runners.`);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
