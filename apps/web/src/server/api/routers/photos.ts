import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { PhotoService } from "@/server/services/photo-service";
import { trpcError } from "../error-utils";
import { PhotographerService } from "@/server/services/photographer-service";

export const photosRouter = createTRPCRouter({
  searchBySelfie: publicProcedure
    .input(
      z.object({
        image: z.string(),
        organizerId: z.string(),
        eventId: z.string(),
        bib: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        return await PhotoService.searchBySelfie({
          image: input.image,
          organizerId: input.organizerId,
          eventId: input.eventId,
          bib: input.bib,
        });
      } catch (error) {
        console.error("Failed to search by selfie:", error);
        throw trpcError.internal("Failed to process selfie search");
      }
    }),

  getByEvent: publicProcedure
    .input(
      z.object({
        organizerId: z.string(),
        eventId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        instagramHandle: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      return PhotoService.getPhotosByEvent({
        organizerId: input.organizerId,
        eventId: input.eventId,
        limit: input.limit,
        cursor: input.cursor,
        instagramHandle: input.instagramHandle,
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

  getPhotoCountByEvent: publicProcedure
    .input(
      z.object({
        organizerId: z.string(),
        eventId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return PhotoService.getPhotoCountByEvent({
        organizerId: input.organizerId,
        eventId: input.eventId,
      });
    }),

  getPhotoCountByBib: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
        bibNumber: z.string(),
      }),
    )
    .query(async ({ input }) => {
      return PhotoService.getPhotoCountByBib({
        eventId: input.eventId,
        bibNumber: input.bibNumber,
      });
    }),

  getPhotographersByEvent: publicProcedure
    .input(
      z.object({
        eventId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return PhotographerService.getPhotographersByEvent({
        supabase: ctx.supabase,
        eventId: input.eventId,
      });
    }),
});
