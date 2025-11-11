/**
 * Rekognition Helper 함수들
 */

import {
  RekognitionClient,
  DetectTextCommand,
  DetectFacesCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DescribeCollectionCommand,
  CreateCollectionCommand,
  DetectTextCommandOutput,
  DetectFacesCommandOutput,
  IndexFacesCommandOutput,
  SearchFacesByImageCommandOutput,
  Attribute,
  QualityFilter,
} from "@aws-sdk/client-rekognition";

// Rekognition 클라이언트 초기화
const client = new RekognitionClient({});

// Collection 캐시 (Lambda 실행 간 재사용)
const collectionCache = new Set<string>();

/**
 * DetectText API 래퍼
 */
export async function detectText(bucket: string, objectKey: string, retries = 3): Promise<DetectTextCommandOutput> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.send(
        new DetectTextCommand({
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: objectKey,
            },
          },
        })
      );

      return response;
    } catch (error: any) {
      lastError = error;

      // 재시도 불가능한 에러는 즉시 throw
      if (
        error.name === "InvalidImageFormatException" ||
        error.name === "InvalidS3ObjectException" ||
        error.name === "ImageTooLargeException"
      ) {
        throw error;
      }

      // 마지막 시도가 아니면 재시도
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000; // 지수 백오프
        console.warn(`DetectText failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("DetectText failed after retries");
}

/**
 * DetectFaces API 래퍼
 */
export async function detectFaces(
  bucket: string,
  objectKey: string,
  attributes: Attribute[] = [Attribute.ALL],
  retries = 3
): Promise<DetectFacesCommandOutput> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.send(
        new DetectFacesCommand({
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: objectKey,
            },
          },
          Attributes: attributes,
        })
      );

      return response;
    } catch (error: any) {
      lastError = error;

      if (
        error.name === "InvalidImageFormatException" ||
        error.name === "InvalidS3ObjectException" ||
        error.name === "ImageTooLargeException"
      ) {
        throw error;
      }

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`DetectFaces failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("DetectFaces failed after retries");
}

/**
 * IndexFaces API 래퍼
 */
export async function indexFaces(
  collectionId: string,
  bucket: string,
  objectKey: string,
  externalImageId: string,
  maxFaces = 10,
  qualityFilter: QualityFilter | "AUTO" | "NONE" = QualityFilter.AUTO,
  detectionAttributes: Attribute[] = [Attribute.ALL],
  retries = 3
): Promise<IndexFacesCommandOutput> {
  let lastError: Error | undefined;

  // Collection 존재 확인 및 생성
  await ensureCollectionExists(collectionId);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.send(
        new IndexFacesCommand({
          CollectionId: collectionId,
          Image: {
            S3Object: {
              Bucket: bucket,
              Name: objectKey,
            },
          },
          ExternalImageId: externalImageId,
          MaxFaces: maxFaces,
          QualityFilter: qualityFilter,
          DetectionAttributes: detectionAttributes,
        })
      );

      return response;
    } catch (error: any) {
      lastError = error;

      if (
        error.name === "InvalidImageFormatException" ||
        error.name === "InvalidS3ObjectException" ||
        error.name === "ImageTooLargeException"
      ) {
        throw error;
      }

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`IndexFaces failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("IndexFaces failed after retries");
}

/**
 * SearchFacesByImage API 래퍼
 */
export async function searchFacesByImage(
  collectionId: string,
  imageBytes: Buffer,
  maxFaces = 50,
  faceMatchThreshold = 90,
  retries = 3
): Promise<SearchFacesByImageCommandOutput> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: {
            Bytes: imageBytes,
          },
          MaxFaces: maxFaces,
          FaceMatchThreshold: faceMatchThreshold,
        })
      );

      return response;
    } catch (error: any) {
      lastError = error;

      if (
        error.name === "InvalidImageFormatException" ||
        error.name === "InvalidParameterException" ||
        error.name === "ResourceNotFoundException"
      ) {
        throw error;
      }

      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`SearchFacesByImage failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error("SearchFacesByImage failed after retries");
}

/**
 * Rekognition Collection 존재 확인 및 생성
 */
export async function ensureCollectionExists(collectionId: string): Promise<void> {
  // 캐시에 있으면 스킵
  if (collectionCache.has(collectionId)) {
    return;
  }

  try {
    // Collection 존재 확인
    await client.send(
      new DescribeCollectionCommand({
        CollectionId: collectionId,
      })
    );

    // 존재하면 캐시에 추가
    collectionCache.add(collectionId);
    console.log(`Collection ${collectionId} exists`);
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      // Collection이 없으면 생성
      console.log(`Creating collection ${collectionId}...`);
      await client.send(
        new CreateCollectionCommand({
          CollectionId: collectionId,
        })
      );

      collectionCache.add(collectionId);
      console.log(`Collection ${collectionId} created successfully`);
    } else {
      throw error;
    }
  }
}

/**
 * Collection 캐시 초기화 (테스트용)
 */
export function clearCollectionCache(): void {
  collectionCache.clear();
}

/**
 * Collection 캐시 확인
 */
export function isCollectionCached(collectionId: string): boolean {
  return collectionCache.has(collectionId);
}

/**
 * ExternalImageId를 Rekognition 요구사항에 맞게 변환
 * Rekognition 허용 패턴: [a-zA-Z0-9_.\-:]+
 *
 * 슬래시(/)는 허용되지 않으므로 콜론(:)으로 변환
 * @는 허용되지 않으므로 언더스코어(_)로 변환
 *
 * @param objectKey S3 객체 키
 * @returns sanitize된 ExternalImageId
 */
export function sanitizeExternalImageId(objectKey: string): string {
  return objectKey
    .replace(/\//g, ":") // / -> : (경로 구분자)
    .replace(/@/g, "_"); // @ -> _ (Instagram ID 표시)
}

/**
 * 지연 함수
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rekognition 에러 처리 헬퍼
 */
export function isRekognitionRetryableError(error: any): boolean {
  const retryableErrors = [
    "ThrottlingException",
    "ProvisionedThroughputExceededException",
    "ServiceUnavailableException",
    "InternalServerError",
  ];

  return retryableErrors.includes(error.name);
}

/**
 * Rekognition 에러 메시지 포맷팅
 */
export function formatRekognitionError(error: any): string {
  if (error.name === "InvalidImageFormatException") {
    return "Invalid image format. Supported formats: JPEG, PNG";
  }
  if (error.name === "ImageTooLargeException") {
    return "Image too large. Maximum size: 15MB for DetectText, 5MB for IndexFaces";
  }
  if (error.name === "InvalidS3ObjectException") {
    return "Invalid S3 object. Check bucket and key";
  }
  if (error.name === "ResourceNotFoundException") {
    return "Rekognition collection not found";
  }
  if (error.name === "ThrottlingException") {
    return "Rekognition API rate limit exceeded";
  }

  return error.message || "Unknown Rekognition error";
}
