import { S3Event, S3EventRecord, Context } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { Logger } from "@aws-lambda-powertools/logger";

// Common Layer imports - 상대 경로로 참조
// 런타임에는 Layer를 통해 /opt/nodejs/shared에서 로드됨
import { getEventPhoto, putEventPhoto } from "../../common-layer/nodejs/shared/dynamodb-helper";
import { ProcessingStatus, StepFunctionInput } from "../../common-layer/nodejs/shared/types";
import { validatePhotoProcessEnv } from "../../common-layer/nodejs/shared/env-validator";
import { successResponse } from "../../common-layer/nodejs/shared/api-response";

const logger = new Logger({ serviceName: "starter-lambda" });
const sfnClient = new SFNClient({});

interface ParsedS3Path {
  organizer: string;
  eventId: string;
  filename: string;
  objectKey: string;
}

interface StarterLambdaEnv {
  STATE_MACHINE_ARN: string;
  EVENT_PHOTOS_TABLE: string;
  AWS_REGION: string;
  STAGE: string;
  LOG_LEVEL?: string;
}

/**
 * S3 객체 키를 파싱하여 organizer, eventId, filename을 추출
 * 경로 패턴: {organizer}/{eventId}/photos/raw/{filename}
 */
function parseS3ObjectKey(objectKey: string): ParsedS3Path {
  // URL 디코딩 처리
  let decodedKey = decodeURIComponent(objectKey.replace(/\+/g, " "));

  // 정규식으로 파싱
  const regex = /^([^/]+)\/([^/]+)\/photos\/raw\/(.+)$/;
  const match = decodedKey.match(regex);

  if (!match) {
    throw new Error(
      `Invalid S3 path format. Expected: {organizer}/{eventId}/photos/raw/{filename}, Got: ${decodedKey}`
    );
  }

  const [, organizer, eventId, filename] = match;

  return {
    organizer,
    eventId,
    filename,
    objectKey: decodedKey,
  };
}

/**
 * S3 Event 레코드를 처리
 */
async function processS3Record(record: S3EventRecord, env: StarterLambdaEnv): Promise<void> {
  const bucket = record.s3.bucket.name;
  const objectKey = record.s3.object.key;

  // 1. S3 경로 파싱
  const parsed = parseS3ObjectKey(objectKey);

  // 2. Idempotency 체크 - 이미 처리 중인 사진인지 확인
  const existingPhoto = await getEventPhoto(env.EVENT_PHOTOS_TABLE, parsed.organizer, parsed.eventId, parsed.objectKey);

  if (existingPhoto && existingPhoto.processing_status !== ProcessingStatus.PENDING) {
    return; // 이미 처리 중이거나 완료됨
  }

  // 3. EventPhotos 초기화 (PENDING 상태로)
  const nowISO = new Date().toISOString();
  const eventKey = `ORG#${parsed.organizer}#EVT#${parsed.eventId}`;

  try {
    await putEventPhoto(env.EVENT_PHOTOS_TABLE, {
      event_key: eventKey,
      s3_path: parsed.objectKey,
      processing_status: ProcessingStatus.PENDING,
      created_at: nowISO,
      updated_at: nowISO,
    });
  } catch (error: any) {
    // ConditionalCheckFailedException은 이미 다른 실행에서 생성한 경우
    if (error.name !== "ConditionalCheckFailedException") {
      throw error;
    }
  }

  // 4. Step Functions 실행 입력 생성
  const stepFunctionInput: StepFunctionInput = {
    bucket,
    objectKey: parsed.objectKey,
    organizer: parsed.organizer,
    eventId: parsed.eventId,
  };

  // 5. Step Functions 실행
  const executionName = `photo-${parsed.organizer}-${parsed.eventId}-${Date.now()}`;

  try {
    const command = new StartExecutionCommand({
      stateMachineArn: env.STATE_MACHINE_ARN,
      name: executionName,
      input: JSON.stringify(stepFunctionInput),
    });

    await sfnClient.send(command);
  } catch (error: any) {
    if (error.name === "ExecutionAlreadyExists") {
      return; // 이미 실행 중
    }
    logger.error("Failed to start Step Functions", { error: error.message, objectKey: parsed.objectKey });
    throw error;
  }
}

/**
 * Lambda Handler
 */
export async function handler(event: S3Event, context: Context): Promise<{ statusCode: number; body: string }> {
  // 환경 변수 검증
  const envValidation = validatePhotoProcessEnv(process.env, [
    "STATE_MACHINE_ARN",
    "EVENT_PHOTOS_TABLE",
    "AWS_REGION",
    "STAGE",
  ]);

  if (!envValidation.success) {
    logger.error("Environment validation failed", { error: envValidation.error });
    throw new Error(envValidation.error || "Environment validation failed");
  }

  const env = envValidation.env as StarterLambdaEnv;
  const errors: Array<{ objectKey: string; error: string }> = [];

  // 각 S3 레코드 처리
  for (const record of event.Records) {
    try {
      await processS3Record(record, env);
    } catch (error: any) {
      const objectKey = record.s3.object.key;
      logger.error("Failed to process S3 record", { objectKey, error: error.message });
      errors.push({ objectKey, error: error.message });
    }
  }

  // 결과 반환
  if (errors.length > 0) {
    return successResponse({
      processed: event.Records.length - errors.length,
      failed: errors.length,
      errors,
    });
  }

  return successResponse({
    processed: event.Records.length,
    message: "All photos queued for processing",
  });
}
