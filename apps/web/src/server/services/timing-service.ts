import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const TIMING_MESSAGES = {
  FETCH_FAILED: "Failed to fetch timing records.",
  DATASET_LOAD_FAILED: "Unable to load timing dataset from storage.",
  ROW_OUT_OF_RANGE: "Row index is out of range in timing dataset.",
  DATASET_MALFORMED: "Timing dataset is missing required data.",
} as const satisfies Record<string, string>;

export type TimingItem = {
  event_id: string;
  sort_key: string;
  bib: string;
  name?: string;
  user_id?: number | null;
  row_index: number;
  result_set_id: string;
  s3_key: string;
};

export type ResultRow = Record<string, unknown>;

export type BibDetailResponse = {
  meta: {
    eventId: string;
    bib: string;
    name?: string;
    userId?: number | null;
  };
  row: ResultRow;
  raw: {
    row_index: number;
    s3_key: string;
  };
};

export enum TimingServiceErrorReason {
  QueryFailed = "QUERY_FAILED",
  ItemNotFound = "ITEM_NOT_FOUND",
  DatasetLoadFailed = "DATASET_LOAD_FAILED",
  RowOutOfRange = "ROW_OUT_OF_RANGE",
  DatasetMalformed = "DATASET_MALFORMED",
}

export class TimingServiceError extends Error {
  constructor(
    public readonly reason: TimingServiceErrorReason,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TimingServiceError";
  }
}

export type LoadDatasetFn = (
  key: string,
) => Promise<TimingDatasetJSON>;

export type TimingDatasetJSON = {
  headings?: Array<{ key?: string; name?: string }>;
  resultSet?: {
    results?: unknown[][];
  };
  resultUrls?: string[];
  auxData?: {
    resultUrls?: string[];
  };
};

export async function fetchTimingItem(options: {
  ddb: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
  eventId: string;
  bib: string;
}): Promise<TimingItem | null> {
  const { ddb, tableName, eventId, bib } = options;
  const sortKey = makeSortKey(bib);

  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: "event_id = :eventId AND sort_key = :sortKey",
    ExpressionAttributeValues: {
      ":eventId": eventId,
      ":sortKey": sortKey,
    },
    Limit: 1,
  });

  try {
    const response = await ddb.send(command);
    const item = response.Items?.[0];
    if (!item) {
      return null;
    }
    return item as TimingItem;
  } catch (error) {
    throw new TimingServiceError(
      TimingServiceErrorReason.QueryFailed,
      TIMING_MESSAGES.FETCH_FAILED,
      error,
    );
  }
}

export async function buildBibDetail(options: {
  item: TimingItem;
  loadDataset: LoadDatasetFn;
}): Promise<BibDetailResponse> {
  const { item, loadDataset } = options;
  const dataset = await loadTimingDataset(loadDataset, item.s3_key);

  const headings = Array.isArray(dataset.headings) ? dataset.headings : [];
  const results = dataset.resultSet?.results;

  if (!Array.isArray(results)) {
    throw new TimingServiceError(
      TimingServiceErrorReason.DatasetMalformed,
      TIMING_MESSAGES.DATASET_MALFORMED,
    );
  }

  const row = results[item.row_index];
  if (!row) {
    throw new TimingServiceError(
      TimingServiceErrorReason.RowOutOfRange,
      TIMING_MESSAGES.ROW_OUT_OF_RANGE,
    );
  }

  const rowObject = mapRow(headings, row);

  return {
    meta: {
      eventId: item.event_id,
      bib: item.bib,
      name: item.name,
      userId: item.user_id ?? null,
    },
    row: rowObject,
    raw: {
      row_index: item.row_index,
      s3_key: item.s3_key,
    },
  };
}

export async function getBibDetail(options: {
  ddb: Pick<DynamoDBDocumentClient, "send">;
  tableName: string;
  eventId: string;
  bib: string;
  loadDataset: LoadDatasetFn;
}): Promise<BibDetailResponse> {
  const { ddb, tableName, eventId, bib, loadDataset } = options;
  const item = await fetchTimingItem({ ddb, tableName, eventId, bib });

  if (!item) {
    throw new TimingServiceError(
      TimingServiceErrorReason.ItemNotFound,
      "Timing item not found.",
    );
  }

  return buildBibDetail({ item, loadDataset });
}

function makeSortKey(bib: string | number) {
  return `BIB#${String(bib).trim()}`;
}

async function loadTimingDataset(
  loadDataset: LoadDatasetFn,
  key: string,
): Promise<TimingDatasetJSON> {
  try {
    return await loadDataset(key);
  } catch (error) {
    throw new TimingServiceError(
      TimingServiceErrorReason.DatasetLoadFailed,
      TIMING_MESSAGES.DATASET_LOAD_FAILED,
      error,
    );
  }
}

