import {
  QueryCommand,
  BatchGetCommand,
  GetCommand,
  type BatchGetCommandOutput,
  type QueryCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import {
  LambdaClient,
  InvokeCommand,
  type InvokeCommandOutput,
} from "@aws-sdk/client-lambda";
import { env } from "@/env";
import {
  decodeCursor,
  isLambdaProxyResponse,
  parseSelfieLambdaBody,
  type SearchBySelfieResult,
} from "@/server/utils/selfie-search";
import { type Photo } from "@/types/photo";
import { unstable_cache } from "next/cache";

// Lambda Client initialized outside the class
const lambdaClient = new LambdaClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

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
  thumbHash?: string;
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

// Cached counting functions
const getCachedPhotoCountByEvent = unstable_cache(
  async (organizerId: string, eventId: string) => {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    const pk = `ORG#${organizerId}#EVT#${eventId}`;
    let totalCount = 0;
    let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined;

    do {
      const command = new QueryCommand({
        TableName: TABLES.PHOTO_SERVICE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":skPrefix": "PHOTO#",
        },
        Select: "COUNT",
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result: QueryCommandOutput = await dynamoClient.send(command);
      totalCount += result.Count ?? 0;
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return totalCount;
  },
  ["photo-count-by-event"],
  {
    revalidate: 1800, // Cache for 1 hour
    tags: ["photo-count"],
  },
);

const getCachedPhotoCountByBib = unstable_cache(
  async (eventId: string, bibNumber: string) => {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    const gsi1pk = `EVT#${eventId}#BIB#${bibNumber}`;
    let totalCount = 0;
    let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined;

    do {
      const command = new QueryCommand({
        TableName: TABLES.PHOTO_SERVICE,
        IndexName: "GSI1",
        KeyConditionExpression: "GSI1PK = :pk",
        ExpressionAttributeValues: {
          ":pk": gsi1pk,
        },
        Select: "COUNT",
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result: QueryCommandOutput = await dynamoClient.send(command);
      totalCount += result.Count ?? 0;
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return totalCount;
  },
  ["photo-count-by-bib"],
  {
    revalidate: 1800, // Cache for 1 hour
    tags: ["photo-count"],
  },
);

const getCachedPhotoCountByPhotographer = unstable_cache(
  async (eventId: string, instagramHandle: string) => {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    let totalCount = 0;
    let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined;

    do {
      const command = new QueryCommand({
        TableName: TABLES.PHOTO_SERVICE,
        IndexName: "GSI2",
        KeyConditionExpression:
          "GSI2PK = :pk AND begins_with(GSI2SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `PHOTOGRAPHER#${instagramHandle}`,
          ":skPrefix": `EVT#${eventId}`,
        },
        Select: "COUNT",
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result: QueryCommandOutput = await dynamoClient.send(command);
      totalCount += result.Count ?? 0;
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return totalCount;
  },
  ["photo-count-by-photographer"],
  {
    revalidate: 1800, // Cache for 1 hour
    tags: ["photo-count"],
  },
);

export class PhotoService {
  private static extractPidFromKey(key: string): string {
    const filename = key.split("/").pop() ?? "";
    return filename.split(".")[0] ?? "";
  }

  /**
   * Get a single photo by ID.
   */
  static async getPhoto({
    organizerId,
    eventId,
    pid,
  }: {
    organizerId: string;
    eventId: string;
    pid: string;
  }): Promise<Photo | null> {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    const pk = `ORG#${organizerId}#EVT#${eventId}`;
    // Assuming pid corresponds to the ULID used in SK
    const sk = `PHOTO#${pid}`;

    const command = new GetCommand({
      TableName: TABLES.PHOTO_SERVICE,
      Key: {
        PK: pk,
        SK: sk,
      },
    });

    const result = await dynamoClient.send(command);
    const item = result.Item as PhotoItem | undefined;

    if (!item) {
      return null;
    }

    const key = item.processedKey || item.rawKey;
    return {
      pid: PhotoService.extractPidFromKey(key),
      src: key,
      width: item.dimensions.width,
      height: item.dimensions.height,
      eventId: item.eventId,
      orgId: item.orgId,
      thumbHash: item.thumbHash,
      instagramHandle: item.instagramHandle,
    };
  }

  /**
   * Get all photos for an event, paginated.
   * Uses the main table PK (ORG#...#EVT#...) and SK (PHOTO#...).
   */
  static async getPhotosByEvent({
    organizerId,
    eventId,
    limit = 20,
    cursor,
    instagramHandle,
  }: {
    organizerId: string;
    eventId: string;
    limit?: number;
    cursor?: string;
    instagramHandle?: string;
  }) {
    if (!TABLES.PHOTO_SERVICE) {
      throw new Error("DYNAMO_PHOTO_SERVICE_TABLE is not configured");
    }

    let command: QueryCommand;

    if (instagramHandle) {
      command = new QueryCommand({
        TableName: TABLES.PHOTO_SERVICE,
        IndexName: "GSI2",
        KeyConditionExpression:
          "GSI2PK = :pk AND begins_with(GSI2SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": `PHOTOGRAPHER#${instagramHandle}`,
          ":skPrefix": `EVT#${eventId}`,
        },
        Limit: limit,
        ExclusiveStartKey: decodeCursor(cursor),
        ScanIndexForward: false, // Newest first
      });
    } else {
      const pk = `ORG#${organizerId}#EVT#${eventId}`;
      command = new QueryCommand({
        TableName: TABLES.PHOTO_SERVICE,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":skPrefix": "PHOTO#",
        },
        Limit: limit,
        ExclusiveStartKey: decodeCursor(cursor),
        ScanIndexForward: false, // Newest first
      });
    }

    const result: QueryCommandOutput = await dynamoClient.send(command);
    const items = (result.Items as PhotoItem[]) ?? [];
    const nextCursor = result.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString("base64")
      : undefined;

    const mappedItems: Photo[] = items.map((item) => {
      const key = item.processedKey || item.rawKey;
      return {
        pid: PhotoService.extractPidFromKey(key),
        src: key,
        width: item.dimensions.width,
        height: item.dimensions.height,
        eventId: item.eventId,
        orgId: item.orgId,
        thumbHash: item.thumbHash,
        instagramHandle: item.instagramHandle,
      };
    });

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
      ExclusiveStartKey: decodeCursor(cursor),
      ScanIndexForward: false, // Newest first
    });

    const queryResult: QueryCommandOutput =
      await dynamoClient.send(queryCommand);
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

    const batchResult: BatchGetCommandOutput =
      await dynamoClient.send(batchCommand);
    const photoItems =
      (batchResult.Responses?.[TABLES.PHOTO_SERVICE] as PhotoItem[]) ?? [];

    // 3. Re-sort because BatchGet loses order
    const photoMap = new Map(photoItems.map((p) => [p.ulid, p]));
    const sortedPhotos = indexItems
      .map((item) => photoMap.get(item.ulid))
      .filter((p): p is PhotoItem => !!p)
      .map((item) => {
        const key = item.processedKey;
        return {
          pid: PhotoService.extractPidFromKey(key),
          s3Key: key,
          src: key,
          width: item.dimensions.width,
          height: item.dimensions.height,
          eventId: item.eventId,
          orgId: item.orgId,
          thumbHash: item.thumbHash,
          instagramHandle: item.instagramHandle,
        } as Photo;
      });

    const nextCursor = queryResult.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(queryResult.LastEvaluatedKey)).toString(
          "base64",
        )
      : undefined;

    return { items: sortedPhotos, nextCursor };
  }

  /**
   * Get photo count for an event.
   * Uses cached query with Select: "COUNT"
   */
  static async getPhotoCountByEvent({
    organizerId,
    eventId,
  }: {
    organizerId: string;
    eventId: string;
  }) {
    return getCachedPhotoCountByEvent(organizerId, eventId);
  }

  /**
   * Get photo count by Bib number.
   * Uses cached query with Select: "COUNT" on GSI1
   */
  static async getPhotoCountByBib({
    eventId,
    bibNumber,
  }: {
    eventId: string;
    bibNumber: string;
  }) {
    return getCachedPhotoCountByBib(eventId, bibNumber);
  }

  /**
   * Get photo count by Photographer.
   * Uses cached query with Select: "COUNT" on GSI2
   */
  static async getPhotoCountByPhotographer({
    eventId,
    instagramHandle,
  }: {
    eventId: string;
    instagramHandle: string;
  }) {
    return getCachedPhotoCountByPhotographer(eventId, instagramHandle);
  }

  /**
   * Search photos by selfie (Lambda invocation)
   */
  static async searchBySelfie({
    image,
    organizerId,
    eventId,
    bib,
  }: {
    image: string;
    organizerId: string;
    eventId: string;
    bib?: string;
  }): Promise<SearchBySelfieResult> {
    if (!env.SEARCH_BY_SELFIE_FUNCTION_NAME) {
      throw new Error("SEARCH_BY_SELFIE_FUNCTION_NAME is not configured");
    }

    try {
      const command = new InvokeCommand({
        FunctionName: env.SEARCH_BY_SELFIE_FUNCTION_NAME,
        Payload: JSON.stringify({
          body: JSON.stringify({
            image,
            orgId: organizerId,
            eventId,
            bib,
          }),
        }),
      });

      const response: InvokeCommandOutput = await lambdaClient.send(command);

      if (response.FunctionError) {
        throw new Error(`Lambda execution error: ${response.FunctionError}`);
      }

      if (!response.Payload) {
        throw new Error("Empty payload from Lambda");
      }

      const payloadString = new TextDecoder().decode(response.Payload);
      const payloadUnknown = JSON.parse(payloadString) as unknown;

      if (!isLambdaProxyResponse(payloadUnknown)) {
        throw new Error("Invalid payload returned from Lambda");
      }

      if (payloadUnknown.statusCode !== 200) {
        throw new Error(
          `Lambda returned status ${payloadUnknown.statusCode}: ${payloadUnknown.body}`,
        );
      }

      return parseSelfieLambdaBody(payloadUnknown.body);
    } catch (error) {
      console.error("Failed to invoke searchBySelfie lambda:", error);
      throw error;
    }
  }
}
