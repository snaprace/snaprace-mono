import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node fetch-raceroster-data.js <eventUniqueCode> <outputDir> [--sub-events all|<comma-separated-ids>]');
    console.error('Example: node fetch-raceroster-data.js dutbkx7e2epftx4x ./raceroster --sub-events all');
    process.exit(1);
  }

  const eventUniqueCode = args[0];
  const outputDir = args[1];

  const subEventsIndex = args.indexOf('--sub-events');
  let subEvents = 'all';

  if (subEventsIndex !== -1 && args[subEventsIndex + 1]) {
    subEvents = args[subEventsIndex + 1];
  }

  return {
    eventUniqueCode,
    outputDir: path.resolve(outputDir),
    subEvents
  };
}

// Configuration from command line arguments
const CONFIG = parseArguments();

// Ensure output directory exists
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}

// Progress tracking
let processedCount = 0;
let totalCount = 0;

function logProgress(message) {
  processedCount++;
  console.log(`[${processedCount}/${totalCount}] ${message}`);
}

// Function to fetch event data and sub-events
async function fetchEventData(eventUniqueCode) {
  const url = `https://results.raceroster.com/v2/api/events/${eventUniqueCode}`;

  console.log(`Fetching event data from: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log(`✅ Fetched event: ${data.data.event.name}`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching event data:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Function to filter sub-events based on configuration
function filterSubEvents(subEvents, config) {
  if (config.subEvents === 'all') {
    return subEvents.filter(subEvent => subEvent.hasResults && subEvent.isPublic);
  }

  const targetIds = config.subEvents.split(',').map(id => parseInt(id.trim()));
  return subEvents.filter(subEvent =>
    targetIds.includes(subEvent.resultSubEventId) &&
    subEvent.hasResults &&
    subEvent.isPublic
  );
}

// Function to generate kebab-case filename from sub-event name
function generateFileName(subEvent) {
  const sanitizedName = subEvent.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  return `${sanitizedName}.json`;
}

// Function to fetch leaderboard data for a sub-event with pagination using start parameter
async function fetchSubEventLeaderboard(eventId, subEventId, subEventName) {
  console.log(`Fetching leaderboard for ${subEventName}...`);

  const allParticipants = [];
  let start = 0;
  const limit = 1000; // Maximum allowed by API
  let hasMore = true;

  while (hasMore) {
    const url = `https://results.raceroster.com/v2/api/result-events/${eventId}/sub-events/${subEventId}/results?filter_search=&start=${start}&limit=${limit}`;

    console.log(`Fetching data for ${subEventName} (start ${start}): ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        hasMore = false;
        console.log(`No more data found for ${subEventName} at start ${start}`);
        break;
      }

      allParticipants.push(...data.data);
      console.log(`✅ Fetched ${data.data.length} participants from ${subEventName} (start ${start}, total: ${allParticipants.length})`);

      // Check if we got less than the maximum, meaning we're done
      if (data.data.length < limit) {
        hasMore = false;
      } else {
        start += limit;
      }

      // Add a small delay to avoid overwhelming the API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error(`❌ Error fetching data for ${subEventName} at start ${start}:`, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  console.log(`✅ Total fetched ${allParticipants.length} participants for ${subEventName}`);

  // Return the data in the same format as the original API response
  return {
    data: allParticipants,
    meta: {
      total: allParticipants.length,
      start: start - limit,
      limit: limit
    }
  };
}

// Function to fetch participant details
async function fetchParticipantDetail(participantId, eventUniqueCode) {
  const url = `https://results.raceroster.com/v2/api/events/${eventUniqueCode}/detail/${participantId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Warning: Failed to fetch details for participant ${participantId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`Warning: Error fetching details for participant ${participantId}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Function to fetch all participant details with rate limiting
async function fetchAllParticipantDetails(participants, eventUniqueCode, subEventName) {
  const details = [];
  const totalParticipants = participants.length;

  console.log(`Fetching details for ${totalParticipants} participants in ${subEventName}...`);

  // Process participants in batches to avoid overwhelming the API
  const batchSize = 10;
  const delayBetweenBatches = 1000;

  for (let i = 0; i < totalParticipants; i += batchSize) {
    const batch = participants.slice(i, i + batchSize);
    const batchPromises = batch.map(async (participant, index) => {
      const globalIndex = i + index;
      console.log(`Fetching details for participant ${globalIndex + 1}/${totalParticipants} in ${subEventName}: ${participant.name}`);

      const detailData = await fetchParticipantDetail(participant.id, eventUniqueCode);

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

      // Include the participant ID for mapping
      if (detailData) {
        detailData.participantId = participant.id;
      }

      return detailData;
    });

    const batchResults = await Promise.all(batchPromises);
    details.push(...batchResults.filter(detail => detail !== null));

    console.log(`Completed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(totalParticipants / batchSize)} for ${subEventName}`);

    // Delay between batches
    if (i + batchSize < totalParticipants) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  console.log(`Successfully fetched details for ${details.length} participants in ${subEventName}`);
  return details;
}

// Function to convert detailed participant data to mock format
function convertToMockFormat(leaderboardData, participantDetails, subEvent) {
  console.log(`Converting ${subEvent.name} data to mock format...`);

  // Create a map of participant ID to details for quick lookup
  const detailMap = new Map();
  participantDetails.forEach((detail) => {
    if (detail && detail.data && detail.data.result) {
      detailMap.set(detail.participantId, detail.data);
    }
  });

  const results = leaderboardData.data.map((participant, index) => {
    const overallPlace = index + 1;
    const detail = detailMap.get(participant.id);

    // Use detail data if available, otherwise fall back to leaderboard data
    const name = detail?.result?.name || participant.name || '';
    const gender = detail?.result?.gender === 'Male' ? 'M' : (detail?.result?.gender === 'Female' ? 'F' : '');
    const age = detail?.result?.age || '';
    const city = detail?.result?.fromCity || participant.fromCity || '';
    const state = detail?.result?.fromProvState || participant.fromProvState || '';
    const chipTime = detail?.result?.chipTime || participant.chipTime || '';
    const pace = detail?.result?.overallPace || participant.overallPace || '';
    const division = detail?.result?.division || participant.division || '';
    const divisionPlace = detail?.result?.divisionPlaceLabel || participant.divisionPlace || '';
    const bib = detail?.result?.bib || '';
    const countryCode = detail?.result?.fromCountry || participant.fromCountry || '';

    // Extract division place number - handle empty divisionPlace
    let divisionPlaceNum = '';
    if (divisionPlace && divisionPlace.includes(' / ')) {
      divisionPlaceNum = divisionPlace.split(' / ')[0];
    }

    return [
      overallPlace,                                    // race_placement
      bib,                                             // bib_num
      name,                                            // name
      '',                                              // profile_image_url (empty for now)
      gender,                                          // gender
      age,                                             // age
      city,                                            // city
      state,                                           // state
      countryCode,                                     // countrycode
      detail?.result?.gunTime || '',                   // clock_time
      chipTime,                                        // chip_time
      pace,                                            // avg_pace
      '',                                              // age_performance_percentage (empty)
      divisionPlaceNum,                                // division_place
      division,                                        // division
      ''                                               // field_475549 (GENPLC - empty)
    ];
  });

  // Define headings matching the existing format
  const headings = [
    {
      "key": "race_placement",
      "name": "Place",
      "style": "place",
      "hidden": false
    },
    {
      "key": "bib_num",
      "name": "Bib",
      "style": "bib",
      "hidden": false
    },
    {
      "key": "name",
      "name": "Name",
      "hidden": false
    },
    {
      "key": "profile_image_url",
      "name": "Profile Image URL",
      "hidden": true
    },
    {
      "key": "gender",
      "name": "Gender",
      "hidden": false
    },
    {
      "key": "age",
      "name": "Age",
      "hidden": false
    },
    {
      "key": "city",
      "name": "City",
      "hidden": false
    },
    {
      "key": "state",
      "name": "State",
      "hidden": false
    },
    {
      "key": "countrycode",
      "name": "Country",
      "hidden": true
    },
    {
      "key": "clock_time",
      "name": "Clock\nTime",
      "style": "time",
      "hidden": false
    },
    {
      "key": "chip_time",
      "name": "Chip\nTime",
      "style": "time",
      "hidden": false
    },
    {
      "key": "avg_pace",
      "name": "Pace",
      "style": "time",
      "hidden": false
    },
    {
      "key": "age_performance_percentage",
      "tooltip": "This shows how well you performed based on your age.  Higher numbers are better, with 100% being the best.",
      "name": "Age\nPercentage",
      "hidden": true
    },
    {
      "key": "division_place",
      "nonSortable": true,
      "name": "Division\nPlace",
      "style": "place",
      "hidden": false
    },
    {
      "key": "division",
      "nonSortable": true,
      "name": "Division",
      "hidden": false
    },
    {
      "key": "field_475549",
      "sortKey": "field_475549_value",
      "name": "GENPLC",
      "hidden": false
    }
  ];

  // Create division information based on the data
  const uniqueDivisions = [...new Set(results.map((r) => r[14]))]; // division field
  const divisions = uniqueDivisions.map((divName, index) => ({
    race_division_id: 6382710 + index,
    division_name: divName,
    division_short_name: divName,
    show_top_num: 5,
    gender: null,
    max_age: null,
    min_age: null,
    individual_result_set_id: null
  }));

  // Create the mock data structure
  return {
    headings: headings,
    resultSet: {
      extraFieldIds: [475549],
      results: results,
      extraFields: {
        "475549": {
          individual_result_extra_field_id: 475549,
          individual_result_set_id: 503106,
          field_name: "GENPLC",
          field_short_name: "GENPLC",
          field_type: "U",
          individual_result_extra_field_deleted: "F"
        }
      },
      divisionGroups: [],
      nonGroupedDivisionIds: divisions.map(d => d.race_division_id),
      splits: [],
      numResults: results.length,
      setInfo: {
        individual_result_set_id: 503106,
        race_category_id: 893971,
        individual_result_set_deleted: "F",
        individual_result_set_name: subEvent.name,
        public_results: "T",
        disable_division_placement_calc: "F",
        results_source_name: "Race Roster API",
        results_source_url: null,
        result_questions_url: null,
        preliminary_results: "F",
        pace_type: "T",
        hide_splits_in_results: "F",
        hide_event_names: "F",
        disable_result_set_notifications: "F",
        sort_order: 0,
        tally_field_type: 0,
        tally_label: null,
        tally_higher_is_better: "T",
        team_column_display_type: 1,
        hide_award_winner_section: "F"
      }
    },
    resultUrls: [],
    auxData: {
      rowFirstNameLens: results.map((r) => r[2] ? r[2].split(' ')[0].length : 0)
    },
    teamResultSetId: null,
    overallDivisionResults: [],
    divisions: divisions,
    divisionResults: {},
    videoSettings: {
      finishLine: null
    },
    raceGroupMarkdownUrls: []
  };
}

// Function to generate index.json
function generateIndexFile(eventData, subEventResults) {
  const event = eventData.data.event;

  const resultSets = subEventResults.map(result => ({
    id: `${event.uniqueCode}-${result.subEvent.resultSubEventId}`,
    category: result.subEvent.name,
    s3_key: `${result.fileName}`
  }));

  return {
    event_id: event.uniqueCode,
    event_name: event.name,
    organization_id: "millenniumrunning", // Can be made configurable if needed
    result_sets: resultSets,
    updated_at: new Date().toISOString()
  };
}

// Function to process a single sub-event
async function processSubEvent(eventData, subEvent) {
  try {
    logProgress(`Processing ${subEvent.name}...`);

    // Fetch leaderboard data
    const leaderboardData = await fetchSubEventLeaderboard(
      eventData.data.event.resultEventId,
      subEvent.resultSubEventId,
      subEvent.name
    );

    if (!leaderboardData || !leaderboardData.data || leaderboardData.data.length === 0) {
      console.warn(`⚠️ No participant data found for ${subEvent.name}`);
      return null;
    }

    // Fetch participant details
    const participantDetails = await fetchAllParticipantDetails(
      leaderboardData.data,
      eventData.data.event.uniqueCode,
      subEvent.name
    );

    // Convert to mock format
    const mockData = convertToMockFormat(leaderboardData, participantDetails, subEvent);

    // Generate filename
    const fileName = generateFileName(subEvent);
    const filePath = path.join(CONFIG.outputDir, fileName);

    // Save to file
    fs.writeFileSync(filePath, JSON.stringify(mockData, null, 2));
    console.log(`✅ Saved ${subEvent.name} data to: ${fileName} (${mockData.resultSet.numResults} participants)`);

    return {
      subEvent,
      fileName,
      data: mockData
    };

  } catch (error) {
    console.error(`❌ Error processing ${subEvent.name}:`, error instanceof Error ? error.message : 'Unknown error');
    return null; // Continue with other sub-events even if this one fails
  }
}

// Main execution function
async function main() {
  console.log('🚀 Starting RaceRoster data fetch...');
  console.log(`📅 Event: ${CONFIG.eventUniqueCode}`);
  console.log(`📁 Output: ${CONFIG.outputDir}`);
  console.log(`🏃 Sub-events: ${CONFIG.subEvents}`);

  try {
    // Step 1: Fetch event data
    const eventData = await fetchEventData(CONFIG.eventUniqueCode);

    if (!eventData || !eventData.data || !eventData.data.event) {
      throw new Error('Invalid event data received');
    }

    // Step 2: Filter sub-events
    const targetSubEvents = filterSubEvents(eventData.data.event.subEvents, CONFIG);

    if (targetSubEvents.length === 0) {
      throw new Error('No valid sub-events found to process');
    }

    totalCount = targetSubEvents.length;
    console.log(`📋 Found ${totalCount} sub-events to process: ${targetSubEvents.map(se => se.name).join(', ')}`);

    // Step 3: Process all sub-events
    const subEventResults = [];

    for (const subEvent of targetSubEvents) {
      const result = await processSubEvent(eventData, subEvent);
      if (result) {
        subEventResults.push(result);
      }
    }

    if (subEventResults.length === 0) {
      throw new Error('No sub-events were successfully processed');
    }

    // Step 4: Generate index.json
    console.log('📄 Generating index.json...');
    const indexData = generateIndexFile(eventData, subEventResults);
    const indexPath = path.join(CONFIG.outputDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));

    // Step 5: Summary
    console.log('\n🎉 Success!');
    console.log(`✅ Processed ${subEventResults.length} sub-events`);
    console.log(`✅ Total participants: ${subEventResults.reduce((sum, r) => sum + r.data.resultSet.numResults, 0)}`);
    console.log(`📁 Files created in: ${CONFIG.outputDir}`);
    console.log('\n📋 Created files:');
    console.log('   - index.json');
    subEventResults.forEach(result => {
      console.log(`   - ${result.fileName} (${result.data.resultSet.numResults} participants)`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the script
main();