import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import {
  buildBibDetail,
  fetchTimingItem,
  getBibDetail,
  TIMING_MESSAGES,
  TimingServiceErrorReason,
  type TimingDatasetJSON,
  type TimingItem,
} from "@/server/services/timing-service";

const MOCK_DATASET_PATH = join(process.cwd(), "src", "mock", "10k.json");

let dataset: TimingDatasetJSON;

beforeAll(async () => {
  dataset = JSON.parse(await readFile(MOCK_DATASET_PATH, "utf-8")) as TimingDatasetJSON;
});

const baseItem: TimingItem = {
  event_id: "everybody-10k-2024-10k",
  sort_key: "BIB#1845",
  bib: "1845",
  name: "NICK DOWNEY",
  user_id: 123456,
  row_index: 0,
  result_set_id: "everybody-10k-2024-10k",
  s3_key: "mock/10k.json",
};

describe("buildBibDetail", () => {
  it("maps dataset row into response object", async () => {
    const loadDataset = vi.fn().mockResolvedValue(dataset);

    const detail = await buildBibDetail({ item: baseItem, loadDataset });

    expect(detail.meta.bib).toBe("1845");
    expect(detail.row.chip_time).toBe("34:24");
    expect(detail.row.avg_pace).toBe("5:33");
    expect(detail.raw.row_index).toBe(0);
    expect(loadDataset).toHaveBeenCalledOnce();
  });

  it("throws when row index is out of range", async () => {
    const loadDataset = vi.fn().mockResolvedValue(dataset);

    await expect(
      buildBibDetail({
        item: { ...baseItem, row_index: 9999 },
        loadDataset,
      }),
    ).rejects.toMatchObject({
      reason: TimingServiceErrorReason.RowOutOfRange,
      message: TIMING_MESSAGES.ROW_OUT_OF_RANGE,
    });
  });

  it("wraps dataset load failures", async () => {
    const loadDataset = vi.fn().mockRejectedValue(new Error("S3 failure"));

    await expect(
      buildBibDetail({
        item: baseItem,
        loadDataset,
      }),
    ).rejects.toMatchObject({
      reason: TimingServiceErrorReason.DatasetLoadFailed,
      message: TIMING_MESSAGES.DATASET_LOAD_FAILED,
    });
  });
});

describe("fetchTimingItem", () => {
  it("returns unmarshalled item when query succeeds", async () => {
    const send = vi.fn().mockResolvedValue({ Items: [baseItem] });

    const item = await fetchTimingItem({
      ddb: { send } as unknown as Pick<DynamoDBDocumentClient, "send">,
      tableName: "TimingResults",
      eventId: baseItem.event_id,
      bib: baseItem.bib,
    });

    expect(item).toEqual(baseItem);
    expect(send).toHaveBeenCalledOnce();
  });

  it("wraps DynamoDB errors", async () => {
    const send = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(
      fetchTimingItem({
        ddb: { send } as unknown as Pick<DynamoDBDocumentClient, "send">,
        tableName: "TimingResults",
        eventId: baseItem.event_id,
        bib: baseItem.bib,
      }),
    ).rejects.toMatchObject({
      reason: TimingServiceErrorReason.QueryFailed,
      message: TIMING_MESSAGES.FETCH_FAILED,
    });
  });
});

describe("getBibDetail", () => {
  it("returns mapped bib detail when item exists", async () => {
    const send = vi.fn().mockResolvedValue({ Items: [baseItem] });
    const loadDataset = vi.fn().mockResolvedValue(dataset);

    const detail = await getBibDetail({
      ddb: { send } as unknown as Pick<DynamoDBDocumentClient, "send">,
      tableName: "TimingResults",
      eventId: baseItem.event_id,
      bib: baseItem.bib,
      loadDataset,
    });

    expect(detail.meta.eventId).toBe(baseItem.event_id);
    expect(detail.row.clock_time).toBe("34:24");
    expect(send).toHaveBeenCalledOnce();
  });

  it("throws service error when item is missing", async () => {
    const send = vi.fn().mockResolvedValue({ Items: [] });

    await expect(
      getBibDetail({
        ddb: { send } as unknown as Pick<DynamoDBDocumentClient, "send">,
        tableName: "TimingResults",
        eventId: baseItem.event_id,
        bib: baseItem.bib,
        loadDataset: vi.fn(),
      }),
    ).rejects.toMatchObject({
      reason: TimingServiceErrorReason.ItemNotFound,
    });
  });
});
