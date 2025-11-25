import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import {
  fetchEventResults,
  fetchRunnerByBib,
} from "@/server/services/results-v2";

const BibInputSchema = z.object({
  eventId: z.string().trim().min(1, "eventId is required."),
  bib: z.union([z.string(), z.number()]),
});

const EventResultsInputSchema = z.object({
  eventId: z.string().trim().min(1, "eventId is required."),
  eventSlug: z.string().trim().min(1).optional(),
});

export const resultsV2Router = createTRPCRouter({
  getRunnerByBib: publicProcedure
    .input(BibInputSchema)
    .query(async ({ ctx, input }) =>
      fetchRunnerByBib({
        supabase: ctx.supabase,
        eventId: input.eventId,
        bib: input.bib,
      }),
    ),

  getEventResults: publicProcedure
    .input(EventResultsInputSchema)
    .query(async ({ ctx, input }) =>
      fetchEventResults({
        supabase: ctx.supabase,
        eventId: input.eventId,
        eventSlug: input.eventSlug,
      }),
    ),
});

