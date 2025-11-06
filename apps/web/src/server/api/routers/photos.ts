import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
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

  // V2 - Photo Processing Stack 기반 메서드

  /**
   * 이벤트의 모든 사진을 조회합니다.
   * EventPhotos 테이블 사용 (PK: event_key)
   */
  getByEventV2: publicProcedure
    .input(
      z.object({
        organizer: z.string(),
        eventId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { organizer, eventId } = input;
      const eventKey = `ORG#${organizer}#EVT#${eventId}`;

      // 테이블이 설정되지 않은 경우 빈 배열 반환
      if (!TABLES.EVENT_PHOTOS) {
        console.warn("EVENT_PHOTOS table not configured");
        return [];
      }

      let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined =
        undefined;
      const aggregatedItems: Array<Record<string, unknown>> = [];

      do {
        const command: QueryCommand = new QueryCommand({
          TableName: TABLES.EVENT_PHOTOS,
          KeyConditionExpression: "event_key = :eventKey",
          ExpressionAttributeValues: {
            ":eventKey": eventKey,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result: QueryCommandOutput = await dynamoClient.send(command);

        const items = (result.Items as Array<Record<string, unknown>>) ?? [];
        aggregatedItems.push(...items);
        lastEvaluatedKey = result.LastEvaluatedKey ?? undefined;
      } while (lastEvaluatedKey);

      // 프론트엔드 형식으로 변환
      const photos = aggregatedItems.map((item) => ({
        eventKey: item.event_key as string,
        s3Path: item.s3_path as string,
        cloudfrontUrl: item.cloudfront_url as string | undefined,
        detectedBibs: (item.detected_bibs as string[]) ?? [],
        faceCount: (item.face_count as number) ?? 0,
        processedAt: item.processed_at as string | undefined,
        status: (item.processing_status as string) ?? "unknown",
      }));

      return photos;
    }),

  /**
   * Bib 번호로 사진을 조회합니다.
   * PhotoBibIndex 테이블 사용 (PK: event_bib_key)
   */
  getByBibV2: publicProcedure
    .input(
      z.object({
        organizer: z.string(),
        eventId: z.string(),
        bibNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { organizer, eventId, bibNumber } = input;
      const eventBibKey = `ORG#${organizer}#EVT#${eventId}#BIB#${bibNumber}`;

      // 테이블이 설정되지 않은 경우 빈 배열 반환
      if (!TABLES.PHOTO_BIB_INDEX) {
        console.warn("PHOTO_BIB_INDEX table not configured");
        return [];
      }

      let lastEvaluatedKey: QueryCommandOutput["LastEvaluatedKey"] | undefined =
        undefined;
      const aggregatedItems: Array<Record<string, unknown>> = [];

      do {
        const command: QueryCommand = new QueryCommand({
          TableName: TABLES.PHOTO_BIB_INDEX,
          KeyConditionExpression: "event_bib_key = :eventBibKey",
          ExpressionAttributeValues: {
            ":eventBibKey": eventBibKey,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        });

        const result: QueryCommandOutput = await dynamoClient.send(command);
        const items = (result.Items as Array<Record<string, unknown>>) ?? [];
        aggregatedItems.push(...items);
        lastEvaluatedKey = result.LastEvaluatedKey ?? undefined;
      } while (lastEvaluatedKey);

      // 프론트엔드 형식으로 변환
      const photos = aggregatedItems.map((item) => ({
        eventBibKey: item.event_bib_key as string,
        s3Path: item.s3_path as string,
        cloudfrontUrl: item.cloudfront_url as string | undefined,
        bibNumber: item.bib_number as string,
        detectedAt: item.detected_at as string | undefined,
        confidence: (item.confidence as number) ?? 0,
      }));

      return photos;
    }),

  /**
   * Selfie 이미지로 사진을 검색합니다.
   * API Gateway를 통해 SearchBySelfieLambda를 호출합니다.
   */
  searchBySelfie: publicProcedure
    .input(
      z.object({
        organizer: z.string(),
        eventId: z.string(),
        selfieImage: z.string(), // Base64 encoded image
      }),
    )
    .mutation(async ({ input }) => {
      const { organizer, eventId, selfieImage } = input;

      // API Gateway URL 확인
      if (!env.PHOTO_SEARCH_API_URL) {
        throw new Error("PHOTO_SEARCH_API_URL is not configured");
      }

      // Base64 이미지 검증
      if (!/^[A-Za-z0-9+/]+=*$/.exec(selfieImage)) {
        throw new Error("Invalid base64 image format");
      }

      try {
        // API Gateway POST /search/selfie 호출
        const apiUrl = `${env.PHOTO_SEARCH_API_URL}/search/selfie`;

        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            organizer,
            eventId,
            selfieImage,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();

          // 500 에러는 검색 결과가 없는 경우로 처리
          if (response.status === 500) {
            return {
              organizer,
              eventId,
              imageUrls: [],
              photoCount: 0,
              matches: [],
              message:
                "No additional photos found. Try uploading a different selfie with better lighting or a clearer view of your face.",
            };
          }

          // 다른 에러는 그대로 throw
          throw new Error(
            `API Gateway request failed: ${response.status} ${errorText}`,
          );
        }

        const result = (await response.json()) as {
          organizer: string;
          eventId: string;
          imageUrls: string[];
          photoCount: number;
          matches?: Array<{
            photoKey: string;
            similarity?: number;
            faceId?: string;
          }>;
          message: string;
        };

        return {
          organizer: result.organizer,
          eventId: result.eventId,
          imageUrls: result.imageUrls,
          photoCount: result.photoCount,
          matches: result.matches ?? [],
          message: result.message,
        };
      } catch (error: unknown) {
        console.error("Search by selfie API error:", error);

        // 네트워크 에러나 기타 에러는 그대로 throw
        throw new Error(
          `Failed to search by selfie: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }),
});
