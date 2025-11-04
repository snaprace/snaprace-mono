/**
 * find-by-selfie Lambda Function
 *
 * 사용자가 셀카를 업로드하면 얼굴 매칭으로 관련 사진을 찾습니다.
 * - Rekognition SearchFacesByImage로 얼굴 매칭
 * - PhotoFaces 테이블에서 매칭된 얼굴의 사진 조회
 * - bib이 있으면 필터링 옵션으로 사용 (없어도 검색 가능)
 * - 중복 제거 및 최신 순 정렬
 */

import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  RekognitionClient,
  SearchFacesByImageCommand,
  FaceMatch,
} from "@aws-sdk/client-rekognition";
import { validateEnv, parseFloatEnv } from "../shared/env-validator";
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  internalServerErrorResponse,
} from "../shared/api-response";

// ============================================================================
// 타입 정의
// ============================================================================

interface FindBySelfieEnvironment {
  PHOTOS_TABLE_NAME: string;
  PHOTO_FACES_TABLE_NAME: string;
  PHOTOS_BUCKET_NAME: string;
  MIN_SIMILARITY_THRESHOLD?: string; // 얼굴 매칭 최소 유사도 (기본값: 95.0)
}

interface RequestBody {
  image: string; // Base64 인코딩된 이미지
  organizer_id: string;
  event_id: string;
  bib_number?: string; // 선택사항: bib이 있으면 필터링에 사용
}

interface PhotoResult {
  photo_id: string;
  cloudfront_url: string;
  uploaded_at: string;
  bib_number?: string;
}

// ============================================================================
// 상수 설정
// ============================================================================

const getMinSimilarityThreshold = (env: FindBySelfieEnvironment): number => {
  return parseFloatEnv(env.MIN_SIMILARITY_THRESHOLD, 95.0);
};

// ============================================================================
// AWS 클라이언트 초기화
// ============================================================================

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const rekognitionClient = new RekognitionClient({});

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * Rekognition 컬렉션 이름 생성
 * 형식: {organizer_id}-{event_id}
 */
