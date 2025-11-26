"use client";

import Image from "next/image";
import Link from "next/link";
import { useOrganizer } from "@/contexts/OrganizerContext";
import {
  getOrganizerName,
  getOrganizerSubdomain,
  getContactEmail,
  getPartners,
} from "@/lib/organizer-helpers";
import { getOrganizationAssets } from "@/utils/organization-assets";

export function Footer() {
  const { organizer } = useOrganizer();
  const name = getOrganizerName(organizer);
  const subdomain = getOrganizerSubdomain(organizer);
  const contactEmail = getContactEmail(organizer);
  const partners = getPartners(organizer);
  const assets = getOrganizationAssets(subdomain);

  return (
    <section className="bg-muted/10 mt-auto border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:py-4">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[10px] sm:text-xs">
            <Link
              href="/privacy-policy"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">•</span>
            <span>
              © {new Date().getFullYear()} {name}. All rights reserved.
            </span>
            {contactEmail && (
              <>
                <span className="hidden sm:inline">•</span>
                <a
                  href={`mailto:${contactEmail}`}
                  className="hover:text-foreground transition-colors"
                >
                  {contactEmail}
                </a>
              </>
            )}
          </div>

          {partners.length > 0 && (
            <div className="flex max-w-full items-center justify-center gap-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {partners.map((partner) => (
                <Link
                  key={partner.id}
                  href={partner.siteUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex-shrink-0"
                >
                  <div className="relative flex h-8 w-fit max-w-[120px] items-center justify-center">
                    <Image
                      src={
                        partner.imageUrl || assets.getPartnerImage(partner.name)
                      }
                      alt={partner.name}
                      width={120}
                      height={32}
                      className="max-h-8 w-auto object-contain opacity-70 transition-all duration-200 group-hover:scale-105 group-hover:opacity-100"
                      sizes="120px"
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
