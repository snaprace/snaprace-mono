/**
 * Bib Number 추출 및 필터링 함수들
 */

import { TextDetection } from "@aws-sdk/client-rekognition";
import { QueryCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";

// DynamoDB 클라이언트
const dynamoClient = new DynamoDBClient({});

// 워터마크 필터링 상수
const WATERMARK_BOTTOM_THRESHOLD = 0.75; // 하단 25% (Top > 0.75)
const WATERMARK_LEFT_THRESHOLD = 0.3; // 좌측 30%
const WATERMARK_RIGHT_THRESHOLD = 0.7; // 우측 30%

/**
 * Bib Number 추출 설정
 */
export interface BibExtractionConfig {
  minConfidence?: number; // 최소 신뢰도 (default: 90)
  bibNumberMin?: number; // 최소 Bib 번호 (default: 1)
  bibNumberMax?: number; // 최대 Bib 번호 (default: 99999)
  watermarkFilterEnabled?: boolean; // 워터마크 필터링 활성화 (default: true)
  watermarkAreaThreshold?: number; // 워터마크 영역 임계값 (default: 0.35)
}

/**
 * 기본 설정
 */
const DEFAULT_CONFIG: Required<BibExtractionConfig> = {
  minConfidence: 90,
  bibNumberMin: 1,
  bibNumberMax: 99999,
  watermarkFilterEnabled: true,
  watermarkAreaThreshold: 0.35,
};

/**
 * Rekognition DetectText 결과에서 Bib Number 추출 (3단계 필터링)
 */
export function extractBibNumbersFromText(
  textDetections: TextDetection[],
  imageWidth?: number,
  imageHeight?: number,
  config: BibExtractionConfig = {}
): string[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const bibs = new Set<string>();

  for (const detection of textDetections) {
    // LINE 또는 WORD 타입만 처리
    if (detection.Type !== "LINE" && detection.Type !== "WORD") {
      continue;
    }

    const text = detection.DetectedText || "";
    const confidence = detection.Confidence ?? 0;
    const geometry = detection.Geometry?.BoundingBox;

    // 필터 1: 숫자만 추출
    const numericText = text.replace(/\D/g, "");
    if (!numericText) {
      continue;
    }

    const bibNumber = parseInt(numericText, 10);

    // 필터 2: Bib 번호 범위 체크
    if (bibNumber < cfg.bibNumberMin || bibNumber > cfg.bibNumberMax) {
      continue;
    }

    // 필터 3: 신뢰도 기반 필터링
    if (confidence < cfg.minConfidence) {
      continue;
    }

    // 필터 4: 워터마크 영역 제외
    if (cfg.watermarkFilterEnabled && geometry) {
      if (isWatermarkArea(geometry, imageWidth, imageHeight, cfg)) {
        continue;
      }
    }

    bibs.add(numericText);
  }

  return Array.from(bibs);
}

/**
 * 워터마크 영역 판단
 */
export function isWatermarkArea(
  boundingBox: {
    Top?: number;
    Left?: number;
    Width?: number;
    Height?: number;
  },
  imageWidth?: number,
  imageHeight?: number,
  config: BibExtractionConfig = {}
): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const top = boundingBox.Top ?? 0;
  const left = boundingBox.Left ?? 0;
  const width = boundingBox.Width ?? 0;
  const height = boundingBox.Height ?? 0;
  const bottom = top + height;

  // 1. 좌하단 구역 필터링: 하단 25% + 좌측 30%
  const isInBottomLeft = bottom > WATERMARK_BOTTOM_THRESHOLD && left < WATERMARK_LEFT_THRESHOLD;

  // 2. 우하단 구역 필터링: 하단 25% + 우측 30%
  const isInBottomRight = bottom > WATERMARK_BOTTOM_THRESHOLD && left + width > WATERMARK_RIGHT_THRESHOLD;

  return isInBottomLeft || isInBottomRight;
}

/**
 * Runners 테이블에서 유효한 Bib 목록 로드
 */
export async function loadValidBibsForEvent(
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
          ":pk": { S: pk },
        },
        ProjectionExpression: "sk",
        ExclusiveStartKey: lastEvaluatedKey,
      });

      const result = await dynamoClient.send(command);
      const items = result.Items || [];

      for (const item of items) {
        // sk 형식: "BIB#<zero_padded_bib>" 또는 "BIB#<bib>"
        const sk = item.sk?.S || "";
        const bibMatch = sk.match(/^BIB#(.+)$/);
        if (bibMatch) {
          // 제로 패딩 제거하여 실제 bib 번호 추출
          const bibNumber = bibMatch[1].replace(/^0+/, "") || "0";
          bibs.add(bibNumber);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
  } catch (error: any) {
    // Runners 테이블이 없거나 접근할 수 없는 경우 빈 Set 반환
    if (error.name === "ResourceNotFoundException") {
      console.warn(
        `Runners table not found or empty for ${organizerId}/${eventId}. Continuing without bib validation.`
      );
    } else {
      console.error(`Error loading valid bibs for ${organizerId}/${eventId}:`, error);
    }
  }

  return bibs;
}

/**
 * 감지된 Bib와 유효한 Bib 매칭
 */
export function filterBibsByValidList(detectedBibs: string[], validBibs: Set<string>): string[] {
  if (validBibs.size === 0) {
    // validBibs가 비어있으면 모든 Bib 반환 (Runners 테이블 없음)
    return detectedBibs;
  }

  return detectedBibs.filter((bib) => validBibs.has(bib));
}

/**
 * Bib Number 정규화 (제로 패딩 제거)
 */
export function normalizeBibNumber(bib: string): string {
  const normalized = bib.replace(/^0+/, "") || "0";
  return normalized;
}

/**
 * Bib Number 제로 패딩 추가
 */
export function padBibNumber(bib: string, length = 4): string {
  return bib.padStart(length, "0");
}

/**
 * Bib Number 유효성 검증
 */
export function isValidBibNumber(
  bib: string,
  min: number = DEFAULT_CONFIG.bibNumberMin,
  max: number = DEFAULT_CONFIG.bibNumberMax
): boolean {
  const numericBib = bib.replace(/\D/g, "");
  if (!numericBib) return false;

  const bibNumber = parseInt(numericBib, 10);
  return bibNumber >= min && bibNumber <= max;
}

/**
 * TextDetection 배열에서 Bib Number 찾기 (기존 로직 호환)
 */
export function findBibMatches(
  detectedTexts: TextDetection[],
  validBibs: Set<string>,
  minConfidence: number = 90,
  imageWidth?: number,
  imageHeight?: number
): Set<string> {
  const config: BibExtractionConfig = {
    minConfidence,
    watermarkFilterEnabled: true,
  };

  // 모든 Bib 추출
  const allBibs = extractBibNumbersFromText(detectedTexts, imageWidth, imageHeight, config);

  // 유효한 Bib만 필터링
  const validBibsList = filterBibsByValidList(allBibs, validBibs);

  return new Set(validBibsList);
}
