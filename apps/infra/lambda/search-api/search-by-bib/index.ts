import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

// Common Layer imports
import { getRunner, queryPhotoBibIndex } from "../../common-layer/nodejs/shared/dynamodb-helper";
import {
  successResponse,
  badRequestResponse,
  internalServerErrorResponse,
} from "../../common-layer/nodejs/shared/api-response";
import { validatePhotoProcessEnv } from "../../common-layer/nodejs/shared/env-validator";

const logger = new Logger({ serviceName: "search-by-bib-api" });

interface SearchByBibEnv {
  RUNNERS_TABLE?: string;
  PHOTO_BIB_INDEX_TABLE: string;
  AWS_REGION: string;
  STAGE: string;
  LOG_LEVEL?: string;
}

/**
 * Lambda Handler for Bib Number Search API
 * GET /search/bib?organizer={org}&eventId={event}&bibNumber={bib}
 */
export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  logger.info("Search by Bib API invoked", {
    queryStringParameters: event.queryStringParameters,
    requestId: context.awsRequestId,
  });

  try {
    // 1. 환경 변수 검증
    const envValidation = validatePhotoProcessEnv(process.env, ["PHOTO_BIB_INDEX_TABLE", "AWS_REGION", "STAGE"]);

    if (!envValidation.success) {
      logger.error("Environment validation failed", {
        error: envValidation.error,
      });
      return internalServerErrorResponse("Internal server configuration error");
    }

    const env = envValidation.env as SearchByBibEnv;

    // 2. Query Parameters 추출 및 검증
    const queryParams = event.queryStringParameters || {};
    const { organizer, eventId, bibNumber } = queryParams;

    if (!organizer || !eventId || !bibNumber) {
      logger.warn("Missing required parameters", { queryParams });
      return badRequestResponse("Missing required parameters: organizer, eventId, bibNumber");
    }

    // Bib Number 숫자 검증
    if (!/^\d+$/.test(bibNumber)) {
      logger.warn("Invalid bibNumber format", { bibNumber });
      return badRequestResponse("bibNumber must be a numeric value");
    }

    logger.info("Processing Bib search", {
      organizer,
      eventId,
      bibNumber,
    });

    let photoKeys: string[] = [];

    // 3. Runners 테이블 우선 조회 (최적화 - 있으면 가장 빠름)
    if (env.RUNNERS_TABLE) {
      try {
        logger.debug("Checking Runners table first", {
          runnersTable: env.RUNNERS_TABLE,
        });

        const runner = await getRunner(env.RUNNERS_TABLE, organizer, eventId, bibNumber);

        if (runner && runner.PhotoKeys && runner.PhotoKeys.length > 0) {
          photoKeys = runner.PhotoKeys;

          logger.info("Found photos in Runners table", {
            bibNumber,
            photoCount: photoKeys.length,
          });

          return successResponse({
            bibNumber,
            organizer,
            eventId,
            photoKeys,
            photoCount: photoKeys.length,
            source: "runners_table",
          });
        }

        logger.debug("No photos found in Runners table, falling back to PhotoBibIndex", {
          bibNumber,
        });
      } catch (error: any) {
        logger.warn("Failed to query Runners table, using PhotoBibIndex fallback", {
          error: error.message,
        });
      }
    }

    // 4. PhotoBibIndex 테이블 조회 (Fallback)
    logger.debug("Querying PhotoBibIndex table", {
      photoBibIndexTable: env.PHOTO_BIB_INDEX_TABLE,
    });

    photoKeys = await queryPhotoBibIndex(env.PHOTO_BIB_INDEX_TABLE, organizer, eventId, bibNumber);

    logger.info("PhotoBibIndex query completed", {
      bibNumber,
      photoCount: photoKeys.length,
    });

    // 5. 결과 반환
    if (photoKeys.length === 0) {
      logger.info("No photos found for Bib", {
        bibNumber,
        organizer,
        eventId,
      });

      return successResponse({
        bibNumber,
        organizer,
        eventId,
        photoKeys: [],
        photoCount: 0,
        message: "No photos found for this bib number",
      });
    }

    return successResponse({
      bibNumber,
      organizer,
      eventId,
      photoKeys,
      photoCount: photoKeys.length,
      source: "photo_bib_index",
    });
  } catch (error: any) {
    logger.error("Failed to process Bib search", {
      error: error.message,
      stack: error.stack,
    });

    return internalServerErrorResponse("Failed to process search request");
  }
}
