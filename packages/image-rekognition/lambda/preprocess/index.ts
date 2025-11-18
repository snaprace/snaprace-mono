import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { ulid } from "ulid";

const s3 = new S3Client({});
const BUCKET_NAME = process.env.IMAGE_BUCKET!;

interface PreprocessInput {
  orgId: string;
  eventId: string;
  bucketName: string;
  rawKey: string;
  instagramHandle?: string | null;
}

interface PreprocessOutput extends PreprocessInput {
  processedKey: string;
  s3Uri: string;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  size: number;
  ulid: string;
}

export const handler = async (
  event: PreprocessInput
): Promise<PreprocessOutput> => {
  const { orgId, eventId, rawKey, instagramHandle } = event;

  try {
    const getResult = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: rawKey,
      })
    );

    const body = await getResult.Body?.transformToByteArray();
    if (!body) {
      throw new Error("Empty S3 body");
    }

    // 2. Generate ULID for processed image
    const id = ulid();
    const processedKey = `${orgId}/${eventId}/processed/${id}.jpg`;

    // 3. Process image with Sharp
    const image = sharp(body).rotate(); // Auto-rotate based on EXIF

    // Resize and compress
    const resized = await image
      .resize({
        width: 2048,
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({
        quality: 90,
        mozjpeg: true,
      })
      .toBuffer();

    // 4. Upload processed image to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processedKey,
        Body: resized,
        ContentType: "image/jpeg",
        Metadata: {
          "original-key": rawKey,
          ulid: id,
          ...(instagramHandle && { "instagram-handle": instagramHandle }),
        },
      })
    );

    // 5. Get final dimensions
    const processedMetadata = await sharp(resized).metadata();

    const result: PreprocessOutput = {
      orgId,
      eventId,
      bucketName: BUCKET_NAME,
      rawKey,
      processedKey,
      s3Uri: `s3://${BUCKET_NAME}/${processedKey}`,
      dimensions: {
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
      },
      format: "jpeg",
      size: resized.length,
      ulid: id,
      instagramHandle: instagramHandle || null,
    };

    console.log(
      `preprocess_ok ulid=${id} size=${resized.length}B w=${processedMetadata.width} h=${processedMetadata.height}`
    );
    return result;
  } catch (error) {
    console.error("Preprocess failed:", error);
    throw error;
  }
};
