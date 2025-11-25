import { z } from "zod";
import type { Database } from "@repo/supabase";

// Use the generated type from Supabase
export type Organization = Database["public"]["Tables"]["organizers"]["Row"];

// Define Zod schema for runtime validation if needed (optional, but good for API inputs)
// Since we are using the DB type directly, we might not need a full Zod schema for the output 
// unless we want to validate the JSON fields structure.

// Branding Meta Schema
const BrandingMetaSchema = z.object({
  branding: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    logoUrl: z.string().optional(),
  }).optional(),
  content: z.object({
    welcomeMessage: z.string().optional(),
  }).optional(),
  info: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    websiteUrl: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  social: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
  }).optional(),
  partners: z.array(z.object({
    id: z.string(),
    name: z.string(),
    siteUrl: z.string().optional(),
    order: z.number().optional(),
    imageUrl: z.string().optional(),
  })).optional(),
});

export const OrganizationSchema = z.object({
  organizer_id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  active: z.boolean(),
  branding_meta: BrandingMetaSchema.nullable(),
  created_at: z.string().nullable(),
});
