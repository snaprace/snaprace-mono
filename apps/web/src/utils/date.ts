import { parseISO, format } from "date-fns";

// UTC to browser Time
export const displayDate = (date: string) => {
  if(!date) return ""
  const dateObj = parseISO(date);
  return format(dateObj, 'MMMM d, yyyy');
}