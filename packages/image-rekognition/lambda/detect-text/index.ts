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

  // 알파벳 접두사(0~2자) + 숫자(3~6자리) 패턴
  // 캡처 그룹으로 숫자 부분만 추출하여 저장
  const BIB_REGEX = /^[A-Z]{0,2}([0-9]{3,6})$/i;

  for (const t of res.TextDetections ?? []) {
    if (!t.DetectedText) continue;
    rawText.push(t.DetectedText);
    if (t.Type === "WORD") {
      const match = t.DetectedText.match(BIB_REGEX);
      if (match) {
        bibCandidates.push(match[1]);
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
