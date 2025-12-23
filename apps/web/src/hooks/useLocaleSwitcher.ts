"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";

export function useLocaleSwitcher() {
  const router = useRouter();

  const switchLocale = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    router.refresh()
  };

  return { switchLocale };
}
