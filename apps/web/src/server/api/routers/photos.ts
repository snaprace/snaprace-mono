import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const PhotoSchema = z.object({
  event_id: z.string(),
  cloudfront_url: z.string(),
});

export type Photo = z.infer<typeof PhotoSchema>;

export const photosRouter = createTRPCRouter({
  // Legacy methods removed - use photos-v2 router
});
