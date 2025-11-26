import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { trpcError, ERROR_MESSAGES } from "@/server/api/error-utils";
import { getOrganizerBySubdomain } from "@/server/services/organizers";

export const organizersRouter = createTRPCRouter({
  getBySubdomain: publicProcedure
    .input(z.object({ subdomain: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getOrganizerBySubdomain({
          supabase: ctx.supabase,
          subdomain: input.subdomain,
        });
      } catch (error) {
        console.error("Error fetching organizer by subdomain:", error);
        throw trpcError.internal(ERROR_MESSAGES.ORGANIZATION.FETCH_FAILED);
      }
    }),
});

