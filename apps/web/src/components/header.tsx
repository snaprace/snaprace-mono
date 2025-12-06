"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePathname, useParams } from "next/navigation";
import { useOrganizer } from "@/contexts/OrganizerContext";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import type { Locale } from "@/i18n/config";
import { useTranslations } from "next-intl";

export function Header() {
  const t = useTranslations();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pathname = usePathname();
  const params = useParams<{ locale: string }>();
  const { organizer } = useOrganizer();
  const locale = (params.locale || "en") as Locale;

  // Disable sticky on photo detail pages: /events/[event]/[bib]
  const isPhotoPage = /^\/[a-z]{2}\/events\/[^/]+\/[^/]+$/.test(pathname);

  const navigation = [
    { name: t("common.search"), href: `/${locale}` },
    { name: t("events.title"), href: `/${locale}/events` },
  ];

  return (
    <header
      className={`${isPhotoPage ? "sticky top-0 z-50" : ""} bg-background/80 h-[64px] w-full border-b backdrop-blur-sm`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            {organizer?.subdomain ? (
              <div className="relative h-[55px] w-32">
                <Image
                  src={organizer?.branding_meta?.branding?.logoUrl || ""}
                  alt={organizer?.name || ""}
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                />
              </div>
            ) : (
              <div className="relative h-8 w-28">
                <Image
                  src="/images/snaprace-logo.svg"
                  alt="SnapRace"
                  fill
                  className="object-contain"
                  priority
                  unoptimized
                />
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-8 md:flex">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== `/${locale}` && pathname.startsWith(item.href));

              const navLinkClass = `text-sm transition-colors ${
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`;

              return (
                <Link key={item.name} href={item.href} className={navLinkClass}>
                  {item.name}
                </Link>
              );
            })}
            <LocaleSwitcher
              currentLocale={locale}
              organizerCountries={organizer?.countries}
            />
          </nav>

          {/* Mobile Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <LocaleSwitcher
              currentLocale={locale}
              organizerCountries={organizer?.countries}
            />
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Open menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[300px] px-2 sm:w-[400px]"
              >
                <div className="flex flex-col space-y-4 pt-6">
                  <Link
                    href="/"
                    className="flex items-center space-x-2"
                    onClick={() => setIsSheetOpen(false)}
                  >
                    {organizer?.subdomain ? (
                      <div className="relative h-10 w-32">
                        <Image
                          src={
                            organizer?.branding_meta?.branding?.logoUrl || ""
                          }
                          alt={organizer?.name || ""}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="relative h-8 w-28">
                        <Image
                          src="/images/snaprace-logo.svg"
                          alt="SnapRace"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}
                  </Link>

                  <nav className="flex flex-col space-y-3">
                    {navigation.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== `/${locale}` &&
                          pathname.startsWith(item.href));

                      return (
                        <Link
                          key={item.name}
                          href={item.href}
                          className={`text-lg transition-colors ${
                            isActive
                              ? "text-foreground font-bold"
                              : "text-muted-foreground hover:text-foreground font-medium"
                          }`}
                          onClick={() => setIsSheetOpen(false)}
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