function mapRow(headings: Array<{ key?: string; name?: string }>, row: unknown[]): ResultRow {
  const columnIndex = buildColumnIndex(headings);
  const mapped: ResultRow = {};

  headings.forEach((heading) => {
    if (!heading?.key) return;
    const idx = columnIndex(heading.key);
    const value = idx === undefined ? undefined : row[idx];

    switch (heading.key) {
      case "field_475547":
        mapped.gender_place = value;
        break;
      case "field_475548":
        mapped.halfway_split = value;
        break;
      case "age_performance_percentage":
        mapped.age_performance_percentage = value;
        break;
      default:
        mapped[heading.key] = value;
    }
  });

  return mapped;
}

function buildColumnIndex(headings: Array<{ key?: string }>) {
  const index = new Map<string, number>();
  headings.forEach((heading, idx) => {
    if (heading?.key) {
      index.set(heading.key, idx);
    }
  });

  return (key: string) => index.get(key);
}

// Event-wide results types and functions

export type EventMetadataJSON = {
  event_id: string;
  event_name: string;
  organization_id: string;
  result_sets: Array<{
    id: string;
    category: string;
    s3_key: string;
  }>;
  updated_at?: string;
};

export type LeaderboardResult = {
  rank: number;
  bib: string;
  name?: string;
  chipTime?: string;
  clockTime?: string;
  division?: string;
  gender?: string;
  age?: number;
  divisionPlace?: string | number;
  racePlacement?: string | number;
  agePerformance?: number;
  avgPace?: string;
  city?: string;
  state?: string;
};

export type EventResultsResponse = {
  resultSets: Array<{
    id: string;
    category: string;
    results: LeaderboardResult[];
    totalResults: number;
  }>;
  meta: {
    eventId: string;
    eventName?: string;
    totalResults: number;
  };
};

export async function getAllEventResults(options: {
  eventId: string;
  organizationId: string;
  loadDataset: LoadDatasetFn;
  loadMetadata: (key: string) => Promise<EventMetadataJSON>;
}): Promise<EventResultsResponse> {
  const { eventId, organizationId, loadDataset, loadMetadata } = options;

  // Load event metadata (index.json)
  // Note: index.json is located in results/ folder
  const metadataKey = `${organizationId}/${eventId}/results/index.json`;
  let metadata: EventMetadataJSON;

  try {
    metadata = await loadMetadata(metadataKey);
  } catch (error) {
    throw new TimingServiceError(
      TimingServiceErrorReason.DatasetLoadFailed,
      "Failed to load event metadata",
      error,
    );
  }

  // Load all result sets in parallel
  const resultSetsPromises = metadata.result_sets.map(async (resultSet) => {
    const dataset = await loadTimingDataset(loadDataset, resultSet.s3_key);
    const headings = Array.isArray(dataset.headings) ? dataset.headings : [];
    const results = dataset.resultSet?.results;

    if (!Array.isArray(results)) {
      return {
        id: resultSet.id,
        category: resultSet.category,
        results: [],
        totalResults: 0,
      };
    }

    // Parse all results
    const parsedResults: LeaderboardResult[] = results.map((row) => {
      const rowObject = mapRow(headings, row);
      return parseLeaderboardResult(rowObject);
    });

    return {
      id: resultSet.id,
      category: resultSet.category,
      results: parsedResults,
      totalResults: parsedResults.length,
    };
  });

  const resultSets = await Promise.all(resultSetsPromises);
  const totalResults = resultSets.reduce(
    (sum, rs) => sum + rs.totalResults,
    0,
  );

  return {
    resultSets,
    meta: {
      eventId,
      eventName: metadata.event_name,
      totalResults,
    },
  };
}

function parseLeaderboardResult(row: ResultRow): LeaderboardResult {
  const getNumber = (key: string): number | undefined => {
    const value = row[key];
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  const getValue = (key: string): string | number | undefined => {
    const value = row[key];
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
    return undefined;
  };

  const getBibString = (): string => {
    const bibNum = row.bib_num ?? row.bib;
    if (typeof bibNum === "string") return bibNum;
    if (typeof bibNum === "number") return String(bibNum);
    return "";
  };

  return {
    rank: getNumber("race_placement") ?? 0,
    bib: getBibString(),
    name: getValue("name") as string | undefined,
    chipTime: getValue("chip_time") as string | undefined,
    clockTime: getValue("clock_time") as string | undefined,
    division: getValue("division") as string | undefined,
    gender: getValue("gender") as string | undefined,
    age: getNumber("age"),
    divisionPlace: getValue("division_place"),
    racePlacement: getValue("race_placement"),
    agePerformance: getNumber("age_performance_percentage"),
    avgPace: getValue("avg_pace") as string | undefined,
    city: getValue("city") as string | undefined,
    state: getValue("state") as string | undefined,
  };
}
