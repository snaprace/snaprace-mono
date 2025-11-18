import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.DDB_TABLE!;

// type PhotographerProfile = {
//   instagram_handle?: string | null;
//   display_name?: string | null;
// };

// const supabase = getLambdaClient();

// async function fetchPhotographerProfile(
//   photographerId: string
// ): Promise<PhotographerProfile | null> {
//   if (!photographerId) return null;

//   const { data, error } = await supabase
//     .from("photographers")
//     .select("instagram_handle, display_name")
//     .eq("photographer_id", photographerId)
//     .maybeSingle<PhotographerProfile>();

//   if (error) {
//     console.error("Failed to fetch photographer profile from Supabase:", error);
//     return null;
//   }

//   if (!data) return null;

//   return {
//     instagram_handle: data.instagram_handle ?? null,
//     display_name: data.display_name ?? null,
//   };
// }

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
    instagramHandle,
    detectTextResult,
    indexFacesResult,
  } = event;

  const bibs: string[] = detectTextResult?.bibs ?? [];
  const faceIds: string[] = indexFacesResult?.faceIds ?? [];

  // let photographerHandle: string | null = null;
  // let photographerDisplayName: string | null = null;

  // if (photographerId) {
  //   const profile = await fetchPhotographerProfile(photographerId);
  //   if (profile) {
  //     photographerHandle = profile.instagram_handle ?? null;
  //     photographerDisplayName = profile.display_name ?? null;
  //   }
  // }

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

    bibs,
    bibCount: bibs.length,
    faceIds,
    faceCount: faceIds.length,

    createdAt: now,
    updatedAt: now,
  };

  if (instagramHandle) {
    photoItem.instagramHandle = instagramHandle;
    // Photographer 검색(GSI2)은 instagram_handle을 파티션 키 식별자로 사용
    photoItem.GSI2PK = `PHOTOGRAPHER#${instagramHandle}`;
    photoItem.GSI2SK = `EVT#${eventId}#TIME#${now}`;
  }

  const puts: PutCommand[] = [];

  // PHOTO Put
  puts.push(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: photoItem,
    })
  );

  // BIB_INDEX Put (bibs마다 1개씩)
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

    puts.push(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: bibItem,
      })
    );
  }

  for (const cmd of puts) {
    await ddb.send(cmd);
  }

  return { ok: true };
};
