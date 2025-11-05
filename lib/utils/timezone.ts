/**
 * Timezone utility functions for converting between UTC and clinic timezone
 */

export function formatDateForInput(date: Date): string {
  // The date from the calendar is created in the user's local timezone at midnight.
  // For example, if the user is in GMT+2 and selects Oct 15, the date is "2025-10-15T00:00:00.000+02:00".
  // The UTC representation of this is "2025-10-14T22:00:00.000Z".
  // To prevent this, we can create a new date that ignores the timezone offset,
  // effectively treating the selected date as UTC.
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const utcDate = new Date(Date.UTC(year, month, day));

  // Now format it to 'en-CA' (YYYY-MM-DD) which is timezone-agnostic.
  return utcDate.toLocaleDateString("en-CA", { timeZone: "UTC" });
}

export function formatTimeForInput(
  date: Date,
  timezone: string = "America/Mexico_City"
): string {
  return date.toLocaleTimeString("en-GB", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTimeForDisplay(
  date: Date,
  timezone: string = "America/Mexico_City",
  locale: string = "es-MX"
): string {
  return date.toLocaleString(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDateForDisplay(
  date: Date | string,
  timezone: string = "America/Mexico_City",
  locale: string = "es-MX"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString(locale, {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTimeForDisplay(
  time: string,
  locale: string = "es-MX"
): string {
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function createDateTimeInTimezone(
  date: string,
  time: string,
  timezone: string = "America/Mexico_City"
): Date {
  // Create a date string that will be interpreted in the specified timezone
  const dateTimeString = `${date}T${time}:00`;
  const tempDate = new Date(dateTimeString);

  // Get the offset for the timezone
  const utcDate = new Date(
    tempDate.getTime() + tempDate.getTimezoneOffset() * 60000
  );

  // Adjust for the target timezone
  // Note: This is a simplified approach. For production, use a library like date-fns-tz
  const timezoneOffset = getTimezoneOffset(timezone);
  return new Date(utcDate.getTime() - timezoneOffset * 60000);
}

export function getTimezoneOffset(timezone: string): number {
  // Simplified timezone offset mapping
  // In production, use Intl.DateTimeFormat for accurate offset calculation
  const offsets: Record<string, number> = {
    "America/Mexico_City": -360, // UTC-6 (standard time)
    "America/New_York": -300, // UTC-5 (standard time)
    "America/Los_Angeles": -480, // UTC-8 (standard time)
    UTC: 0,
  };

  return offsets[timezone] || 0;
}

export function getCurrentDateInTimezone(
  timezone: string = "America/Mexico_City"
): string {
  const now = new Date();
  return formatDateForInput(now);
}

export function getCurrentTimeInTimezone(
  timezone: string = "America/Mexico_City"
): string {
  const now = new Date();
  return formatTimeForInput(now, timezone);
}
