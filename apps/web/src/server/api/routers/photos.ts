import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import { QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import type { QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { env } from "@/env";

export const PhotoSchema = z.object({
  event_id: z.string(),
  cloudfront_url: z.string(),
});

export type Photo = z.infer<typeof PhotoSchema>;

export const photosRouter = createTRPCRouter({
  getByEventId: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined =
        undefined;
      const aggregatedItems: Array<{
        event_id: string;
        cloudfront_url: string;
      }> = [];

      do {
        const command: QueryCommand = new QueryCommand({
          TableName: TABLES.PHOTOS,
          IndexName: "EventIndex",
          KeyConditionExpression: "event_id = :eventId",
          ExpressionAttributeValues: {
            ":eventId": input.eventId,
          },
          ProjectionExpression: "event_id, cloudfront_url",
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result = await dynamoClient.send(command);
        const items =
          (result.Items as Array<{
            event_id: string;
            cloudfront_url: string;
          }>) ?? [];
        aggregatedItems.push(...items);
        lastEvaluatedKey = result.LastEvaluatedKey ?? undefined;
      } while (lastEvaluatedKey);

      const frontendPhotos = aggregatedItems.map((photo) => ({
        eventId: photo.event_id,
        imageUrl: photo.cloudfront_url,
      }));

      return frontendPhotos;
    }),
});

export const photosV2router = createTRPCRouter({
  /**
   * 특정 이벤트의 특정 bib에 대한 사진 조회 (GSI_ByBib 사용)
   */
  getByBib: publicProcedure
    .input(
      z.object({
        organizerId: z.string(),
        eventId: z.string(),
        bibNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { organizerId, eventId, bibNumber } = input;
      const gsi1pk = `EVT#${organizerId}#${eventId}#BIB#${bibNumber}`;

      let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined =
        undefined;
      const aggregatedItems: Array<{
        photo_id: string;
        cloudfront_url: string;
        uploaded_at: string;
      }> = [];

      do {
        const command = new QueryCommand({
          TableName: "PhotosV2",
          IndexName: "GSI_ByBib",
          KeyConditionExpression: "gsi1pk = :gsi1pk",
          ExpressionAttributeValues: {
            ":gsi1pk": gsi1pk,
          },
          ProjectionExpression: "photo_id, cloudfront_url, uploaded_at",
          ScanIndexForward: false, // 최신 순으로 정렬
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result: QueryCommandOutput = await dynamoClient.send(command);
        const items =
          (result.Items as Array<{
            photo_id: string;
            cloudfront_url: string;
            uploaded_at: string;
          }>) ?? [];
        aggregatedItems.push(...items);
        lastEvaluatedKey = result.LastEvaluatedKey ?? undefined;
      } while (lastEvaluatedKey);

      return aggregatedItems.map((photo) => ({
        photoId: photo.photo_id,
        imageUrl: photo.cloudfront_url,
        uploadedAt: photo.uploaded_at,
      }));
    }),

  /**
   * 특정 이벤트의 모든 사진 조회 (pk 사용)
   */
  getByEventId: publicProcedure
    .input(
      z.object({
        organizerId: z.string(),
        eventId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { organizerId, eventId } = input;
      const pk = `ORG#${organizerId}#EVT#${eventId}`;

      let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined =
        undefined;
      const aggregatedItems: Array<{
        photo_id: string;
        cloudfront_url: string;
        uploaded_at: string;
      }> = [];

      do {
        const command = new QueryCommand({
          TableName: "PhotosV2",
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": pk,
            ":skPrefix": "PHOTO#",
          },
          ProjectionExpression: "photo_id, cloudfront_url, uploaded_at",
          ScanIndexForward: false, // 최신 순으로 정렬
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result: QueryCommandOutput = await dynamoClient.send(command);
        const items =
          (result.Items as Array<{
            photo_id: string;
            cloudfront_url: string;
            uploaded_at: string;
          }>) ?? [];
        aggregatedItems.push(...items);
        lastEvaluatedKey = result.LastEvaluatedKey ?? undefined;
      } while (lastEvaluatedKey);

      return aggregatedItems.map((photo) => ({
        photoId: photo.photo_id,
        imageUrl: photo.cloudfront_url,
        uploadedAt: photo.uploaded_at,
      }));
    }),

  /**
   * 셀카 업로드로 사진 찾기 (find-by-selfie Lambda 호출)
   */
  findBySelfie: publicProcedure
    .input(
      z.object({
        image: z.string(), // Base64 인코딩된 이미지
        organizerId: z.string(),
        eventId: z.string(),
        bibNumber: z.string().optional(), // 선택사항: bib이 있으면 필터링에 사용
      }),
    )
    .mutation(async ({ input }) => {
      const { image, organizerId, eventId, bibNumber } = input;

      // API Gateway URL 확인
      const apiGatewayUrl = env.PHOTO_API_GATEWAY_URL;
      if (!apiGatewayUrl) {
        throw new Error(
          "PHOTO_API_GATEWAY_URL environment variable is not set",
        );
      }

      // Lambda 함수에 전달할 페이로드
      const payload = {
        image,
        organizer_id: organizerId,
        event_id: eventId,
        ...(bibNumber && { bib_number: bibNumber }),
      };

      try {
        const response = await fetch(`${apiGatewayUrl}/selfie`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API Gateway error: ${response.status} - ${errorText}`);
          throw new Error(
            `Lambda function returned ${response.status}: ${errorText}`,
          );
        }

        const data = (await response.json()) as {
          message: string;
          photos: Array<{
            photo_id: string;
            cloudfront_url: string;
            uploaded_at: string;
            bib_number?: string;
          }>;
          matched_faces: number;
          filtered_by_bib?: boolean;
        };

        return {
          message: data.message,
          photos: data.photos.map((photo) => ({
            photoId: photo.photo_id,
            imageUrl: photo.cloudfront_url,
            uploadedAt: photo.uploaded_at,
            bibNumber: photo.bib_number,
          })),
          matchedFaces: data.matched_faces,
          filteredByBib: data.filtered_by_bib ?? false,
        };
      } catch (error) {
        console.error("Error calling find-by-selfie Lambda:", error);
        throw new Error(
          error instanceof Error
            ? `Failed to find photos by selfie: ${error.message}`
            : "Failed to find photos by selfie",
        );
      }
    }),
});
