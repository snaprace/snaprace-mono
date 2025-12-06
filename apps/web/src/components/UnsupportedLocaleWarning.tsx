"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  localeToCountry,
  countryToLocale,
  localeNames,
  type Locale,
} from "@/i18n/config";
import { useLocaleSwitcher } from "@/hooks/useLocaleSwitcher";

interface UnsupportedLocaleWarningProps {
  organizerCountries: string[];
  currentLocale: Locale;
}

export function UnsupportedLocaleWarning({
  organizerCountries,
  currentLocale,
}: UnsupportedLocaleWarningProps) {
  const { switchLocale } = useLocaleSwitcher();

  const currentCountry = localeToCountry[currentLocale];

  if (organizerCountries.includes(currentCountry)) {
    return null;
  }

  const suggestedLocale =
    countryToLocale[organizerCountries[0] ?? "US"] || "en";

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
          onClick={() => switchLocale(suggestedLocale)}
          className="ml-4"
        >
          Switch to {localeNames[suggestedLocale]}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
