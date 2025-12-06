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

  // 순수 숫자 3~6자리 패턴 (접두사 없음)
  const BIB_REGEX = /^[0-9]{3,6}$/;
  // 제외할 패턴 (연도, 0000 등)
  const EXCLUDED_PATTERNS = ["2025", "0000", "00000", "000000"];

  for (const t of res.TextDetections ?? []) {
    if (!t.DetectedText) continue;
    rawText.push(t.DetectedText);
    if (t.Type === "WORD") {
      const match = t.DetectedText.match(BIB_REGEX);
      if (match && !EXCLUDED_PATTERNS.includes(t.DetectedText)) {
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
