import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { PhotoService } from "@/server/services/photo-service";

export const photosV2Router = createTRPCRouter({
  getByEvent: publicProcedure
    .input(
      z.object({
        organizerId: z.string(),
        eventId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return PhotoService.getPhotosByEvent({
        organizerId: input.organizerId,
        eventId: input.eventId,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),

  getByBib: publicProcedure
    .input(
      z.object({
        organizerId: z.string(),
        eventId: z.string(),
        bibNumber: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return PhotoService.getPhotosByBib({
        eventId: input.eventId,
        bibNumber: input.bibNumber,
        limit: input.limit,
        cursor: input.cursor,
      });
    }),
});
