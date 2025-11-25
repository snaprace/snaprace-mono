import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.DDB_TABLE!;

interface DetectTextResult {
  bibs?: string[];
}

interface IndexFacesResult {
  faceIds?: string[];
}

export interface FanoutInput {
  orgId: string;
  eventId: string;
  bucketName: string;
  rawKey: string;
  processedKey: string;
  s3Uri: string;
  dimensions: { width: number; height: number };
  format: string;
  size: number;
  ulid: string;
  thumbHash: string;
  instagramHandle?: string | null;
  detectTextResult?: DetectTextResult;
  indexFacesResult?: IndexFacesResult;
}

interface PhotoItem {
  PK: string;
  SK: string;
  EntityType: "PHOTO";
  ulid: string;
  orgId: string;
  eventId: string;
  originalFilename: string;
  rawKey: string;
  processedKey: string;
  s3Uri: string;
  dimensions: { width: number; height: number };
  format: string;
  size: number;
  thumbHash: string;
  bibs: string[];
  bibCount: number;
  faceIds: string[];
  faceCount: number;
  createdAt: string;
  updatedAt: string;
  instagramHandle?: string | null;
  GSI2PK?: string;
  GSI2SK?: string;
}

interface BibIndexItem {
  PK: string;
  SK: string;
  EntityType: "BIB_INDEX";
  GSI1PK: string;
  GSI1SK: string;
  ulid: string;
  orgId: string;
  eventId: string;
  bib: string;
  createdAt: string;
}

async function batchWriteItems(items: Array<PhotoItem | BibIndexItem>) {
  for (let i = 0; i < items.length; i += 25) {
    let pending = items.slice(i, i + 25);

    while (pending.length > 0) {
      const response = await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: pending.map((item) => ({
              PutRequest: { Item: item },
            })),
          },
        })
      );

      const unprocessed =
        response.UnprocessedItems?.[TABLE_NAME]?.map(
          (req) => req.PutRequest?.Item
        ) ?? [];

      pending = unprocessed.filter(
        (item): item is PhotoItem | BibIndexItem => !!item
      );

      if (pending.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }
}

export const handler = async (event: FanoutInput): Promise<{ ok: true }> => {
  const {
    orgId,
    eventId,
    rawKey,
    processedKey,
    s3Uri,
    dimensions,
    format,
    size,
    ulid,
    thumbHash,
    instagramHandle,
    detectTextResult,
    indexFacesResult,
  } = event;

  const bibs: string[] = detectTextResult?.bibs ?? [];
  const faceIds: string[] = indexFacesResult?.faceIds ?? [];

  const now = new Date().toISOString();
  const pk = `ORG#${orgId}#EVT#${eventId}`;
  const sk = `PHOTO#${ulid}`;

  const photoItem: PhotoItem = {
    PK: pk,
    SK: sk,
    EntityType: "PHOTO",

    ulid,
    orgId,
    eventId,
    originalFilename: rawKey.split("/").slice(-1)[0],
    rawKey,
    processedKey,
    s3Uri,

    dimensions,
    format,
    size,
    thumbHash,

    bibs,
    bibCount: bibs.length,
    faceIds,
    faceCount: faceIds.length,

    createdAt: now,
    updatedAt: now,
  };

  if (instagramHandle) {
    photoItem.instagramHandle = instagramHandle;
    photoItem.GSI2PK = `PHOTOGRAPHER#${instagramHandle}`;
    photoItem.GSI2SK = `EVT#${eventId}#TIME#${now}`;
  }

  const items: Array<PhotoItem | BibIndexItem> = [];

  items.push(photoItem);

  for (const bib of bibs) {
    const bibItem: BibIndexItem = {
      PK: pk,
      SK: `BIB#${bib}#PHOTO#${ulid}`,
      EntityType: "BIB_INDEX",
      GSI1PK: `EVT#${eventId}#BIB#${bib}`,
      GSI1SK: `PHOTO#${ulid}`,
      ulid,
      orgId,
      eventId,
      bib,
      createdAt: now,
    };

    items.push(bibItem);
  }

  await batchWriteItems(items);

  return { ok: true };
};

