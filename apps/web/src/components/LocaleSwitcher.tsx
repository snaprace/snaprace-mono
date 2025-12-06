"use client";

import { usePathname, useRouter } from "next/navigation";
import ReactCountryFlag from "react-country-flag";
import {
  locales,
  localeToCountry,
  countryToLocale,
  type Locale,
} from "@/i18n/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LocaleSwitcherProps {
  currentLocale: Locale;
  organizerCountries?: string[] | null;
}

function CircleFlag({
  countryCode,
  size = 20,
}: {
  countryCode: string;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <ReactCountryFlag
        countryCode={countryCode}
        svg
        style={{
          width: "150%",
          height: "150%",
          objectFit: "cover",
        }}
      />
    </span>
  );
}

export function LocaleSwitcher({
  currentLocale,
  organizerCountries,
}: LocaleSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  const availableLocales = organizerCountries
    ? organizerCountries
        .map((country) => countryToLocale[country])
        .filter((locale): locale is Locale => !!locale)
    : [...locales];

  if (availableLocales.length <= 1) {
    return null;
  }

  const switchLocale = (newLocale: Locale) => {
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  return (
    <Select
      value={currentLocale}
      onValueChange={(v) => switchLocale(v as Locale)}
    >
      <SelectTrigger
        isDisplayChevron={false}
        className="w-auto gap-0 border-none bg-transparent px-2 shadow-none focus:ring-0"
      >
        <SelectValue>
          <CircleFlag countryCode={localeToCountry[currentLocale]} size={22} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {availableLocales.map((locale) => (
          <SelectItem key={locale} value={locale}>
            <div className="flex items-center gap-2">
              <CircleFlag countryCode={localeToCountry[locale]} size={18} />
              <span className="text-xs font-medium uppercase">{locale}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
