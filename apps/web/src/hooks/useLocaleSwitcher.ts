"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";

export function useLocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (newLocale: Locale) => {
    // 쿠키 설정
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

    // 경로의 locale 세그먼트 변경
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  return { switchLocale };
}

