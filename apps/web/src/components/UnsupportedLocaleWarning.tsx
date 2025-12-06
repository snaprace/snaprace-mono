"use client";

import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  localeToCountry,
  countryToLocale,
  localeNames,
  type Locale,
} from "@/i18n/config";

interface UnsupportedLocaleWarningProps {
  organizerCountries: string[];
  currentLocale: Locale;
}

export function UnsupportedLocaleWarning({
  organizerCountries,
  currentLocale,
}: UnsupportedLocaleWarningProps) {
  const router = useRouter();
  const pathname = usePathname();

  const currentCountry = localeToCountry[currentLocale];

  if (organizerCountries.includes(currentCountry)) {
    return null;
  }

  const suggestedLocale = countryToLocale[organizerCountries[0] ?? "US"] || "en";

  const switchToSuggested = () => {
    document.cookie = `NEXT_LOCALE=${suggestedLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    const segments = pathname.split("/");
    segments[1] = suggestedLocale;
    router.push(segments.join("/"));
  };

  return (
    <Alert className="mb-4 border-yellow-500 bg-yellow-50">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-yellow-800">
          This organizer does not support {localeNames[currentLocale]}.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={switchToSuggested}
          className="ml-4"
        >
          Switch to {localeNames[suggestedLocale]}
        </Button>
      </AlertDescription>
    </Alert>
  );
}


