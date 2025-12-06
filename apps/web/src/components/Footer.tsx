"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOrganizer } from "@/contexts/OrganizerContext";

export function Footer() {
  const t = useTranslations("footer");
  const tCommon = useTranslations("common");
  const { organizer } = useOrganizer();

  return (
    <section className="bg-muted/10 mt-auto border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:py-4">
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-[10px] sm:text-xs">
            <Link
              href="/privacy-policy"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
            >
              {t("privacy")}
            </Link>
            <span className="hidden sm:inline">•</span>
            <span>
              © {new Date().getFullYear()} {organizer?.name}. {tCommon("allRightsReserved")}
            </span>
            {organizer?.branding_meta?.info?.email && (
              <>
                <span className="hidden sm:inline">•</span>
                <a
                  href={`mailto:${organizer?.branding_meta?.info?.email}`}
                  className="hover:text-foreground transition-colors"
                >
                  {organizer?.branding_meta?.info?.email}
                </a>
              </>
            )}
          </div>

          {organizer?.branding_meta?.partners &&
            organizer?.branding_meta?.partners?.length > 0 && (
              <div className="flex max-w-full items-center justify-center gap-3 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {organizer?.branding_meta?.partners?.map(
                  (partner) =>
                    partner.imageUrl && (
                      <Link
                        key={partner.id}
                        href={partner.siteUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group shrink-0"
                      >
                        <Image
                          src={partner.imageUrl}
                          alt={partner.name}
                          width={120}
                          height={30}
                          style={{ height: "auto", width: "auto" }}
                          className="max-h-8 w-auto object-contain opacity-70 transition-all duration-200 group-hover:scale-105 group-hover:opacity-100"
                          unoptimized
                        />
                      </Link>
                    ),
                )}
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
