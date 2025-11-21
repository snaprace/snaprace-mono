import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import type { Tables } from "@repo/supabase";

import { listEvents, getEventById } from "@/server/services/events";

export type Event = Tables<"events">;

export const EventSchema = z.object({
  event_id: z.string(),
  organizer_id: z.string(),
  name: z.string(),
  event_date: z.string(),
  location: z.string().nullable(),
  thumbnail_image: z.string().nullable(),
  participant_count: z.number().nullable(),
  event_type: z.string().nullable(),
  display_mode: z.string(),
  results_integration: z.any().nullable(), // Define more specific schema if needed
  photos_meta: z.any().nullable(),
});

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
      const organizationId =
        input?.overrideOrganizationId ??
        input?.organizationId ??
        ctx.organizationId;

      if (!organizationId && !ctx.isMainSite) {
        return [];
      }

      return listEvents({
        supabase: ctx.supabase,
        organizationId,
      });
    }),

  getById: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getEventById({
        supabase: ctx.supabase,
        eventId: input.eventId,
      });
    }),
});
