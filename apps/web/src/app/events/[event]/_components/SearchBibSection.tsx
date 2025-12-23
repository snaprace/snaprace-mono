"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackBibSearch } from "@/lib/analytics";

interface SearchBibSectionProps {
  eventId: string;
}

export function SearchBibSection({ eventId }: SearchBibSectionProps) {
  const t = useTranslations("search");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const params = useParams();
  const bib = params?.bib;
  const [searchBib, setSearchBib] = useState(bib ? String(bib) : "");

  const handleClear = () => {
    setSearchBib("");
    router.push(`/events/${eventId}`);
  };

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBib = searchBib.trim();

    if (trimmedBib) {
      trackBibSearch(eventId, trimmedBib);
      router.push(`/events/${eventId}/${trimmedBib}`);
    } else {
      router.push(`/events/${eventId}`);
    }
  };

  return (
    <section className="md:hidden">
      <div className="border-border/60 bg-background/95 rounded-2xl border p-3 shadow-sm">
        <form
          onSubmit={handleBibSearch}
          className="flex w-full items-center gap-2"
        >
          <div className="relative flex-1">
            <Input
              type="text"
              inputMode="numeric"
              placeholder={t("enterBibNumber")}
              value={searchBib}
              onChange={(e) => setSearchBib(e.target.value)}
              className="border-border w-full pr-10 text-sm"
            />
            {(searchBib || bib) && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" size="icon">
            <Search className="h-4 w-4" />
            <span className="sr-only">{tCommon("search")}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}
