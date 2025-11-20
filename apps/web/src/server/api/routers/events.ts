import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { compareDesc } from "date-fns";
import type { Database, Tables } from "@repo/supabase";
import { trpcError, ERROR_MESSAGES } from "@/server/api/error-utils";

export type Event = Tables<"events">

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

      try {
        let query = ctx.supabase.from("events").select("*");

        if (organizationId) {
          query = query.eq("organizer_id", organizationId);
        } else if (!ctx.isMainSite) {
          return [];
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching events:", error);
          return [];
        }

        return (data || []).sort((a, b) => compareDesc(a.event_date, b.event_date));
      } catch (error) {
        console.error("Error fetching events:", error);
        throw trpcError.internal(ERROR_MESSAGES.EVENT.LIST_FAILED);
      }
    }),

  getByOrganization: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const { data, error } = await ctx.supabase
          .from("events")
          .select("*")
          .eq("organizer_id", input.organizationId);

        if (error) {
          console.error("Error fetching events by org:", error);
          return [];
        }

        return (data || []).sort((a, b) => 
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
        );
      } catch (error) {
        console.error("Error fetching events by org:", error);
        throw trpcError.internal(ERROR_MESSAGES.EVENT.LIST_FAILED);
      }
    }),

  getById: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const { data, error } = await ctx.supabase
          .from("events")
          .select("*")
          .eq("event_id", input.eventId)
          .single();

        if (error || !data) {
          return null;
        }

        return data;
      } catch (error) {
        console.error("Error fetching event by ID:", error);
        throw trpcError.internal(ERROR_MESSAGES.EVENT.FETCH_FAILED);
      }
    }),
});
