import { format, parseISO, type Locale } from "date-fns";
import { fr, enCA } from "date-fns/locale";

const TZ = "America/Toronto";

const localeMap: Record<string, Locale> = {
  "fr-CA": fr,
  "en-CA": enCA,
};

/** Format a date for display (e.g. "21 avr. 2026" or "Apr 21, 2026"). */
export function formatDate(
  date: Date | string,
  locale: string = "fr-CA",
  pattern: string = "PP",
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: localeMap[locale] ?? fr });
}

/** Format a date as ISO date string (YYYY-MM-DD). */
export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Get current year in America/Toronto timezone. */
export function currentYear(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: TZ }),
  ).getFullYear();
}

/** Get the user's current age from birth year. */
export function ageFromBirthYear(birthYear: number): number {
  return currentYear() - birthYear;
}
