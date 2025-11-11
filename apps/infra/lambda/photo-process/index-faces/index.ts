import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Attribute, QualityFilter } from "@aws-sdk/client-rekognition";

// Common Layer imports
import {
  detectFaces,
  indexFaces,
  ensureCollectionExists,
  sanitizeExternalImageId,
} from "../../common-layer/nodejs/shared/rekognition-helper";
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
  // 1. 환경 변수 검증
  const envValidation = validatePhotoProcessEnv(process.env, [
    "EVENT_PHOTOS_TABLE",
    "REKOGNITION_COLLECTION_PREFIX",
    "AWS_REGION",
    "STAGE",
  ]);

  if (!envValidation.success) {
    logger.error("Environment validation failed", { error: envValidation.error });
    throw new Error(envValidation.error || "Environment validation failed");
  }

  const env = envValidation.env as IndexFacesLambdaEnv;
  const config = getPhotoProcessConfig(process.env);

  // 2. Idempotency 체크 - 이미 얼굴 인덱싱이 완료되었는지 확인
  const existingPhoto = await getEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey);

  if (existingPhoto) {
    if (
      existingPhoto.processing_status === ProcessingStatus.FACES_INDEXED ||
      existingPhoto.processing_status === ProcessingStatus.COMPLETED
    ) {
      // 이미 완료된 경우 기존 결과 반환
      return {
        ...input,
        faceIds: existingPhoto.face_ids || [],
      };
    }
  }

  try {
    // 3. 조건부 IndexFaces - DetectFaces로 먼저 체크 (비용 최적화)
    const detectResult = await detectFaces(input.bucket, input.objectKey, [Attribute.ALL]);
    const faceCount = detectResult.FaceDetails?.length || 0;

    // 얼굴이 없으면 스킵
    if (faceCount === 0) {
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        face_ids: [],
        processing_status: ProcessingStatus.FACES_INDEXED,
        is_group_photo: false,
        updated_at: new Date().toISOString(),
      });

      return {
        ...input,
        faceIds: [],
      };
    }

    // 4. Rekognition Collection 생성/확인
    const collectionId = `${env.REKOGNITION_COLLECTION_PREFIX}-${input.organizer}-${input.eventId}`;
    await ensureCollectionExists(collectionId);

    // 5. IndexFaces 호출
    // / -> :, @ -> _ 변환 (Rekognition이 /와 @를 허용하지 않음)
    // 복원 시: : -> /, 파일명 첫 문자 _ -> @
    const externalImageId = sanitizeExternalImageId(input.objectKey);

    const indexResult = await indexFaces(
      collectionId,
      input.bucket,
      input.objectKey,
      externalImageId,
      config.maxFacesPerPhoto,
      QualityFilter.AUTO,
      [Attribute.ALL]
    );

    const faceRecords = indexResult.FaceRecords || [];
    const faceIds = faceRecords.map((record) => record.Face?.FaceId).filter((id): id is string => !!id);

    // 6. 그룹 사진 감지
    const detectedBibsCount = input.detectedBibs?.length || 0;
    const isGroupPhoto = detectedBibsCount > 1 && faceIds.length > 1;

    // 7. EventPhotos 테이블 업데이트
    const updates: Partial<EventPhoto> = {
      face_ids: faceIds,
      processing_status: ProcessingStatus.FACES_INDEXED,
      is_group_photo: isGroupPhoto,
      updated_at: new Date().toISOString(),
    };

    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, updates);

    logger.info("Face indexing completed", {
      objectKey: input.objectKey,
      faces: faceIds.length,
      isGroup: isGroupPhoto,
    });

    // 8. Step Functions로 반환 (다음 단계에서 사용)
    return {
      ...input,
      faceIds,
    };
  } catch (error: any) {
    logger.error("Failed to index faces", { error: error.message, objectKey: input.objectKey });

    // 에러 상태 기록
    try {
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        processing_status: ProcessingStatus.TEXT_DETECTED,
        updated_at: new Date().toISOString(),
      });
    } catch (updateError: any) {
      // 무시
    }

    throw error;
  }
}
