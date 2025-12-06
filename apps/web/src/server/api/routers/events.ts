import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

import { listEvents, getEventById } from "@/server/services/events";

export const eventsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z
        .object({
          organizationId: z.string().optional(),
          overrideOrganizationId: z.string().optional(),
          country: z.string().optional(),
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
        country: organizationId ? undefined : input?.country,
      });
    }),

  getById: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const event = await getEventById({ eventId: input.eventId });

      if (!event) {
        return null;
      }

      return event;
    }),
});
