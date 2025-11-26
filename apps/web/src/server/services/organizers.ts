import { z } from "zod";
import { type Database, type Tables } from "@repo/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

type DatabaseClient = SupabaseClient<Database>;

// ============================================
// Branding Meta Schemas
// ============================================
export const BrandingSchema = z.object({
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
});

export const ContentSchema = z.object({
  welcomeMessage: z.string().nullable().optional(),
});

export const InfoSchema = z.object({
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
});

export const SocialSchema = z.object({
  facebook: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
});

export const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number(),
  siteUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
});

export const BrandingMetaSchema = z.object({
  branding: BrandingSchema.nullable().optional(),
  content: ContentSchema.nullable().optional(),
  info: InfoSchema.nullable().optional(),
  social: SocialSchema.nullable().optional(),
  partners: z.array(PartnerSchema).nullable().optional(),
});

export type BrandingMeta = z.infer<typeof BrandingMetaSchema>;
export type Partner = z.infer<typeof PartnerSchema>;

// ============================================
// Organizer Type (branding_meta 타입 강화)
// ============================================
export type Organizer = Omit<Tables<"organizers">, "branding_meta"> & {
  branding_meta: BrandingMeta | null;
};

// ============================================
// Service Functions
// ============================================
export const getOrganizerBySubdomain = cache(
  async (options: {
    supabase: DatabaseClient;
    subdomain: string;
  }): Promise<Organizer | null> => {
    const { supabase, subdomain } = options;

    if (!subdomain) {
      return null;
    }

    const { data, error } = await supabase
      .from("organizers")
      .select("*")
      .eq("subdomain", subdomain)
      .single();

    if (error || !data) {
      return null;
    }

    return data as Organizer;
  },
);

