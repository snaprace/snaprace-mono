import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// Type definitions for gallery data
export const GalleryItemSchema = z.object({
  event_id: z.string(),
  event_name: z.string(),
  event_date: z.string(),
  bib_number: z.string(),
  runner_name: z.string().optional(),
  organizer_id: z.string(),
  bib_matched_photos: z.array(z.string()).default([]),
  selfie_matched_photos: z.array(z.string()).default([]),
  selfie_enhanced: z.boolean().default(false),
  last_updated: z.string(),
});

export type GalleryItem = z.infer<typeof GalleryItemSchema>;

export const galleriesRouter = createTRPCRouter({
  // Legacy methods removed - use Supabase based alternatives
});
