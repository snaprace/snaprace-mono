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
  logger.info("Detect Text Lambda invoked", {
    bucket: input.bucket,
    objectKey: input.objectKey,
    organizer: input.organizer,
    eventId: input.eventId,
    requestId: context.awsRequestId,
  });

  // 1. 환경 변수 검증
  const envValidation = validatePhotoProcessEnv(process.env, [
    "EVENT_PHOTOS_TABLE",
    "PHOTO_BIB_INDEX_TABLE",
    "AWS_REGION",
    "STAGE",
  ]);

  if (!envValidation.success) {
    logger.error("Environment validation failed", {
      error: envValidation.error,
    });
    throw new Error(envValidation.error || "Environment validation failed");
  }

  const env = envValidation.env as DetectTextLambdaEnv;
  const config = getPhotoProcessConfig(process.env);

  // 2. Idempotency 체크 - 이미 텍스트 감지가 완료되었는지 확인
  const existingPhoto = await getEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey);

  if (existingPhoto) {
    if (
      existingPhoto.ProcessingStatus === ProcessingStatus.TEXT_DETECTED ||
      existingPhoto.ProcessingStatus === ProcessingStatus.FACES_INDEXED ||
      existingPhoto.ProcessingStatus === ProcessingStatus.COMPLETED
    ) {
      logger.info("Text detection already completed, skipping", {
        objectKey: input.objectKey,
        currentStatus: existingPhoto.ProcessingStatus,
        detectedBibs: existingPhoto.DetectedBibs,
      });

      // 이미 완료된 경우 기존 결과 반환
      return {
        ...input,
        detectedBibs: existingPhoto.DetectedBibs || [],
        imageWidth: existingPhoto.ImageWidth,
        imageHeight: existingPhoto.ImageHeight,
      };
    }
  } else {
    logger.warn("EventPhoto record not found, this should not happen", {
      objectKey: input.objectKey,
    });
  }

  try {
    // 3. Rekognition DetectText 호출
    logger.info("Calling Rekognition DetectText", {
      bucket: input.bucket,
      objectKey: input.objectKey,
    });

    const detectionResult = await detectText(input.bucket, input.objectKey);

    const textDetections = detectionResult.TextDetections || [];

    // 이미지 크기 추출 (첫 번째 텍스트의 Geometry에서)
    let imageWidth = 0;
    let imageHeight = 0;

    // TextDetections 중 Parent가 null인 LINE 타입에서 이미지 크기를 유추
    for (const detection of textDetections) {
      if (detection.Type === "LINE" && detection.Geometry?.BoundingBox) {
        const bbox = detection.Geometry.BoundingBox;
        // BoundingBox는 0-1 범위의 비율이므로 실제 픽셀 크기는 별도 처리 필요
        // 일단 상대 좌표계를 사용하거나, S3에서 이미지 메타데이터를 가져와야 함
        // 간단히 처리하기 위해 표준 HD 크기를 가정 (추후 개선 필요)
        imageWidth = input.imageWidth || 1920;
        imageHeight = input.imageHeight || 1080;
        break;
      }
    }

    logger.info("DetectText completed", {
      totalDetections: textDetections.length,
      imageWidth,
      imageHeight,
    });

    // 4. Bib Number 추출 (5단계 필터링)
    logger.info("Extracting Bib numbers with filtering", {
      config: {
        minConfidence: config.minTextConfidence,
        watermarkFilterEnabled: config.watermarkFilterEnabled,
        minTextHeightPx: config.minTextHeightPx,
        bibNumberMin: config.bibNumberMin,
        bibNumberMax: config.bibNumberMax,
      },
    });

    let potentialBibs = extractBibNumbersFromText(textDetections, imageWidth, imageHeight, {
      minConfidence: config.minTextConfidence,
      watermarkFilterEnabled: config.watermarkFilterEnabled,
      watermarkAreaThreshold: config.watermarkAreaThreshold,
      minTextHeightPx: config.minTextHeightPx,
      bibNumberMin: config.bibNumberMin,
      bibNumberMax: config.bibNumberMax,
    });

    // 5. Runners 테이블로 검증 (선택적)
    let detectedBibs = potentialBibs;
    if (config.runnersTable) {
      logger.info("Validating Bibs against Runners table", {
        potentialBibsCount: potentialBibs.length,
        runnersTable: config.runnersTable,
      });

      try {
        const validBibs = await loadValidBibsForEvent(config.runnersTable, input.organizer, input.eventId);
        detectedBibs = filterBibsByValidList(potentialBibs, validBibs);

        logger.info("Bib validation completed", {
          potentialBibs: potentialBibs.length,
          validBibs: validBibs.size,
          matchedBibs: detectedBibs.length,
        });
      } catch (error: any) {
        logger.warn("Failed to load Runners table, using all detected Bibs", {
          error: error.message,
        });
        // Runners 테이블 조회 실패 시 모든 Bib 사용
      }
    }

    logger.info("Bib extraction completed", {
      detectedBibsCount: detectedBibs.length,
      detectedBibs,
    });

    // 6. PhotoBibIndex 테이블에 인덱싱 (Bib Number별로)
    if (detectedBibs.length > 0) {
      logger.info("Indexing Bibs to PhotoBibIndex table", {
        bibsToIndex: detectedBibs.length,
      });

      await batchPutPhotoBibIndex(
        env.PHOTO_BIB_INDEX_TABLE,
        input.organizer,
        input.eventId,
        input.objectKey,
        detectedBibs
      );

      logger.info("PhotoBibIndex indexing completed", {
        indexedBibs: detectedBibs.length,
      });
    } else {
      logger.warn("No valid Bibs detected in photo", {
        objectKey: input.objectKey,
      });
    }

    // 7. EventPhotos 테이블 업데이트
    const updates: Partial<EventPhoto> = {
      DetectedBibs: detectedBibs,
      ImageWidth: imageWidth,
      ImageHeight: imageHeight,
      ProcessingStatus: ProcessingStatus.TEXT_DETECTED,
      updatedAt: Date.now(),
    };

    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, updates);

    logger.info("EventPhoto updated", {
      objectKey: input.objectKey,
      status: ProcessingStatus.TEXT_DETECTED,
      detectedBibsCount: detectedBibs.length,
    });

    // 8. Step Functions로 반환 (다음 단계에서 사용)
    return {
      ...input,
      detectedBibs,
      imageWidth,
      imageHeight,
    };
  } catch (error: any) {
    logger.error("Failed to detect text", {
      error: error.message,
      stack: error.stack,
      objectKey: input.objectKey,
    });

    // 에러 상태 기록 (선택적)
    try {
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        ProcessingStatus: ProcessingStatus.PENDING, // 재시도 가능하도록 PENDING 유지
        updatedAt: Date.now(),
      });
    } catch (updateError: any) {
      logger.error("Failed to update error status", {
        error: updateError.message,
      });
    }

    throw error;
  }
}
