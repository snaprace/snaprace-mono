import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

// Common Layer imports
import { detectFaces, indexFaces, ensureCollectionExists } from "../../common-layer/nodejs/shared/rekognition-helper";
import { getEventPhoto, updateEventPhoto } from "../../common-layer/nodejs/shared/dynamodb-helper";
import { ProcessingStatus, StepFunctionInput, EventPhoto } from "../../common-layer/nodejs/shared/types";
import { validatePhotoProcessEnv, getPhotoProcessConfig } from "../../common-layer/nodejs/shared/env-validator";

const logger = new Logger({ serviceName: "index-faces-lambda" });

interface IndexFacesLambdaEnv {
  EVENT_PHOTOS_TABLE: string;
  REKOGNITION_COLLECTION_PREFIX: string;
  AWS_REGION: string;
  STAGE: string;
  LOG_LEVEL?: string;
}

/**
 * Lambda Handler for Index Faces
 * Step Functions에서 호출되며, 사진에서 얼굴을 감지하고 Rekognition Collection에 인덱싱합니다.
 */
export async function handler(input: StepFunctionInput, context: Context): Promise<StepFunctionInput> {
  logger.info("Index Faces Lambda invoked", {
    bucket: input.bucket,
    objectKey: input.objectKey,
    organizer: input.organizer,
    eventId: input.eventId,
    detectedBibsCount: input.detectedBibs?.length || 0,
    requestId: context.awsRequestId,
  });

  // 1. 환경 변수 검증
  const envValidation = validatePhotoProcessEnv(process.env, [
    "EVENT_PHOTOS_TABLE",
    "REKOGNITION_COLLECTION_PREFIX",
    "AWS_REGION",
    "STAGE",
  ]);

  if (!envValidation.success) {
    logger.error("Environment validation failed", {
      error: envValidation.error,
    });
    throw new Error(envValidation.error || "Environment validation failed");
  }

  const env = envValidation.env as IndexFacesLambdaEnv;
  const config = getPhotoProcessConfig(process.env);

  // 2. Idempotency 체크 - 이미 얼굴 인덱싱이 완료되었는지 확인
  const existingPhoto = await getEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey);

  if (existingPhoto) {
    if (
      existingPhoto.ProcessingStatus === ProcessingStatus.FACES_INDEXED ||
      existingPhoto.ProcessingStatus === ProcessingStatus.COMPLETED
    ) {
      logger.info("Face indexing already completed, skipping", {
        objectKey: input.objectKey,
        currentStatus: existingPhoto.ProcessingStatus,
        faceIds: existingPhoto.FaceIds,
      });

      // 이미 완료된 경우 기존 결과 반환
      return {
        ...input,
        faceIds: existingPhoto.FaceIds || [],
      };
    }
  }

  try {
    // 3. 조건부 IndexFaces - DetectFaces로 먼저 체크 (비용 최적화)
    logger.info("Detecting faces before indexing", {
      bucket: input.bucket,
      objectKey: input.objectKey,
    });

    const detectResult = await detectFaces(input.bucket, input.objectKey, ["ALL"]);

    const faceCount = detectResult.FaceDetails?.length || 0;

    logger.info("Face detection completed", {
      faceCount,
      minConfidence: config.minFaceConfidence,
    });

    // 얼굴이 없으면 스킵
    if (faceCount === 0) {
      logger.info("No faces detected, skipping indexing", {
        objectKey: input.objectKey,
      });

      // EventPhotos 업데이트 (얼굴 없음 상태)
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        FaceIds: [],
        ProcessingStatus: ProcessingStatus.FACES_INDEXED,
        isGroupPhoto: false,
        updatedAt: Date.now(),
      });

      return {
        ...input,
        faceIds: [],
      };
    }

    // 4. Rekognition Collection 생성/확인
    const collectionId = `${env.REKOGNITION_COLLECTION_PREFIX}-${input.organizer}-${input.eventId}`;

    logger.info("Ensuring Rekognition Collection exists", {
      collectionId,
    });

    await ensureCollectionExists(collectionId);

    logger.info("Collection ready", {
      collectionId,
    });

    // 5. IndexFaces 호출
    logger.info("Indexing faces to Rekognition Collection", {
      collectionId,
      objectKey: input.objectKey,
      maxFaces: config.maxFacesPerPhoto,
    });

    const indexResult = await indexFaces(
      collectionId,
      input.bucket,
      input.objectKey,
      input.objectKey, // ExternalImageId로 S3 경로 사용
      config.maxFacesPerPhoto,
      "AUTO", // qualityFilter
      ["ALL"] // detectionAttributes
    );

    const faceRecords = indexResult.FaceRecords || [];
    const faceIds = faceRecords.map((record) => record.Face?.FaceId).filter((id): id is string => !!id);

    logger.info("Face indexing completed", {
      indexedFaces: faceIds.length,
      faceIds,
      unindexedFaces: indexResult.UnindexedFaces?.length || 0,
    });

    // UnindexedFaces 로깅 (디버깅용)
    if (indexResult.UnindexedFaces && indexResult.UnindexedFaces.length > 0) {
      logger.warn("Some faces were not indexed", {
        unindexedFaces: indexResult.UnindexedFaces.map((f) => ({
          reasons: f.Reasons,
        })),
      });
    }

    // 6. 그룹 사진 감지
    const detectedBibsCount = input.detectedBibs?.length || 0;
    const isGroupPhoto = detectedBibsCount > 1 && faceIds.length > 1;

    logger.info("Group photo detection", {
      detectedBibs: detectedBibsCount,
      indexedFaces: faceIds.length,
      isGroupPhoto,
    });

    // 7. EventPhotos 테이블 업데이트
    const updates: Partial<EventPhoto> = {
      FaceIds: faceIds,
      ProcessingStatus: ProcessingStatus.FACES_INDEXED,
      isGroupPhoto,
      updatedAt: Date.now(),
    };

    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, updates);

    logger.info("EventPhoto updated", {
      objectKey: input.objectKey,
      status: ProcessingStatus.FACES_INDEXED,
      faceIdsCount: faceIds.length,
      isGroupPhoto,
    });

    // 8. Step Functions로 반환 (다음 단계에서 사용)
    return {
      ...input,
      faceIds,
    };
  } catch (error: any) {
    logger.error("Failed to index faces", {
      error: error.message,
      stack: error.stack,
      objectKey: input.objectKey,
    });

    // 에러 상태 기록 (선택적)
    try {
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        ProcessingStatus: ProcessingStatus.TEXT_DETECTED, // 재시도 가능하도록 이전 상태 유지
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
