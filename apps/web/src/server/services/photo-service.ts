import { QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoClient, TABLES } from "@/lib/dynamodb";

// Types based on packages/image-rekognition/lambda/fanout-dynamodb/index.ts
export interface PhotoItem {
  PK: string;
  SK: string;
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
  bibs: string[];
  faceIds: string[];
  createdAt: string;
  updatedAt: string;
  instagramHandle?: string | null;
}

export interface BibIndexItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  ulid: string;
  orgId: string;
  eventId: string;
  bib: string;
  createdAt: string;
}

export class PhotoService {
  /**
   * Get all photos for an event, paginated.
   * Uses the main table PK (ORG#...#EVT#...) and SK (PHOTO#...).
   */
  static async getPhotosByEvent({
    organizerId,
    eventId,
    limit = 20,
    cursor,
  }: {
    organizerId: string;
    eventId: string;
    limit?: number;
    cursor?: string;
  }) {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    const pk = `ORG#${organizerId}#EVT#${eventId}`;
    const command = new QueryCommand({
      TableName: TABLES.PHOTO_SERVICE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": pk,
        ":skPrefix": "PHOTO#",
      },
      Limit: limit,
      ExclusiveStartKey: cursor
        ? JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"))
        : undefined,
      ScanIndexForward: false, // Newest first
    });

    const result = await dynamoClient.send(command);
    const items = (result.Items as PhotoItem[]) ?? [];
    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

    const mappedItems = items.map((item) => ({
      orgId: item.orgId,
      eventId: item.eventId,
      // imageUrl: `https://images.snap-race.com/${item.processedKey || item.rawKey}`,
      instagramHandle: item.instagramHandle,
      // We need the key for the image loader to work with the image handler
      key: item.processedKey || item.rawKey,
    }));

    return { items: mappedItems, nextCursor };
  }

  /**
   * Get photos by Bib number, paginated.
   * Uses GSI1 (EVT#...#BIB#...) to find photo IDs, then BatchGet to fetch details.
   */
  static async getPhotosByBib({    
    eventId,
    bibNumber,
    limit = 20,
    cursor,
  }: {
    eventId: string;
    bibNumber: string;
    limit?: number;
    cursor?: string;
  }) {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    const gsi1pk = `EVT#${eventId}#BIB#${bibNumber}`;

    // 1. Query GSI1 to get ULIDs
    const queryCommand = new QueryCommand({
      TableName: TABLES.PHOTO_SERVICE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": gsi1pk,
      },
      Limit: limit,
      ExclusiveStartKey: cursor
        ? JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"))
        : undefined,
      ScanIndexForward: false, // Newest first
    });

    const queryResult = await dynamoClient.send(queryCommand);
    const indexItems = (queryResult.Items as BibIndexItem[]) ?? [];

    if (indexItems.length === 0) {
      return { items: [], nextCursor: undefined };
    }

    // 2. BatchGet to get full Photo details
    // Construct keys: PK = ORG#...#EVT#..., SK = PHOTO#ulid
    const keys = indexItems.map((item) => ({
      PK: item.PK,
      SK: `PHOTO#${item.ulid}`,
    }));

    // Handle BatchGet limit (max 100).
    // Since we control 'limit' in input, we should ensure it doesn't exceed 100 if we want single batch.
    // If input limit > 100, we should chunk, but for now assuming limit is reasonable.
    
    const batchCommand = new BatchGetCommand({
      RequestItems: {
        [TABLES.PHOTO_SERVICE]: {
          Keys: keys,
        },
      },
    });

    const batchResult = await dynamoClient.send(batchCommand);
    const photoItems =
      (batchResult.Responses?.[TABLES.PHOTO_SERVICE] as PhotoItem[]) ?? [];

    // 3. Re-sort because BatchGet loses order
    const photoMap = new Map(photoItems.map((p) => [p.ulid, p]));
    const sortedPhotos = indexItems
      .map((item) => photoMap.get(item.ulid))
      .filter((p): p is PhotoItem => !!p)
      .map((item) => ({
        orgId: item.orgId,
        eventId: item.eventId,
        imageUrl: `https://images.snap-race.com/${item.processedKey}`, // item.rawKey
        instagramHandle: item.instagramHandle,
        // We need the key for the image loader to work with the image handler
        key: item.processedKey,
      }));

    const nextCursor = queryResult.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(queryResult.LastEvaluatedKey)).toString("base64")
      : undefined;

    return { items: sortedPhotos, nextCursor };
  }
}