function createCollectionId(organizerId: string, eventId: string): string {
  const sanitize = (str: string): string => {
    return str
      .replace(/[^a-zA-Z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return `${sanitize(organizerId)}-${sanitize(eventId)}`;
}

/**
 * Base64 문자열을 Buffer로 변환
 */
function base64ToBuffer(base64: string): Buffer {
  // Data URL 형식인 경우 제거
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

/**
 * 얼굴 매칭으로 사진 찾기
 */
async function findPhotosByFaces(
  photoFacesTableName: string,
  organizerId: string,
  eventId: string,
  matchedFaceIds: string[],
  filterBib?: string
): Promise<PhotoResult[]> {
  const photoMap = new Map<string, PhotoResult>();

  // 병렬 처리: 모든 얼굴 ID에 대한 DynamoDB 쿼리를 동시에 수행
  const queryPromises = matchedFaceIds.map(async (faceId) => {
    const pk = `ORG#${organizerId}#EVT#${eventId}#FACE#${faceId}`;

    const expressionAttributeValues: Record<string, any> = {
      ":pk": pk,
    };

    // bib 필터링이 있으면 ExpressionAttributeValues에 추가
    if (filterBib) {
      expressionAttributeValues[":bib"] = filterBib;
    }

    const command = new QueryCommand({
      TableName: photoFacesTableName,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: expressionAttributeValues,
      // bib 필터링이 있으면 FilterExpression 추가
      ...(filterBib && {
        FilterExpression: "bib_number = :bib",
      }),
      ScanIndexForward: false, // 최신 순으로 정렬
    });

    const result = await dynamoClient.send(command);
    return result.Items || [];
  });

  // 모든 쿼리 결과를 병렬로 처리
  const allItems = (await Promise.all(queryPromises)).flat();

  // 중복 제거하며 photoMap에 추가
  for (const item of allItems) {
    const photoId = item.photo_id;
    if (!photoMap.has(photoId)) {
      photoMap.set(photoId, {
        photo_id: photoId,
        cloudfront_url: "", // 이후 Photos 테이블에서 조회
        uploaded_at: item.uploaded_at || item.created_at || "",
        bib_number: item.bib_number,
      });
    }
  }

  return Array.from(photoMap.values());
}

/**
 * Photos 테이블에서 사진 정보 조회 (BatchGet)
 */
async function getPhotoDetails(
  photosTableName: string,
  organizerId: string,
  eventId: string,
  photoIds: string[]
): Promise<Map<string, PhotoResult>> {
  if (photoIds.length === 0) {
    return new Map();
  }

  const photoMap = new Map<string, PhotoResult>();

  // DynamoDB BatchGet은 최대 100개까지 한 번에 조회 가능
  const batchSize = 100;
  const batches: string[][] = [];

  for (let i = 0; i < photoIds.length; i += batchSize) {
    batches.push(photoIds.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    const keys = batch.map((photoId) => ({
      pk: `ORG#${organizerId}#EVT#${eventId}`,
      sk: `PHOTO#${photoId}`,
    }));

    const command = new BatchGetCommand({
      RequestItems: {
        [photosTableName]: {
          Keys: keys,
          ProjectionExpression:
            "photo_id, cloudfront_url, uploaded_at, bib_number",
        },
      },
    });

    const result = await dynamoClient.send(command);
    const items = result.Responses?.[photosTableName] || [];

    for (const item of items) {
      photoMap.set(item.photo_id, {
        photo_id: item.photo_id,
        cloudfront_url: item.cloudfront_url || "",
        uploaded_at: item.uploaded_at || item.created_at || "",
        bib_number: item.bib_number,
      });
    }
  }

  return photoMap;
}

// ============================================================================
// 메인 핸들러
// ============================================================================

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const rawEnv = process.env as Record<string, string | undefined>;

  // 환경 변수 검증
  const envValidation = validateEnv<FindBySelfieEnvironment>(rawEnv, [
    "PHOTOS_TABLE_NAME",
    "PHOTO_FACES_TABLE_NAME",
    "PHOTOS_BUCKET_NAME",
  ]);

  if (!envValidation.success || !envValidation.env) {
    return internalServerErrorResponse(
      envValidation.error || "Missing required environment variables"
    );
  }

  const env = envValidation.env;

  try {
    // 1. 요청 본문 파싱
    let requestBody: RequestBody;
    try {
      requestBody = JSON.parse(event.body || "{}");
    } catch (error) {
      return badRequestResponse("Invalid JSON in request body");
    }

    const { image, organizer_id, event_id, bib_number } = requestBody;

    // 필수 필드 검증 (bib_number는 선택사항)
    if (!image || !organizer_id || !event_id) {
      return badRequestResponse(
        "Missing required fields: image, organizer_id, event_id"
      );
    }

    console.log(
      `Processing selfie search: event=${event_id}, bib=${bib_number || "none"}`
    );

    // 2. Base64 이미지를 Buffer로 변환
    let imageBuffer: Buffer;
    try {
      imageBuffer = base64ToBuffer(image);
    } catch (error) {
      return badRequestResponse("Invalid base64 image format");
    }

    // 3. Rekognition 컬렉션 확인 및 얼굴 검색
    const collectionId = createCollectionId(organizer_id, event_id);
    const minSimilarityThreshold = getMinSimilarityThreshold(env);

    let faceMatches: FaceMatch[] = [];
    try {
      const searchCommand = new SearchFacesByImageCommand({
        CollectionId: collectionId,
        Image: { Bytes: imageBuffer },
        FaceMatchThreshold: minSimilarityThreshold,
        MaxFaces: 100, // 최대 100개 얼굴 매칭
      });

      const searchResponse = await rekognitionClient.send(searchCommand);
      faceMatches = searchResponse.FaceMatches || [];
    } catch (error: any) {
      // 컬렉션이 없거나 접근할 수 없는 경우
      if (error.name === "ResourceNotFoundException") {
        console.warn(
          `Collection not found: ${collectionId}. No faces indexed yet.`
        );
        return successResponse({
          message: "No collection found. No photos indexed yet.",
          photos: [],
          matched_faces: 0,
        });
      }
      // 다른 에러는 재던지기
      throw error;
    }

    if (faceMatches.length === 0) {
      return successResponse({
        message: "No matching faces found",
        photos: [],
        matched_faces: 0,
      });
    }

    console.log(`Found ${faceMatches.length} matching faces`);

    // 4. 매칭된 얼굴 ID 추출
    const matchedFaceIds = faceMatches
      .map((match) => match.Face?.FaceId)
      .filter((id): id is string => !!id);

    // 5. PhotoFaces 테이블에서 관련 사진 찾기
    const photoResults = await findPhotosByFaces(
      env.PHOTO_FACES_TABLE_NAME!,
      organizer_id,
      event_id,
      matchedFaceIds,
      bib_number // bib이 있으면 필터링
    );

    console.log(
      `Found ${photoResults.length} photos from PhotoFaces (filterBib: ${bib_number || "none"})`
    );

    if (photoResults.length === 0) {
      return successResponse({
        message: "No photos found for matched faces",
        photos: [],
        matched_faces: faceMatches.length,
      });
    }

    // 6. Photos 테이블에서 상세 정보 조회 (cloudfront_url 등)
    const photoIds = photoResults.map((p) => p.photo_id);
    const photoDetailsMap = await getPhotoDetails(
      env.PHOTOS_TABLE_NAME!,
      organizer_id,
      event_id,
      photoIds
    );

    // 7. 결과 병합 및 정렬
    const photos: PhotoResult[] = photoResults
      .map((photo) => {
        const details = photoDetailsMap.get(photo.photo_id);
        return {
          ...photo,
          cloudfront_url: details?.cloudfront_url || photo.cloudfront_url,
          uploaded_at: details?.uploaded_at || photo.uploaded_at,
        };
      })
      .filter((photo) => photo.cloudfront_url) // cloudfront_url이 있는 것만
      .sort((a, b) => {
        // 최신 순으로 정렬
        return (
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
      });

    console.log(`Returning ${photos.length} photos`);

    return successResponse({
      message: `Found ${photos.length} photos`,
      photos,
      matched_faces: faceMatches.length,
      filtered_by_bib: !!bib_number,
    });
  } catch (error: any) {
    console.error("Error processing selfie search:", error);

    return internalServerErrorResponse(error, {
      message: error.message,
    });
  }
};
