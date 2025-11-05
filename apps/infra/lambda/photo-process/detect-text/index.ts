import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

// Common Layer imports
import { detectText } from "../../common-layer/nodejs/shared/rekognition-helper";
import {
  extractBibNumbersFromText,
  loadValidBibsForEvent,
  filterBibsByValidList,
} from "../../common-layer/nodejs/shared/bib-extractor";
import {
  getEventPhoto,
  updateEventPhoto,
  batchPutPhotoBibIndex,
} from "../../common-layer/nodejs/shared/dynamodb-helper";
import { ProcessingStatus, StepFunctionInput, EventPhoto } from "../../common-layer/nodejs/shared/types";
import { validatePhotoProcessEnv, getPhotoProcessConfig } from "../../common-layer/nodejs/shared/env-validator";
import { getImageDimensions } from "../../common-layer/nodejs/shared/image-helper";

const logger = new Logger({ serviceName: "detect-text-lambda" });

interface DetectTextLambdaEnv {
  EVENT_PHOTOS_TABLE: string;
  PHOTO_BIB_INDEX_TABLE: string;
  RUNNERS_TABLE?: string;
  AWS_REGION: string;
  STAGE: string;
  LOG_LEVEL?: string;
}

/**
 * Lambda Handler for Detect Text
 * Step Functions에서 호출되며, 사진에서 텍스트를 감지하고 Bib Number를 추출합니다.
 */
export async function handler(input: StepFunctionInput, context: Context): Promise<StepFunctionInput> {
  // 1. 환경 변수 검증
  const envValidation = validatePhotoProcessEnv(process.env, [
    "EVENT_PHOTOS_TABLE",
    "PHOTO_BIB_INDEX_TABLE",
    "AWS_REGION",
    "STAGE",
  ]);

  if (!envValidation.success) {
    logger.error("Environment validation failed", { error: envValidation.error });
    throw new Error(envValidation.error || "Environment validation failed");
  }

  const env = envValidation.env as DetectTextLambdaEnv;
  const config = getPhotoProcessConfig(process.env);

  // 2. Idempotency 체크 - 이미 텍스트 감지가 완료되었는지 확인
  const existingPhoto = await getEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey);

  if (existingPhoto) {
    if (
      existingPhoto.processing_status === ProcessingStatus.TEXT_DETECTED ||
      existingPhoto.processing_status === ProcessingStatus.FACES_INDEXED ||
      existingPhoto.processing_status === ProcessingStatus.COMPLETED
    ) {
      // 이미 완료된 경우 기존 결과 반환
      return {
        ...input,
        detectedBibs: existingPhoto.detected_bibs || [],
        imageWidth: existingPhoto.image_width,
        imageHeight: existingPhoto.image_height,
      };
    }
  }

  try {
    // 3. Rekognition DetectText 호출
    const detectionResult = await detectText(input.bucket, input.objectKey);
    const textDetections = detectionResult.TextDetections || [];

    // 이미지 크기 가져오기
    let imageWidth = input.imageWidth || 0;
    let imageHeight = input.imageHeight || 0;

    // Step Functions input에 없으면 S3에서 실제 이미지 크기 가져오기
    if (!imageWidth || !imageHeight) {
      try {
        const dimensions = await getImageDimensions(input.bucket, input.objectKey);
        imageWidth = dimensions.width;
        imageHeight = dimensions.height;
      } catch (error: any) {
        // 기본값 사용
        imageWidth = 1920;
        imageHeight = 1080;
      }
    }

    // 4. Bib Number 추출 (필터링: 신뢰도, 범위, 워터마크)
    let potentialBibs = extractBibNumbersFromText(textDetections, imageWidth, imageHeight, {
      minConfidence: config.minTextConfidence,
      watermarkFilterEnabled: config.watermarkFilterEnabled,
      watermarkAreaThreshold: config.watermarkAreaThreshold,
      bibNumberMin: config.bibNumberMin,
      bibNumberMax: config.bibNumberMax,
    });

    // 5. Runners 테이블로 검증 (선택적)
    let detectedBibs = potentialBibs;
    if (config.runnersTable) {
      try {
        const validBibs = await loadValidBibsForEvent(config.runnersTable, input.organizer, input.eventId);
        detectedBibs = filterBibsByValidList(potentialBibs, validBibs);
      } catch (error: any) {
        // Runners 테이블 조회 실패 시 모든 Bib 사용
        logger.warn("Failed to load valid bibs, using all detected bibs", { error: error.message });
      }
    }

    // 6. PhotoBibIndex 테이블에 인덱싱 (Bib Number별로)
    if (detectedBibs.length > 0) {
      await batchPutPhotoBibIndex(
        env.PHOTO_BIB_INDEX_TABLE,
        input.organizer,
        input.eventId,
        input.objectKey,
        detectedBibs
      );
    }

    // 7. EventPhotos 테이블 업데이트
    const updates: Partial<EventPhoto> = {
      detected_bibs: detectedBibs,
      image_width: imageWidth,
      image_height: imageHeight,
      processing_status: ProcessingStatus.TEXT_DETECTED,
      updated_at: new Date().toISOString(),
    };

    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, updates);

    logger.info("Text detection completed", {
      objectKey: input.objectKey,
      detectedBibs: detectedBibs.length,
    });

    // 8. Step Functions로 반환 (다음 단계에서 사용)
    return {
      ...input,
      detectedBibs,
      imageWidth,
      imageHeight,
    };
  } catch (error: any) {
    logger.error("Failed to detect text", { error: error.message, objectKey: input.objectKey });

    // 에러 상태 기록
    try {
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        processing_status: ProcessingStatus.PENDING,
        updated_at: new Date().toISOString(),
      });
    } catch (updateError: any) {
      // 무시
    }

    throw error;
  }
}
