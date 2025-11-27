import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import {
  RekognitionClient,
  DeleteFacesCommand,
} from "@aws-sdk/client-rekognition";

// 환경 설정
const REGION = "us-east-1";
const TABLE_NAME = "PhotoService";
const BUCKET_NAME = "snaprace-images";

// 클라이언트 초기화
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });
const rekognition = new RekognitionClient({ region: REGION });

async function main() {
  const handle = process.argv[2];

  if (!handle) {
    console.error("\n❌ Error: Instagram handle is required.");
    console.error("Usage: pnpm cleanup-photographer <instagram_handle>\n");
    console.error("Example: pnpm cleanup-photographer @john_doe\n");
    process.exit(1);
  }

  console.log(`\n🔍 Finding photos for ${handle}...\n`);

  // 1. DB에서 해당 포토그래퍼의 모든 사진 조회
  let items: any[] = [];
  let lastEvaluatedKey;

  try {
    do {
      const queryParams: any = {
        TableName: TABLE_NAME,
        IndexName: "GSI2",
        KeyConditionExpression: "GSI2PK = :pk",
        ExpressionAttributeValues: {
          ":pk": `PHOTOGRAPHER#${handle}`,
        },
      };

      if (lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = lastEvaluatedKey;
      }

      const res: any = await ddb.send(new QueryCommand(queryParams));

      if (res.Items) items.push(...res.Items);
      lastEvaluatedKey = res.LastEvaluatedKey;

      if (lastEvaluatedKey) {
        process.stdout.write(".");
      }
    } while (lastEvaluatedKey);
  } catch (error) {
    console.error("❌ Failed to query DynamoDB:", error);
    process.exit(1);
  }

  if (items.length === 0) {
    console.log("✅ No photos found for this photographer.");
    return;
  }

  console.log(`\n📸 Found ${items.length} photos.`);
  console.log(
    "⚠️  Warning: This will delete RAW images, PROCESSED images, FACE records, and DB entries."
  );
  console.log("   There is NO UNDO.");

  // 확인 절차 (인터랙티브 모드가 아니면 생략 가능하지만 안전을 위해 5초 대기)
  console.log("\n⏳ Starting cleanup in 3 seconds... (Ctrl+C to cancel)");
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 배치 처리를 위한 청크 유틸리티
  const chunk = (arr: any[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
      arr.slice(i * size, i * size + size)
    );

  // 2. S3 이미지 삭제 (Raw + Processed)
  console.log("\n🗑️  Deleting images from S3...");

  const s3KeysToDelete = items.flatMap((item) => {
    const keys = [];
    if (item.rawKey) keys.push({ Key: item.rawKey });
    if (item.processedKey) keys.push({ Key: item.processedKey });
    return keys;
  });

  if (s3KeysToDelete.length > 0) {
    const s3Chunks = chunk(s3KeysToDelete, 1000); // S3 delete limit is 1000
    let deletedCount = 0;

    for (const batch of s3Chunks) {
      if (batch.length > 0) {
        try {
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: BUCKET_NAME,
              Delete: { Objects: batch },
            })
          );
          deletedCount += batch.length;
          process.stdout.write(".");
        } catch (error) {
          console.error(`\n❌ Failed to delete S3 batch:`, error);
        }
      }
    }
    console.log(`\n✅ Deleted ${deletedCount} files from S3`);
  } else {
    console.log("   No S3 keys to delete.");
  }

  // 3. Rekognition 얼굴 삭제
  console.log("\n👤 Deleting faces from Rekognition Collections...");

  // 얼굴은 Collection별로 지워야 하므로 이벤트를 그룹화
  const facesByEvent: Record<string, string[]> = {};
  items.forEach((item) => {
    if (item.orgId && item.eventId && item.faceIds && item.faceIds.length > 0) {
      const collectionId = `${item.orgId}-${item.eventId}`;
      if (!facesByEvent[collectionId]) facesByEvent[collectionId] = [];
      facesByEvent[collectionId].push(...item.faceIds);
    }
  });

  const collections = Object.keys(facesByEvent);
  if (collections.length > 0) {
    for (const collectionId of collections) {
      const faceIds = facesByEvent[collectionId];
      const faceChunks = chunk(faceIds, 1000); // Rekognition limit

      for (const batch of faceChunks) {
        try {
          await rekognition.send(
            new DeleteFacesCommand({
              CollectionId: collectionId,
              FaceIds: batch,
            })
          );
          console.log(
            `   - Deleted ${batch.length} faces from collection: ${collectionId}`
          );
        } catch (e: any) {
          if (e.name === "ResourceNotFoundException") {
            console.log(
              `   - Collection not found (already deleted?): ${collectionId}`
            );
          } else {
            console.warn(
              `   ❌ Failed to delete faces from ${collectionId}:`,
              e.message
            );
          }
        }
      }
    }
  } else {
    console.log("   No face records to delete.");
  }

  // 4. DynamoDB 아이템 삭제 (Photo + Bib Index)
  console.log("\n📚 Deleting metadata from DynamoDB...");

  const deleteRequests = [];
  for (const item of items) {
    // Photo Item
    if (item.PK && item.SK) {
      deleteRequests.push({
        DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
      });
    }

    // Bib Index Items (bibs 배열 순회)
    if (item.bibs && Array.isArray(item.bibs)) {
      for (const bib of item.bibs) {
        // Bib Index SK 패턴: BIB#<bib>#PHOTO#<ulid>
        // 주의: item.ulid가 있어야 함
        if (item.ulid) {
          deleteRequests.push({
            DeleteRequest: {
              Key: { PK: item.PK, SK: `BIB#${bib}#PHOTO#${item.ulid}` },
            },
          });
        }
      }
    }
  }

  if (deleteRequests.length > 0) {
    const dbChunks = chunk(deleteRequests, 25); // DynamoDB batch limit is 25
    let dbDeletedCount = 0;

    for (const batch of dbChunks) {
      const params: any = { RequestItems: { [TABLE_NAME]: batch } };
      let unprocessed = null;
      let retries = 0;

      do {
        if (unprocessed) {
          params.RequestItems = unprocessed;
          await new Promise((r) => setTimeout(r, Math.pow(2, retries) * 100)); // Exponential backoff
          retries++;
        }

        try {
          const res = await ddb.send(new BatchWriteCommand(params));
          unprocessed =
            res.UnprocessedItems && Object.keys(res.UnprocessedItems).length > 0
              ? res.UnprocessedItems
              : null;
        } catch (error) {
          console.error("\n❌ DynamoDB batch write error:", error);
          break;
        }
      } while (unprocessed && retries < 5);

      dbDeletedCount += batch.length;
      process.stdout.write(".");
    }
    console.log(`\n✅ Deleted ${dbDeletedCount} items from DB`);
  } else {
    console.log("   No DB items to delete.");
  }

  console.log("\n✨ Cleanup complete!\n");
}

main().catch(console.error);
