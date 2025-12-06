import { parseISO } from "date-fns";

// UTC to browser Time
export const displayDate = (date: string, locale = "en-US") => {
  if (!date) return "";
  const dateObj = parseISO(date);
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);
};
