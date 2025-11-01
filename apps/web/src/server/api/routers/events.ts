import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { dynamoClient, TABLES } from "@/lib/dynamodb";
import { ScanCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { compareDesc } from "date-fns";

export const EventSchema = z.object({
  event_id: z.string(),
  event_name: z.string(),
  event_image_url: z.string(),
  event_date: z.string(),
  event_location: z.string(),
  event_type: z.string(),
  organization_id: z.string(),
  participant_count: z.number().optional(),
  finishline_video_info: z
    .object({
      duration: z.number(),
      firstParticipantGunTime: z.number(),
      firstParticipantLocalTime: z.number().nullable(),
      firstParticipantTimeType: z.enum(["gun_time", "net_time"]),
      firstParticipantVideoTime: z.number(),
      name: z.string(),
      participantVideoTime: z.number(),
      provider: z.literal("youtube"),
      providerVideoId: z.string(),
      resultEventId: z.number(),
      rewindSeconds: z.number(),
      segmentId: z.number().nullable(),
      status: z.enum(["enabled", "disabled"]),
      subEventId: z.number(),
      thumbnail: z.string(),
      url: z.string(),
    })
    .optional(),
});

export type Event = z.infer<typeof EventSchema>;

export const eventsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z
        .object({
          organizationId: z.string().optional(),
          overrideOrganizationId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      // Priority: overrideOrganizationId > input.organizationId > ctx.organizationId
      const organizationId =
        input?.overrideOrganizationId ??
        input?.organizationId ??
        ctx.organizationId;

      // If organization context exists (subdomain site), filter by organization
      if (organizationId) {
        const command = new ScanCommand({
          TableName: TABLES.EVENTS,
          FilterExpression: "organization_id = :organizationId",
          ExpressionAttributeValues: {
            ":organizationId": organizationId,
          },
        });
        const result = await dynamoClient.send(command);
        const events = (result.Items ?? []) as Event[];
        return events.sort((a, b) => compareDesc(a.event_date, b.event_date));
      }

      // Main site: return all public events
      if (ctx.isMainSite) {
        const command = new ScanCommand({
          TableName: TABLES.EVENTS,
        });
        const result = await dynamoClient.send(command);
        const events = (result.Items ?? []) as Event[];
        return events.sort((a, b) => compareDesc(a.event_date, b.event_date));
      }

      // Fallback: return empty array if no organization context
      return [];
    }),

  getByOrganization: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      // Query events by organization_id
      const command = new ScanCommand({
        TableName: TABLES.EVENTS,
        FilterExpression: "organization_id = :organizationId",
        ExpressionAttributeValues: {
          ":organizationId": input.organizationId,
        },
      });
      const result = await dynamoClient.send(command);
      const events = (result.Items ?? []) as Event[];
      return events.sort((a, b) => 
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      );
    }),

  getById: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const command = new GetCommand({
        TableName: TABLES.EVENTS,
        Key: {
          event_id: input.eventId,
        },
      });
      const result = await dynamoClient.send(command);
      return (result.Item ?? null) as Event | null;
    }),
});
