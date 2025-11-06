import { Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

// Common Layer imports
import {
  getRunner,
  updateRunnerPhotoKeys,
  checkTableExists,
  getEventPhoto,
  updateEventPhoto,
} from "../../common-layer/nodejs/shared/dynamodb-helper";
import { ProcessingStatus, StepFunctionInput } from "../../common-layer/nodejs/shared/types";
import { validatePhotoProcessEnv } from "../../common-layer/nodejs/shared/env-validator";

const logger = new Logger({ serviceName: "db-update-lambda" });

interface DbUpdateLambdaEnv {
  EVENT_PHOTOS_TABLE: string;
  RUNNERS_TABLE?: string;
  AWS_REGION: string;
  STAGE: string;
  LOG_LEVEL?: string;
}

interface DbUpdateResult extends StepFunctionInput {
  updatedBibs?: string[];
  runnersTableStatus?: "UPDATED" | "SKIPPED" | "NOT_CONFIGURED";
}

/**
 * Lambda Handler for DB Update
 * Step Functions에서 호출되며, Runners 테이블의 PhotoKeys를 업데이트합니다.
 */
export async function handler(input: StepFunctionInput, context: Context): Promise<DbUpdateResult> {
  // 1. 환경 변수 검증
  const envValidation = validatePhotoProcessEnv(process.env, ["EVENT_PHOTOS_TABLE", "AWS_REGION", "STAGE"]);

  if (!envValidation.success) {
    logger.error("Environment validation failed", { error: envValidation.error });
    throw new Error(envValidation.error || "Environment validation failed");
  }

  const env = envValidation.env as DbUpdateLambdaEnv;

  // 2. Idempotency 체크 - 이미 완료되었는지 확인
  const existingPhoto = await getEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey);

  if (existingPhoto && existingPhoto.processing_status === ProcessingStatus.COMPLETED) {
    return {
      ...input,
      runnersTableStatus: "SKIPPED",
    };
  }

  // 3. Runners 테이블 설정 확인
  if (!env.RUNNERS_TABLE) {
    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
      processing_status: ProcessingStatus.COMPLETED,
      updated_at: new Date().toISOString(),
    });

    return {
      ...input,
      runnersTableStatus: "NOT_CONFIGURED",
    };
  }

  // 4. Runners 테이블 존재 여부 확인
  const tableExists = await checkTableExists(env.RUNNERS_TABLE);

  if (!tableExists) {
    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
      processing_status: ProcessingStatus.COMPLETED,
      updated_at: new Date().toISOString(),
    });

    return {
      ...input,
      runnersTableStatus: "SKIPPED",
    };
  }

  // 5. 감지된 Bib이 없으면 스킵
  const detectedBibs = input.detectedBibs || [];

  if (detectedBibs.length === 0) {
    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
      processing_status: ProcessingStatus.COMPLETED,
      updated_at: new Date().toISOString(),
    });

    return {
      ...input,
      updatedBibs: [],
      runnersTableStatus: "SKIPPED",
    };
  }

  try {
    // 6. 각 Bib Number에 대해 PhotoKeys 업데이트 (RunnersV2에 존재하는 경우만)
    const updatedBibs: string[] = [];
    const failedBibs: Array<{ bib: string; error: string }> = [];

    for (const bib of detectedBibs) {
      try {
        // Runner가 존재하는지 먼저 확인
        const runner = await getRunner(env.RUNNERS_TABLE, input.organizer, input.eventId, bib);

        if (runner) {
          // Runner가 존재하면 PhotoKeys 업데이트
          await updateRunnerPhotoKeys(env.RUNNERS_TABLE, input.organizer, input.eventId, bib, [input.objectKey]);
          updatedBibs.push(bib);
        }
        // Runner가 없으면 스킵 (RunnersV2에 자동 생성하지 않음)
      } catch (error: any) {
        // 개별 Bib 업데이트 실패는 경고만 출력하고 계속 진행
        logger.warn("Failed to update PhotoKeys for Bib", { bib, error: error.message });
        failedBibs.push({ bib, error: error.message });
      }
    }

    // 7. EventPhotos를 COMPLETED 상태로 업데이트
    await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
      processing_status: ProcessingStatus.COMPLETED,
      updated_at: new Date().toISOString(),
    });

    logger.info("DB update completed", {
      objectKey: input.objectKey,
      updatedBibs: updatedBibs.length,
      failedBibs: failedBibs.length,
    });

    // 8. 결과 반환
    return {
      ...input,
      updatedBibs,
      runnersTableStatus: "UPDATED",
    };
  } catch (error: any) {
    logger.error("Failed to update Runners table", { error: error.message, objectKey: input.objectKey });

    // 에러 발생 시에도 EventPhotos를 COMPLETED로 표시 (Runners 업데이트는 선택적)
    try {
      await updateEventPhoto(env.EVENT_PHOTOS_TABLE, input.organizer, input.eventId, input.objectKey, {
        processing_status: ProcessingStatus.COMPLETED,
        updated_at: new Date().toISOString(),
      });
    } catch (updateError: any) {
      // 무시
    }

    throw error;
  }
}
