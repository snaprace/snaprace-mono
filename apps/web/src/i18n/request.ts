import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import type { Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  const messages = (
    (await import(`../../messages/${locale}.json`)) as {
      default: Record<string, unknown>;
    }
  ).default;

  return {
    locale,
    messages,
  };
});


