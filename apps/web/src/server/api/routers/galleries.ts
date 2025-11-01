import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

// Type definitions for gallery data
export const GalleryItemSchema = z.object({
  event_id: z.string(),
  event_name: z.string(),
  event_date: z.string(),
  bib_number: z.string(),
  runner_name: z.string().optional(),
  organizer_id: z.string(),
  bib_matched_photos: z.array(z.string()).default([]),
  selfie_matched_photos: z.array(z.string()).default([]),
  selfie_enhanced: z.boolean().default(false),
  last_updated: z.string(),
});

export type GalleryItem = z.infer<typeof GalleryItemSchema>;

export const galleriesRouter = createTRPCRouter({
  // Get gallery data for a specific bib number
  getByBibNumber: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        bibNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const command = new GetCommand({
        TableName: TABLES.GALLERIES,
        Key: {
          event_id: input.eventId,
          bib_number: input.bibNumber,
        },
      });
      const result = await dynamoClient.send(command);

      // Parse and validate the response
      if (result.Item) {
        return GalleryItemSchema.parse(result.Item);
      }
      return null;
    }),

  // Get all gallery items for an event
  getAllByEventId: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const command = new QueryCommand({
        TableName: TABLES.GALLERIES,
        KeyConditionExpression: "event_id = :eventId",
        ExpressionAttributeValues: {
          ":eventId": input.eventId,
        },
      });
      const result = await dynamoClient.send(command);

      // Parse and validate each item
      const items = result.Items ?? [];
      return z.array(GalleryItemSchema).parse(items);
    }),
});
