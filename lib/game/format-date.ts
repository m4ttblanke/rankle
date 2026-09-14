/**
 * Formats a DATE-only column (e.g. "2026-09-12") for display. `new Date(...)`
 * parses a bare date string as UTC midnight — formatting that directly in a
 * timezone behind UTC would show the previous day. Parsing as local midnight
 * instead (no trailing "Z") avoids that shift.
 */
export function formatDateOnly(dateOnly: string): string {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
