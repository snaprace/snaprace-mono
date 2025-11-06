import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import sizeOf from "image-size";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({ serviceName: "image-helper" });
const s3Client = new S3Client({});

/**
 * Stream을 Buffer로 변환
 */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/**
 * S3에서 이미지 크기를 가져옵니다.
 * 이미지 헤더 부분만 다운로드하여 효율적으로 크기를 파악합니다.
 *
 * @param bucket S3 버킷 이름
 * @param key S3 객체 키
 * @returns 이미지의 너비와 높이
 */
export async function getImageDimensions(bucket: string, key: string): Promise<{ width: number; height: number }> {
  try {
    logger.debug("Fetching image dimensions from S3", { bucket, key });

    // 이미지 헤더 부분만 다운로드 (처음 64KB면 대부분의 이미지 포맷에서 충분)
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: "bytes=0-65535", // 처음 64KB만
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("Empty response body from S3");
    }

    // Stream을 Buffer로 변환
    const buffer = await streamToBuffer(response.Body as Readable);

    // image-size로 크기 파악
    const dimensions = sizeOf(buffer);

    if (!dimensions.width || !dimensions.height) {
      throw new Error("Could not determine image dimensions");
    }

    logger.debug("Image dimensions retrieved", {
      width: dimensions.width,
      height: dimensions.height,
    });

    return {
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch (error: any) {
    logger.error("Failed to get image dimensions", {
      bucket,
      key,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}
