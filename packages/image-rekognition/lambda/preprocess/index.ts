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
  thumbHash: string;
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

    // 3-1. Generate ThumbHash
    const { rgbaToThumbHash } = await import("thumbhash");
    const thumbBuffer = await image
      .clone()
      .resize(100, 100, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const thumbHashBinary = rgbaToThumbHash(
      thumbBuffer.info.width,
      thumbBuffer.info.height,
      thumbBuffer.data
    );
    const thumbHash = Buffer.from(thumbHashBinary).toString("base64");

    // 3-2. Resize and compress main image
    const resized = await image
      .clone()
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
        // 객체 태그: processed로 구분하여 버킷 수명주기/Intelligent-Tiering 필터에 활용
        Tagging: "folder=processed",
        Metadata: {
          "original-key": rawKey,
          ulid: id,
          "thumb-hash": thumbHash,
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
      thumbHash,
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
