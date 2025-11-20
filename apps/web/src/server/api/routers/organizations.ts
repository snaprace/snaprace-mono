import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { trpcError, ERROR_MESSAGES } from "@/server/api/error-utils";

// Re-export for backward compatibility
export { OrganizationSchema, type Organization } from "@/types/organization";

export const organizationsRouter = createTRPCRouter({
  getBySubdomain: publicProcedure
    .input(z.object({ subdomain: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.subdomain) {
        return null;
      }

      try {
        const { data, error } = await ctx.supabase
          .from("organizers")
          .select("*")
          .eq("subdomain", input.subdomain)
          .single();

        if (error || !data) {
          return null;
        }

        return data;
      } catch (error) {
        console.error("Error fetching organization by subdomain:", error);
        throw trpcError.internal(ERROR_MESSAGES.ORGANIZATION.FETCH_FAILED);
      }
    }),

  getById: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!input.organizationId) {
        return null;
      }

      try {
        const { data, error } = await ctx.supabase
          .from("organizers")
          .select("*")
          .eq("organizer_id", input.organizationId)
          .single();

        if (error || !data) {
          return null;
        }

        return data;
      } catch (error) {
        console.error("Error fetching organization by ID:", error);
        throw trpcError.internal(ERROR_MESSAGES.ORGANIZATION.FETCH_FAILED);
      }
    }),
});
