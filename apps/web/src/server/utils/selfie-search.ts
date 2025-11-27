import type { QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import type { Photo } from "@/types/photo";

export type SelfiePhoto = Photo;

export interface SearchBySelfieResult {
  photos: SelfiePhoto[];
  matches: number;
}

type LambdaProxyResponse = {
  statusCode: number;
  body: string;
};

export const isLambdaProxyResponse = (
  payload: unknown,
): payload is LambdaProxyResponse => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as { statusCode?: unknown; body?: unknown };
  return (
    typeof candidate.statusCode === "number" &&
    typeof candidate.body === "string"
  );
};

const normalizeSelfiePhoto = (photo: unknown): SelfiePhoto | null => {
  console.log("photo", photo);
  if (typeof photo !== "object" || photo === null) {
    return null;
  }

  const candidate = photo as Record<string, unknown>;

  // Basic validation for required Photo fields
  if (
    typeof candidate.pid !== "string" ||
    (typeof candidate.s3Key !== "string" &&
      typeof candidate.src !== "string") ||
    typeof candidate.eventId !== "string" ||
    typeof candidate.orgId !== "string"
  ) {
    return null;
  }

  // Map s3Key or existing src/url to the new 'src' field
  // Lambda might return s3Key, url, or src depending on version
  const src =
    (candidate.src as string) ||
    (candidate.s3Key as string) ||
    (candidate.url as string) ||
    "";

  return {
    pid: candidate.pid,
    src,
    width: typeof candidate.width === "number" ? candidate.width : 0,
    height: typeof candidate.height === "number" ? candidate.height : 0,
    eventId: candidate.eventId,
    orgId: candidate.orgId,
    thumbHash:
      typeof candidate.thumbHash === "string" ? candidate.thumbHash : undefined,
    instagramHandle:
      typeof candidate.instagramHandle === "string"
        ? candidate.instagramHandle
        : undefined,
    similarity:
      typeof candidate.similarity === "number"
        ? candidate.similarity
        : undefined,
  };
};

export const parseSelfieLambdaBody = (
  bodyString: string,
): SearchBySelfieResult => {
  const parsed = JSON.parse(bodyString) as unknown;

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid payload body from Lambda");
  }

  const candidate = parsed as {
    photos?: unknown;
    matches?: unknown;
  };

  const photos = Array.isArray(candidate.photos)
    ? candidate.photos
        .map(normalizeSelfiePhoto)
        .filter((photo): photo is SelfiePhoto => photo !== null)
    : [];

  const matches = typeof candidate.matches === "number" ? candidate.matches : 0;

  return { photos, matches };
};

export const decodeCursor = (
  cursor?: string,
): QueryCommandOutput["LastEvaluatedKey"] | undefined => {
  if (!cursor) {
    return undefined;
  }

  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  const parsed = JSON.parse(decoded) as unknown;

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid pagination cursor");
  }

  return parsed as QueryCommandOutput["LastEvaluatedKey"];
};
