import { RekognitionClient, DetectTextCommand } from "@aws-sdk/client-rekognition";

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

  for (const t of res.TextDetections ?? []) {
    if (!t.DetectedText) continue;
    rawText.push(t.DetectedText);
    if (t.Type === "WORD" && /^[0-9]{3,6}$/.test(t.DetectedText)) {
      bibCandidates.push(t.DetectedText);
    }
  }

  const uniqueBibs = Array.from(new Set(bibCandidates));

  return {
    bibs: uniqueBibs,
    rawText,
    confidence: uniqueBibs.length > 0 ? 0.9 : 0,
  };
};
