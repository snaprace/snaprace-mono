/**
 * detect-text Lambda Function
 *
 * S3에 업로드된 사진에서 텍스트(bib 번호)를 감지하고 유효한 번호와 매칭합니다.
 * - Rekognition OCR을 사용한 텍스트 감지
 * - 워터마크 필터링 (바운딩 박스 기반 + 텍스트 크기 고려)
 * - DynamoDB에 사진 정보 저장
 * - SQS 메시지 전송
 */

import { Context } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  RekognitionClient,
  DetectTextCommand,
  TextDetection,
} from "@aws-sdk/client-rekognition";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { validateEnv, parseFloatEnv } from "shared/env-validator";

// ============================================================================
// 타입 정의
// ============================================================================

interface DetectTextEnvironment {
  PHOTOS_TABLE_NAME: string;
  RUNNERS_TABLE_NAME: string;
  QUEUE_URL: string;
  MIN_TEXT_CONFIDENCE: string;
  CLOUDFRONT_DOMAIN_NAME: string;
}

interface S3EventDetail {
  bucket: {
    name: string;
  };
  object: {
    key: string;
  };
}

interface EventBridgeEvent {
  detail: S3EventDetail;
}

interface ParsedS3Key {
  organizer_id: string;
  event_id: string;
  filename: string;
}

// ============================================================================
// 상수 설정
// ============================================================================

// 워터마크 필터링 상수 (바운딩 박스 기반 + 텍스트 크기 고려)
const WATERMARK_BOTTOM_THRESHOLD = 0.65; // 하단 35% 구역
const WATERMARK_LEFT_THRESHOLD = 0.3; // 좌측 30% 구역
const WATERMARK_RIGHT_THRESHOLD = 0.7; // 우측 30% 구역
const WATERMARK_MIN_WIDTH = 0.02; // 최소 텍스트 너비
const WATERMARK_MIN_HEIGHT = 0.01; // 최소 텍스트 높이

// ============================================================================
// AWS 클라이언트 초기화
// ============================================================================

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const rekognitionClient = new RekognitionClient({});
const sqsClient = new SQSClient({});

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * S3 키를 파싱하여 organizer_id, event_id, filename 추출
 * 형식: {organizer_id}/{event_id}/photos/raw/{filename}
 */
function parseS3Key(rawKey: string): ParsedS3Key | null {
  const decodedKey = decodeURIComponent(rawKey);
  const keyParts = decodedKey.split("/");

  if (
    keyParts.length === 5 &&
    keyParts[2] === "photos" &&
    keyParts[3] === "raw"
  ) {
    return {
      organizer_id: keyParts[0],
      event_id: keyParts[1],
      filename: keyParts[4],
    };
  }

  return null;
}

/**
 * Rekognition ExternalImageId를 위한 문자열 정리
 */
