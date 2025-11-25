import type { Organization } from "@/types/organization";
import { getOrganizationAssets } from "@/utils/organization-assets";

// Helper interface to match the structure of branding_meta
interface BrandingMeta {
  branding?: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
  content?: {
    welcomeMessage?: string;
  };
  info?: {
    email?: string;
    phone?: string;
    websiteUrl?: string;
    address?: string;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  };
  partners?: Array<{
    id: string;
    name: string;
    siteUrl?: string;
    order?: number;
    imageUrl?: string;
  }>;
}

export class OrganizationHelper {
  private meta: BrandingMeta;

  constructor(private org: Organization | null) {
    this.meta = (org?.branding_meta as BrandingMeta) || {};
  }

  // Basic information
  get id() {
    return this.org?.organizer_id;
  }

  get name() {
    return this.org?.name || "SnapRace";
  }

  get subdomain() {
    return this.org?.subdomain;
  }

  get isActive() {
    return this.org?.active === true;
  }

  // Branding
  get primaryColor() {
    return this.meta.branding?.primaryColor;
  }

  get secondaryColor() {
    return this.meta.branding?.secondaryColor;
  }

  get logoUrl() {
    // Use provided logo_url or fall back to convention
    if (this.meta.branding?.logoUrl) {
      return this.meta.branding.logoUrl;
    }

    // Fallback to local path convention
    if (this.subdomain) {
      return `/images/organizations/${this.subdomain}/logo.png`;
    }

    return "/images/default-logo.png";
  }

  get faviconUrl() {
    if (this.subdomain) {
      return `/images/organizations/${this.subdomain}/favicon.ico`;
    }

    return "/favicon.ico";
  }

  // Content
  get welcomeMessage() {
    return (
      this.meta.content?.welcomeMessage ||
      "Enter your bib number to discover all your photos."
    );
  }

  get footerText() {
    return `© ${new Date().getFullYear()} ${this.name}. All rights reserved.`;
  }

  // Partners
  get partners() {
    const partners = this.meta.partners || [];

    // Sort by display_order (order)
    return [...partners].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    ).map(p => ({
      id: p.id,
      name: p.name,
      website_url: p.siteUrl,
      display_order: p.order,
      // Map other fields if necessary for frontend
    }));
  }

  getPartnerImageUrl(partner: { name: string }): string {
    const assets = getOrganizationAssets(this.subdomain);
    return assets.getPartnerImage(partner.name);
  }

  // Features
  isFeatureEnabled(feature: string): boolean {
    // Currently features are not in the DB schema explicitly, 
    // assuming defaults or if added to branding_meta later.
    // For now, hardcode based on previous defaults:
    if (feature === "enable_facial_recognition") return false;
    if (feature === "enable_bulk_download") return true;
    return false;
  }

  get enableFacialRecognition() {
    return this.isFeatureEnabled("enable_facial_recognition");
  }

  get enableBulkDownload() {
    return this.isFeatureEnabled("enable_bulk_download");
  }

  // Contact
  get contactEmail() {
    if (this.subdomain) {
      return this.meta.info?.email;
    }
    return "snaprace.info@gmail.com";
  }

  get contactPhone() {
    return this.meta.info?.phone;
  }

  get websiteUrl() {
    return this.meta.info?.websiteUrl;
  }

  get address() {
    return this.meta.info?.address;
  }

  // Social Media
  getSocialUrl(
    platform: "facebook" | "instagram" | "twitter" | "linkedin" | "youtube",
  ): string | undefined {
    return this.meta.social?.[platform];
  }

  get socialLinks() {
    return {
      facebook: this.getSocialUrl("facebook"),
      instagram: this.getSocialUrl("instagram"),
      twitter: this.getSocialUrl("twitter"),
      linkedin: this.getSocialUrl("linkedin"),
      youtube: this.getSocialUrl("youtube"),
    };
  }

  get hasSocialLinks() {
    return Object.values(this.socialLinks).some((url) => !!url);
  }

  // Metadata
  get status() {
    return this.org?.active ? "active" : "inactive";
  }

  get createdAt() {
    return this.org?.created_at;
  }

  get updatedAt() {
    // updated_at is not in the current schema, return null or created_at
    return this.org?.created_at;
  }

  // Utility methods
  toJSON() {
    return this.org;
  }
}
