import {
  RekognitionClient,
  DetectTextCommand,
} from "@aws-sdk/client-rekognition";
import { extractBibsFromDetections } from "./bib-detector";

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
  const detections = res.TextDetections ?? [];

  for (const t of detections) {
    if (t.DetectedText) {
      rawText.push(t.DetectedText);
    }
  }

  const { bibs } = extractBibsFromDetections(detections);

  return {
    bibs,
    rawText,
    confidence: bibs.length > 0 ? 0.9 : 0,
  };
};