function sanitizeId(input: string): string {
  return input.replace(/\//g, "__").replace(/[^a-zA-Z0-9_.\-:]/g, "_");
}

// ============================================================================
// DynamoDB 작업
// ============================================================================

/**
 * 이벤트별 유효한 bib 번호 집합 로드
 * Runners 테이블이 없거나 비어있어도 빈 Set을 반환하여 처리 계속
 */
async function loadValidBibsForEvent(
  runnersTableName: string,
  organizerId: string,
  eventId: string
): Promise<Set<string>> {
  const bibs = new Set<string>();
  const pk = `ORG#${organizerId}#EVT#${eventId}`;

  try {
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const command = new QueryCommand({
        TableName: runnersTableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": pk,
        },
        ProjectionExpression: "sk",
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result = await dynamoClient.send(command);
      const items = result.Items || [];

      for (const item of items) {
        // sk 형식: "BIB#<zero_padded_bib>"
        const sk = item.sk || "";
        const bibMatch = sk.match(/^BIB#(.+)$/);
        if (bibMatch) {
          // 제로 패딩 제거하여 실제 bib 번호 추출
          const bibNumber = bibMatch[1].replace(/^0+/, "") || "0";
          bibs.add(bibNumber);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as
        | Record<string, any>
        | undefined;
    } while (lastEvaluatedKey);
  } catch (error: any) {
    // Runners 테이블이 없거나 접근할 수 없는 경우 빈 Set 반환
    // 이렇게 하면 bib 매칭은 안 되지만 사진 처리는 계속 진행됨
    if (error.name === "ResourceNotFoundException") {
      console.warn(
        `Runners table not found or empty for ${organizerId}/${eventId}. Continuing without bib validation.`
      );
    } else {
      console.error(
        `Error loading valid bibs for ${organizerId}/${eventId}:`,
        error
      );
      // 다른 에러도 빈 Set 반환하여 처리 계속
    }
  }

  return bibs;
}

// ============================================================================
// OCR 및 Bib 매칭
// ============================================================================

/**
 * 텍스트 감지 결과에서 bib 번호 찾기
 * 개선된 워터마크 필터링: 바운딩 박스 기반 + 텍스트 크기 고려
 */
function findBibMatches(
  detectedTexts: TextDetection[],
  validBibs: Set<string>,
  minConfidence: number
): Set<string> {
  const bibMatches = new Set<string>();

  for (const textInfo of detectedTexts) {
    // WORD 타입만 처리하고 최소 신뢰도 확인
    if (
      textInfo.Type !== "WORD" ||
      (textInfo.Confidence ?? 0) < minConfidence
    ) {
      continue;
    }

    const detectedText = textInfo.DetectedText || "";

    // 워터마크 필터링
    const bbox = textInfo.Geometry?.BoundingBox;
    if (bbox) {
      const top = bbox.Top ?? 0;
      const left = bbox.Left ?? 0;
      const width = bbox.Width ?? 0;
      const height = bbox.Height ?? 0;
      const bottom = top + height;

      // 1. 텍스트 크기가 너무 작으면 워터마크일 가능성 높음
      if (width < WATERMARK_MIN_WIDTH || height < WATERMARK_MIN_HEIGHT) {
        continue;
      }

      // 2. 좌하단 구역 필터링: 하단 35% + 좌측 30%
      const isInBottomLeft =
        bottom > WATERMARK_BOTTOM_THRESHOLD && left < WATERMARK_LEFT_THRESHOLD;

      // 3. 우하단 구역 필터링: 하단 35% + 우측 30%
      const isInBottomRight =
        bottom > WATERMARK_BOTTOM_THRESHOLD &&
        left + width > WATERMARK_RIGHT_THRESHOLD;

      if (isInBottomLeft || isInBottomRight) {
        continue;
      }
    }

    // 숫자만 추출하여 bib 번호 확인
    const numericText = detectedText.replace(/\D/g, "");
    if (numericText && validBibs.has(numericText)) {
      bibMatches.add(numericText);
    }
  }

  return bibMatches;
}

// ============================================================================
// 메인 핸들러
// ============================================================================

export const handler = async (
  event: EventBridgeEvent,
  context: Context
): Promise<{ statusCode: number; body: string }> => {
  const rawEnv = process.env as Record<string, string | undefined>;

  // 환경 변수 검증
  const envValidation = validateEnv<DetectTextEnvironment>(rawEnv, [
    "PHOTOS_TABLE_NAME",
    "RUNNERS_TABLE_NAME",
    "QUEUE_URL",
    "CLOUDFRONT_DOMAIN_NAME",
  ]);

  if (!envValidation.success || !envValidation.env) {
    throw new Error(
      envValidation.error || "Missing required environment variables"
    );
  }

  const env = envValidation.env;
  const minConfidence = parseFloatEnv(env.MIN_TEXT_CONFIDENCE, 90.0);
  const detail = event.detail;

  if (!detail) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid event format" }),
    };
  }

  const bucketName = detail.bucket?.name;
  const rawImageKey = detail.object?.key;

  if (!bucketName || !rawImageKey) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing bucket name or object key" }),
    };
  }

  // S3 키 파싱 및 검증
  const s3Context = parseS3Key(rawImageKey);
  if (!s3Context) {
    console.log(`Skipping object with invalid key structure: ${rawImageKey}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Object key does not match required format",
      }),
    };
  }

  const { organizer_id, event_id, filename } = s3Context;
  const sanitizedImageKey = sanitizeId(
    `${organizer_id}/${event_id}/${filename}`
  );

  try {
    console.log(`Processing image: s3://${bucketName}/${rawImageKey}`);

    // 1. Rekognition으로 텍스트 감지
    const detectTextCommand = new DetectTextCommand({
      Image: {
        S3Object: {
          Bucket: bucketName,
          Name: rawImageKey,
        },
      },
    });

    const rekognitionResponse = await rekognitionClient.send(detectTextCommand);
    const detectedTexts = rekognitionResponse.TextDetections || [];

    // 2. 유효한 bib 번호 로드 (이벤트별)
    const validBibs = await loadValidBibsForEvent(
      env.RUNNERS_TABLE_NAME!,
      organizer_id,
      event_id
    );

    // 3. bib 번호 매칭
    const bibMatches = findBibMatches(detectedTexts, validBibs, minConfidence);

    // 4. 확정된 bib 번호 결정 (단일 매칭만 확정)
    const confirmedBibNumber =
      bibMatches.size === 1 ? Array.from(bibMatches)[0] : undefined;

    // 5. CloudFront URL 생성
    const cloudfrontUrl = `https://${env.CLOUDFRONT_DOMAIN_NAME!}/${encodeURIComponent(rawImageKey)}`;

    // 6. DynamoDB에 사진 정보 저장
    const now = new Date().toISOString();
    const pk = `ORG#${organizer_id}#EVT#${event_id}`;
    const sk = `PHOTO#${sanitizedImageKey}`;
    const gsi1pk = confirmedBibNumber
      ? `EVT#${organizer_id}#${event_id}#BIB#${confirmedBibNumber}`
      : `EVT#${organizer_id}#${event_id}#BIB#NONE`;
    const gsi1sk = `TS#${now}#PHOTO#${sanitizedImageKey}`;
    const gsi2pk = `EVT#${organizer_id}#${event_id}#STATUS#TEXT_DETECTED`;
    const gsi2sk = `TS#${now}#PHOTO#${sanitizedImageKey}`;

    const photoItem = {
      pk,
      sk,
      gsi1pk,
      gsi1sk,
      gsi2pk,
      gsi2sk,
      organizer_id,
      event_id,
      photo_id: sanitizedImageKey,
      image_key: sanitizedImageKey,
      raw_s3_key: rawImageKey,
      cloudfront_url: cloudfrontUrl,
      s3_bucket: bucketName,
      processing_status: "TEXT_DETECTED",
      bib_number: confirmedBibNumber || "NONE",
      detected_bibs: Array.from(bibMatches),
      uploaded_at: now,
      created_at: now,
    };

    // 멱등성 보장: 동일 PK/SK가 이미 존재하면 건너뛰기
    try {
      await dynamoClient.send(
        new PutCommand({
          TableName: env.PHOTOS_TABLE_NAME!,
          Item: photoItem,
          ConditionExpression:
            "attribute_not_exists(pk) AND attribute_not_exists(sk)",
        })
      );
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        console.log(`Photo already exists: ${pk}/${sk}, skipping duplicate`);
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Photo already processed",
          }),
        };
      }
      throw error;
    }

    // 7. SQS 메시지 전송
    const messageBody = {
      organizer_id,
      event_id,
      bucket: bucketName,
      raw_key: rawImageKey,
      sanitized_key: sanitizedImageKey,
      hasConfirmedBib: !!confirmedBibNumber,
      bib: confirmedBibNumber,
    };

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: env.QUEUE_URL!,
        MessageBody: JSON.stringify(messageBody),
      })
    );

    console.log(
      `Successfully processed '${rawImageKey}'. Confirmed bib: ${confirmedBibNumber || "None"}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed ${rawImageKey}`,
        bibMatches: Array.from(bibMatches),
        confirmedBib: confirmedBibNumber,
      }),
    };
  } catch (error: any) {
    console.error(`Error processing s3://${bucketName}/${rawImageKey}:`, error);
    throw error;
  }
};
