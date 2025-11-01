import type { Organization } from "@/types/organization";
import { getOrganizationAssets } from "@/utils/organization-assets";

export class OrganizationHelper {
  constructor(private org: Organization | null) {}

  // Basic information
  get id() {
    return this.org?.organization_id;
  }

  get name() {
    return this.org?.name || "SnapRace";
  }

  get subdomain() {
    return this.org?.subdomain;
  }

  get isActive() {
    return this.org?.status === "active";
  }

  // Branding
  get primaryColor() {
    return this.org?.branding?.primary_color;
  }

  get secondaryColor() {
    return this.org?.branding?.secondary_color;
  }

  get logoUrl() {
    // Use provided logo_url or fall back to convention
    if (this.org?.branding?.logo_url) {
      return this.org.branding.logo_url;
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
      this.org?.content?.welcome_message ||
      "Enter your bib number to discover all your photos."
    );
  }

  get footerText() {
    return `© ${new Date().getFullYear()} ${this.name}. All rights reserved.`;
  }

  // Partners
  get partners() {
    const partners = this.org?.partners || [];

    // Sort by display_order
    return [...partners].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
    );
  }

  getPartnerImageUrl(partner: { name: string }): string {
    const assets = getOrganizationAssets(this.subdomain);
    return assets.getPartnerImage(partner.name);
  }

  // Features
  isFeatureEnabled(feature: keyof Organization["features"]): boolean {
    return this.org?.features?.[feature] ?? false;
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
      return this.org?.contact?.email;
    }
    return "snaprace.info@gmail.com";
  }

  get contactPhone() {
    return this.org?.contact?.phone;
  }

  get websiteUrl() {
    return this.org?.contact?.website_url;
  }

  get address() {
    return this.org?.contact?.address;
  }

  // Social Media
  getSocialUrl(
    platform: "facebook" | "instagram" | "twitter" | "linkedin" | "youtube",
  ): string | undefined {
    return this.org?.social?.[platform];
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
    return this.org?.status || "active";
  }

  get createdAt() {
    return this.org?.created_at;
  }

  get updatedAt() {
    return this.org?.updated_at;
  }

  // Utility methods
  toJSON() {
    return this.org;
  }
}
