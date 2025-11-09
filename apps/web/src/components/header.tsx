"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePathname } from "next/navigation";
import { useOrganizationHelper } from "@/hooks/useOrganizationHelper";
import { getOrganizationAssets } from "@/utils/organization-assets";

export function Header() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const pathname = usePathname();
  const org = useOrganizationHelper();
  const assets = getOrganizationAssets(org.subdomain);

  // Disable sticky on photo detail pages: /events/[event]/[bib]
  const isPhotoPage = /^\/events\/[^/]+\/[^/]+$/.test(pathname);

  const navigation = [
    { name: "Search", href: "/" },
    { name: "Events", href: "/events" },
  ];

  return (
    <header
      className={`${isPhotoPage ? "" : "sticky top-0 z-50"} bg-background/80 w-full border-b backdrop-blur-sm`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            {org.subdomain ? (
              <div className="relative h-10 w-32">
                <Image
                  src={assets.logo}
                  alt={org.name}
                  fill
                  className="object-contain"
                  priority
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
                />
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center space-x-8 md:flex">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));

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
          </nav>

          {/* Desktop Search - Disabled */}
          {/* <div className="hidden items-center space-x-2 md:flex">
            <form onSubmit={handleSearch} className="relative">
              <Input
                type="text"
                placeholder="Enter bib number..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-48 pr-10"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 transform p-0"
              >
                <Search className="h-3 w-3" />
              </Button>
            </form>
          </div> */}

          {/* Mobile Controls */}
          <div className="flex items-center space-x-2 md:hidden">
            {/* Mobile Search Toggle - Disabled */}
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              aria-label="Toggle search"
            >
              <Search className="h-4 w-4" />
            </Button> */}

            {/* Mobile Menu */}
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
                    {org.subdomain ? (
                      <div className="relative h-10 w-32">
                        <Image
                          src={assets.logo}
                          alt={org.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <div className="relative h-8 w-28">
                        <Image
                          src="/images/snaprace-logo.svg"
                          alt="SnapRace"
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                  </Link>

                  <nav className="flex flex-col space-y-3">
                    {navigation.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        (item.href !== "/" && pathname.startsWith(item.href));

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

                  {/* Mobile Search in Menu - Disabled */}
                  {/* <div className="border-t pt-4">
                    <form onSubmit={handleSearch} className="space-y-2">
                      <Input
                        type="text"
                        placeholder="Enter bib number..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="w-full"
                      />
                      <Button type="submit" className="w-full">
                        <Search className="mr-2 h-4 w-4" />
                        Find My Photos
                      </Button>
                    </form>
                  </div> */}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
