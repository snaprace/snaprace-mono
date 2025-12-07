import {
  RekognitionClient,
  DetectTextCommand,
} from "@aws-sdk/client-rekognition";

const rekognition = new RekognitionClient({});

export interface DetectTextInput {
  bucketName: string;
  processedKey: string;
  orgId: string;
  eventId: string;
  ulid: string;
}

export interface DetectTextOutput {
  bibs: string[];
  rawText: string[];
  confidence: number;
}

export const handler = async (
  event: DetectTextInput
): Promise<DetectTextOutput> => {
  const { bucketName, processedKey } = event;

  const res = await rekognition.send(
    new DetectTextCommand({
      Image: {
        S3Object: {
          Bucket: bucketName,
          Name: processedKey,
        },
      },
    })
  );

  const rawText: string[] = [];
  const bibCandidates: string[] = [];

  // ============================================
  // 🎯 배번 패턴 설정 (대회에 따라 주석 처리로 전환)
  // ============================================
  const BIB_PATTERNS = [
    /^[0-9]{3,6}$/, // 순수 숫자: 123, 1234
    // /^[A-Z][0-9]{3,6}$/, // 접두사+숫자: A123, B1234, C12345 (필요시 활성화)
  ];

  // 제외할 패턴 (연도, 0000 등) - Set으로 O(1) 조회
  const EXCLUDED_PATTERNS = new Set([
    // "2024",
    // "2025",
    "0000",
    "00000",
    "000000",
  ]);

  // 최소 신뢰도 (오탐 방지용)
  const MIN_CONFIDENCE = 90;

  for (const t of res.TextDetections ?? []) {
    if (!t.DetectedText) continue;
    rawText.push(t.DetectedText);

    // WORD 타입 + 신뢰도 90% 이상만 처리
    if (t.Type === "WORD" && (t.Confidence ?? 0) >= MIN_CONFIDENCE) {
      const text = t.DetectedText.toUpperCase();
      const isMatch = BIB_PATTERNS.some((pattern) => pattern.test(text));

      if (isMatch && !EXCLUDED_PATTERNS.has(text)) {
        bibCandidates.push(t.DetectedText);
      }
    }
  }

  const uniqueBibs = Array.from(new Set(bibCandidates));

  return {
    bibs: uniqueBibs,
    rawText,
    confidence: uniqueBibs.length > 0 ? 0.9 : 0,
  };
};
