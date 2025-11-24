import type { QueryCommandOutput } from "@aws-sdk/lib-dynamodb";

export interface SelfiePhoto {
  photoId: string;
  url: string;
  similarity: number;
  photographer: { instagramHandle: string } | null;
  width: number;
  height: number;
}

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
  if (typeof photo !== "object" || photo === null) {
    return null;
  }

  const candidate = photo as Record<string, unknown>;

  if (
    typeof candidate.photoId !== "string" ||
    typeof candidate.url !== "string" ||
    typeof candidate.similarity !== "number"
  ) {
    return null;
  }

  const width = typeof candidate.width === "number" ? candidate.width : 0;
  const height = typeof candidate.height === "number" ? candidate.height : 0;

  const photographerValue = candidate.photographer;
  let photographer: SelfiePhoto["photographer"] = null;

  if (
    typeof photographerValue === "object" &&
    photographerValue !== null &&
    typeof (photographerValue as { instagramHandle?: unknown })
      .instagramHandle === "string"
  ) {
    photographer = {
      instagramHandle: (photographerValue as { instagramHandle: string })
        .instagramHandle,
    };
  }

  return {
    photoId: candidate.photoId,
    url: candidate.url,
    similarity: candidate.similarity,
    photographer,
    width,
    height,
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
