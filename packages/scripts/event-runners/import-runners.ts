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

interface RaceresultItem {
  Contest: string;
  Bib: number;
  Name: string;
  Hometown: string;
  Age: number;
  Gender: string;
  AG: string;
  "Start Time": string;
  "Finish Time": string;
  Announcer: string;
  "Course Time Chip": string;
  "Course Time Gun": string;
  [key: string]: any;
}

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

    const runners = data.map((item) => {
      // Split Name into first and last name
      // Logic: Assume "First Last" or "Last, First" or just "Full Name"
      // The example "ANA POLANCO" suggests "First Last"
      // "Noah CARIOU" -> Noah (First), CARIOU (Last)
      // "Thomas Barone" -> Thomas (First), Barone (Last)

      let firstName = item.Name;
      let lastName = "";

      const nameParts = item.Name.trim().split(/\s+/);
      if (nameParts.length > 1) {
        // Simple heuristic: Last word is last name, rest is first name
        lastName = nameParts.pop() || "";
        firstName = nameParts.join(" ");
      }

      // Calculate avgPace logic
      // context(Contest)에서 "K"를 제외한 후 숫자로 처리 -> per mile로 avgPace 계산
      let avgPace = "";
      try {
        const contestVal = item.Contest || "";
        if (contestVal.includes("K")) {
          const distanceKm = parseFloat(contestVal.replace("K", "").trim());
          const timeStr = item["Course Time Chip"]; // "MM:SS" or "HH:MM:SS"

          if (!isNaN(distanceKm) && distanceKm > 0 && timeStr) {
            const parts = timeStr
              .split(":")
              .map((p: string) => parseInt(p, 10));
            let totalSeconds = 0;
            if (parts.length === 3) {
              totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
              totalSeconds = parts[0] * 60 + parts[1];
            }

            if (totalSeconds > 0) {
              const distanceMiles = distanceKm * 0.621371;
              const paceSeconds = totalSeconds / distanceMiles;
              const paceMin = Math.floor(paceSeconds / 60);
              const paceSec = Math.round(paceSeconds % 60);
              avgPace = `${paceMin}:${paceSec.toString().padStart(2, "0")}`;
            }
          }
        }
      } catch (e) {
        console.warn(`Error calculating pace for bib ${item.Bib}:`, e);
      }

      // CamelCase keys for timing_result
      const timingResult = {
        contest: item.Contest,
        bib: item.Bib,
        name: item.Name,
        hometown: item.Hometown,
        age: item.Age,
        gender: item.Gender,
        ageGroup: item.AG,
        startTime: item["Start Time"],
        finishTime: item["Finish Time"],
        announcer: item.Announcer,
        courseTimeChip: item["Course Time Chip"],
        courseTimeGun: item["Course Time Gun"],
        avgPace: avgPace,
      };

      return {
        event_id: event_id,
        bib_number: item.Bib,
        first_name: firstName,
        last_name: lastName,
        age: item.Age,
        gender: item.Gender,
        finish_time: item["Course Time Chip"], // Using Chip time as primary finish time
        source: "raceresult",
        timing_result: timingResult,
      };
    });

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
