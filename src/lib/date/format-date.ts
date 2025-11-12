/**
 * Formats a date-like value into a human-readable string.
 *
 * @param dateLike - A value that can be converted to a Date. Accepts Date objects, strings, or numbers (timestamps).
 * @returns A formatted date string in the format "Month Day, Year, Hour:Minute AM/PM" (e.g., "Nov 12, 2025, 3:45 PM"),
 *          or "Invalid date" if the input cannot be converted to a valid date.
 *
 * @remarks
 * This function handles the known issue: RangeError: Invalid time value.
 * It safely attempts to parse various date formats and returns a fallback message for invalid inputs.
 *
 * @example
 * ```typescript
 * formatDate(new Date('2025-11-12')); // "Nov 12, 2025, 12:00 AM"
 * formatDate('2025-11-12'); // "Nov 12, 2025, 12:00 AM"
 * formatDate(1731369600000); // "Nov 12, 2025, 12:00 AM" (depends on timezone)
 * formatDate('invalid'); // "Invalid date"
 * formatDate(null); // "Invalid date"
 * ```
 */
export function formatDate(dateLike: unknown): string {
  let date: Date | null = null;

  // Try to convert Date objects
  if (dateLike instanceof Date && !isNaN(dateLike.valueOf())) {
    date = dateLike;
  }
  // Try to convert strings or numbers
  else if (typeof dateLike === 'string' || typeof dateLike === 'number') {
    const d = new Date(dateLike);
    if (!isNaN(d.valueOf())) {
      date = d;
    }
  }

  // Return fallback message if date is invalid
  if (!date) return 'Invalid date';

  // Format the date using Intl.DateTimeFormat
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
