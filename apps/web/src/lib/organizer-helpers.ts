import type { Organizer, Partner } from "@/server/services/organizers";

/**
 * Get organizer name with fallback
 */
export function getOrganizerName(organizer: Organizer | null): string {
  return organizer?.name || "SnapRace";
}

/**
 * Get organizer subdomain
 */
export function getOrganizerSubdomain(
  organizer: Organizer | null,
): string | undefined {
  return organizer?.subdomain ?? undefined;
}

/**
 * Get primary color from branding_meta
 */
export function getPrimaryColor(
  organizer: Organizer | null,
): string | undefined {
  return organizer?.branding_meta?.branding?.primaryColor ?? undefined;
}

/**
 * Get secondary color from branding_meta
 */
export function getSecondaryColor(
  organizer: Organizer | null,
): string | undefined {
  return organizer?.branding_meta?.branding?.secondaryColor ?? undefined;
}

/**
 * Get welcome message with fallback
 */
export function getWelcomeMessage(organizer: Organizer | null): string {
  return (
    organizer?.branding_meta?.content?.welcomeMessage ||
    "Enter your bib number to discover all your photos."
  );
}

/**
 * Get partners sorted by order
 */
export function getPartners(organizer: Organizer | null): Partner[] {
  const partners = organizer?.branding_meta?.partners || [];
  return [...partners].sort((a, b) => a.order - b.order);
}

/**
 * Get contact email with fallback
 */
export function getContactEmail(organizer: Organizer | null): string {
  return organizer?.branding_meta?.info?.email || "snaprace.info@gmail.com";
}
