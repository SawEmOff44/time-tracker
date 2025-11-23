// lib/datetime.ts

/**
 * Format a Date or ISO string into a human-friendly local time string.
 * Example: "11/22/2025, 8:16:28 PM"
 */
export function formatDateTimeLocal(
  value: Date | string | null | undefined
): string {
  if (!value) return "—";

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}