import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { QueryCommandOutput } from "@aws-sdk/lib-dynamodb";

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
