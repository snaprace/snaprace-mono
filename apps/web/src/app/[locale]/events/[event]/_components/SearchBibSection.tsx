"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
  const [searchBib, setSearchBib] = useState("");

  const handleBibSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchBib.trim()) {
      trackBibSearch(eventId, searchBib.trim());
      router.push(`/events/${eventId}/${searchBib.trim()}`);
    }
  };

  return (
    <section className="md:hidden">
      <div className="border-border/60 bg-background/95 rounded-2xl border p-3 shadow-sm">
        <form
          onSubmit={handleBibSearch}
          className="flex w-full items-center gap-2"
        >
          <Input
            type="text"
            inputMode="numeric"
            placeholder={t("enterBibNumber")}
            value={searchBib}
            onChange={(e) => setSearchBib(e.target.value)}
            className="border-border flex-1 text-sm"
          />
          <Button type="submit" size="icon" disabled={!searchBib.trim()}>
            <Search className="h-4 w-4" />
            <span className="sr-only">{tCommon("search")}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}
