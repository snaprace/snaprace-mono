import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";

// Common Layer imports
import { searchFacesByImage } from "../../common-layer/nodejs/shared/rekognition-helper";
import { updateRunnerPhotoKeys } from "../../common-layer/nodejs/shared/dynamodb-helper";
import {
  successResponse,
  badRequestResponse,
  internalServerErrorResponse,
} from "../../common-layer/nodejs/shared/api-response";
import { validatePhotoProcessEnv, getPhotoProcessConfig } from "../../common-layer/nodejs/shared/env-validator";

const logger = new Logger({ serviceName: "search-by-selfie-api" });

interface SearchBySelfieEnv {
  RUNNERS_TABLE?: string;
  REKOGNITION_COLLECTION_PREFIX: string;
  AWS_REGION: string;
  STAGE: string;
  LOG_LEVEL?: string;
}

interface SelfieSearchRequest {
  organizer: string;
  eventId: string;
  selfieImage: string; // Base64 encoded image
}

/**
 * Lambda Handler for Selfie Search API
 * POST /search/selfie
 * Body: { organizer, eventId, selfieImage (base64) }
 */
export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  logger.info("Search by Selfie API invoked", {
    requestId: context.awsRequestId,
  });

  try {
    // 1. 환경 변수 검증
    const envValidation = validatePhotoProcessEnv(process.env, [
      "REKOGNITION_COLLECTION_PREFIX",
      "AWS_REGION",
      "STAGE",
    ]);

    if (!envValidation.success) {
      logger.error("Environment validation failed", {
        error: envValidation.error,
      });
      return internalServerErrorResponse("Internal server configuration error");
    }

    const env = envValidation.env as SearchBySelfieEnv;
    const config = getPhotoProcessConfig(process.env);

    // 2. Request Body 파싱 및 검증
    if (!event.body) {
      logger.warn("Missing request body");
      return badRequestResponse("Request body is required");
    }

    let requestBody: SelfieSearchRequest;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      logger.warn("Invalid JSON in request body");
      return badRequestResponse("Invalid JSON format");
    }

    const { organizer, eventId, selfieImage } = requestBody;

    if (!organizer || !eventId || !selfieImage) {
      logger.warn("Missing required fields", { organizer, eventId, hasSelfieImage: !!selfieImage });
      return badRequestResponse("Missing required fields: organizer, eventId, selfieImage");
    }

    // Base64 이미지 검증
    if (!selfieImage.match(/^[A-Za-z0-9+/]+=*$/)) {
      logger.warn("Invalid base64 image format");
      return badRequestResponse("selfieImage must be a valid base64 encoded image");
    }

    logger.info("Processing Selfie search", {
      organizer,
      eventId,
      imageSize: selfieImage.length,
    });

    // 3. Rekognition Collection ID 생성
    const collectionId = `${env.REKOGNITION_COLLECTION_PREFIX}-${organizer}-${eventId}`;

    logger.debug("Searching faces in collection", {
      collectionId,
    });

    // 4. Rekognition SearchFacesByImage 호출
    const imageBuffer = Buffer.from(selfieImage, "base64");

    const searchResult = await searchFacesByImage(
      collectionId,
      imageBuffer,
      10, // maxFaces
      config.minFaceConfidence // faceMatchThreshold
    );

    const faceMatches = searchResult.FaceMatches || [];

    logger.info("Face search completed", {
      matchCount: faceMatches.length,
    });

    const cloudfrontUrl = "https://images.snap-race.com/";

    // 5. ExternalImageId에서 S3 경로 추출 및 CloudFront URL 생성
    // ExternalImageId는 sanitize된 형태 (: 사용, 선행 _는 @ 변환됨, 공백은 _ 변환)
    // 원본 S3 경로로 복원 후 CloudFront URL과 조합
    const sanitizedPhotoKeys = faceMatches
      .map((match) => match.Face?.ExternalImageId)
      .filter((id): id is string => !!id);

    // sanitize된 경로를 원본 S3 경로로 복원하고 CloudFront URL 생성
    const imageUrls = sanitizedPhotoKeys.map((key) => {
      // 1. : -> / 변환
      const pathParts = key.split(":");
      const fileName = pathParts[pathParts.length - 1];
      const dirPath = pathParts.slice(0, -1).join("/");

      // 2. 파일명 복원
      let restoredFileName = fileName;

      // 선행 _는 @로 변환
      if (restoredFileName.startsWith("_")) {
        restoredFileName = "@" + restoredFileName.substring(1);
      }

      // 대문자 약어(2글자+) 뒤 언더스코어 뒤에 또 대문자 약어(2글자+)가 오는 경우만 공백으로 복원
      // 예: "@agulosso_OMRC_NYCM25" → "@agulosso_OMRC NYCM25" ✅
      // 예: "@soyeon_is_so_young" → 그대로 유지 (소문자이므로) ✅
      restoredFileName = restoredFileName.replace(/([A-Z]{2,})_([A-Z]{2,})/g, "$1 $2");

      // 3. 전체 경로 재조합 및 인코딩
      const fullPath = dirPath ? `${dirPath}/${restoredFileName}` : restoredFileName;
      const encodedParts = fullPath.split("/").map((part) => encodeURIComponent(part));

      // 4. CloudFront URL과 조합
      return cloudfrontUrl + encodedParts.join("/");
    });

    // 중복 제거
    const uniqueImageUrls = [...new Set(imageUrls)];

    logger.info("Unique photos found", {
      uniquePhotoCount: uniqueImageUrls.length,
    });

    // 6. Runners 테이블 업데이트 (선택적 - Selfie 검색 결과도 저장)
    // Note: Bib Number를 모르므로 업데이트하지 않음
    // 추후 개선: FaceId로 Bib를 역추적하는 로직 추가 가능

    // 7. 결과 반환
    if (uniqueImageUrls.length === 0) {
      logger.info("No matching faces found", {
        organizer,
        eventId,
      });

      return successResponse({
        organizer,
        eventId,
        imageUrls: [],
        photoCount: 0,
        message: "No matching faces found. Try with a clearer selfie or different angle.",
      });
    }

    // 신뢰도가 높은 순서대로 정렬
    const sortedMatches = faceMatches
      .filter((match) => match.Face?.ExternalImageId)
      .sort((a, b) => (b.Similarity || 0) - (a.Similarity || 0))
      .map((match) => ({
        photoKey: match.Face!.ExternalImageId!,
        similarity: match.Similarity,
        faceId: match.Face!.FaceId,
      }));

    return successResponse({
      organizer,
      eventId,
      imageUrls: uniqueImageUrls,
      photoCount: uniqueImageUrls.length,
      matches: sortedMatches,
      message: `Found ${uniqueImageUrls.length} photo(s) with matching faces`,
    });
  } catch (error: any) {
    logger.error("Failed to process Selfie search", {
      error: error.message,
      stack: error.stack,
      errorName: error.name,
    });

    // Rekognition Collection이 없는 경우
    if (error.name === "ResourceNotFoundException") {
      logger.warn("Rekognition Collection not found", {
        error: error.message,
      });
      return successResponse({
        imageUrls: [],
        photoCount: 0,
        message: "No faces indexed for this event yet. Please wait for photos to be processed.",
      });
    }

    return internalServerErrorResponse("Failed to process selfie search request");
  }
}
