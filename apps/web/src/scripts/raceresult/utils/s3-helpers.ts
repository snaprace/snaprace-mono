/**
 * S3 업로드 헬퍼 함수
 */

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_RETRIES = 3;

/**
 * S3 클라이언트 생성
 */
function createS3Client(): S3Client {
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.",
    );
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * JSON 데이터를 S3에 업로드합니다.
 */
export async function uploadJsonToS3(
  bucket: string,
  key: string,
  data: unknown,
  maxRetries = MAX_RETRIES,
): Promise<void> {
  const s3Client = createS3Client();
  const jsonString = JSON.stringify(data, null, 2);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: jsonString,
        ContentType: "application/json",
      });

      await s3Client.send(command);
      console.log(`   ✅ S3 업로드 완료: ${key}`);
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // 지수 백오프: 1초, 2초, 4초
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`   ⏳ 재시도 전 대기 중... (${delay}ms)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * 여러 파일을 S3에 업로드합니다.
 */
export async function uploadMultipleFilesToS3(
  bucket: string,
  files: Array<{ key: string; data: unknown }>,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await uploadJsonToS3(bucket, file.key, file.data);
      success++;
    } catch (error) {
      console.error(`   ❌ S3 업로드 실패: ${file.key}`, error);
      failed++;
    }
  }

  return { success, failed };
}

