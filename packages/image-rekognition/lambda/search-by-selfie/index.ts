import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  RekognitionClient,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const rekognition = new RekognitionClient({});
const s3 = new S3Client({});

// TODO: 실제 도메인으로 교체 필요
const CLOUDFRONT_DOMAIN = "https://images.snap-race.com";
const BUCKET_NAME = process.env.IMAGE_BUCKET!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { image, orgId, eventId } = body;

    if (!image || !orgId || !eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing required fields: image, orgId, eventId",
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
      };
    }

    // image is base64 string. Strip prefix if present.
    const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Image, "base64");
    const collectionId = `${orgId}-${eventId}`;

    try {
      const searchRes = await rekognition.send(
        new SearchFacesByImageCommand({
          CollectionId: collectionId,
          Image: { Bytes: imageBuffer },
          FaceMatchThreshold: 80,
          MaxFaces: 50,
        })
      );

      const matches = searchRes.FaceMatches || [];

      // 병렬로 S3 메타데이터 조회 (HeadObject)
      const photosPromise = matches.map(async (match) => {
        const ulid = match.Face?.ExternalImageId;
        if (!ulid) return null;

        const key = `${orgId}/${eventId}/processed/${ulid}.jpg`;
        const url = `${CLOUDFRONT_DOMAIN}/${key}`;

        let instagramHandle: string | null = null;

        try {
          const head = await s3.send(
            new HeadObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            })
          );
          // S3 메타데이터는 소문자로 반환됨
          instagramHandle = head.Metadata?.["instagram-handle"] || null;
        } catch (e) {
          console.warn(`Failed to fetch metadata for ${key}`, e);
        }

        return {
          photoId: ulid,
          url,
          similarity: match.Similarity,
          photographer: instagramHandle ? { instagramHandle } : null,
        };
      });

      const photos = (await Promise.all(photosPromise)).filter(
        (p) => p !== null
      );

      // 유사도(Confidence) 순으로 정렬
      photos.sort((a, b) => (b!.similarity || 0) - (a!.similarity || 0));

      return {
        statusCode: 200,
        body: JSON.stringify({
          photos: photos,
          matches: matches.length,
        }),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    } catch (err: any) {
      if (err.name === "ResourceNotFoundException") {
        return {
          statusCode: 200,
          body: JSON.stringify({
            photos: [],
            message: "Collection not found or empty",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
      throw err;
    }
  } catch (error: any) {
    console.error("Error in search-by-selfie:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    };
  }
};
