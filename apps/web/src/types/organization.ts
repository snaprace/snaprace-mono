import { z } from "zod";

// Branding schema
const BrandingSchema = z.object({
  primary_color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  secondary_color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  logo_url: z.string().optional(),
});

// Content schema
const ContentSchema = z.object({
  welcome_message: z.string().max(500).optional(),
});

// Contact schema
const ContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website_url: z.string().optional(),
  address: z.string().optional(),
});

// Social schema
const SocialSchema = z.object({
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  youtube: z.string().optional(),
});

// Partner schema
const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  website_url: z.string().optional(),
  display_order: z.number().default(0),
});

// Features schema
const FeaturesSchema = z.object({
  enable_facial_recognition: z.boolean().default(false),
  enable_bulk_download: z.boolean().default(true),
});

// Organization schema - 새로운 구조
export const OrganizationSchema = z.object({
  // Core fields
  organization_id: z.string(),
  subdomain: z.string(),
  name: z.string(),

  // Grouped fields
  branding: BrandingSchema.default({}),
  content: ContentSchema.default({}),
  contact: ContactSchema.default({}),
  social: SocialSchema.default({}),
  partners: z.array(PartnerSchema).default([]),
  features: FeaturesSchema.default({}),

  // Metadata
  status: z.enum(["active", "inactive", "trial"]).default("active"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
});

export type Organization = z.infer<typeof OrganizationSchema>;
