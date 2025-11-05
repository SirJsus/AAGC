import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Timezone utility functions for converting between UTC (GMT-0) and clinic timezone
 *
 * IMPORTANT: All dates and times are stored in the database as UTC DateTime (GMT-0).
 * This ensures consistency regardless of timezone and allows for proper date/time
 * representation including timezone offsets that may shift dates.
 */

/**
 * Converts a date to string in yyyy-MM-dd format (in clinic timezone)
 * This is useful for comparing dates or passing to APIs that expect string dates
 * @param date - The date object
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Date string in yyyy-MM-dd format in clinic timezone
 */
export function formatDateToString(
  date: Date,
  timezone: string = "America/Mexico_City"
): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

/**
 * Converts a date (interpreted as midnight in clinic timezone) to UTC DateTime for storage
 * @param date - The date object from the user's selection or existing Date/string
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Date object in UTC to be stored in DB
 */
export function formatDateForInput(
  date: Date | string,
  timezone: string = "America/Mexico_City"
): Date {
  // If already a Date object, extract its date components in the local (browser) timezone
  // and interpret them as being in the clinic timezone
  if (date instanceof Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateTimeString = `${year}-${month}-${day}T00:00:00`;
    return fromZonedTime(dateTimeString, timezone);
  }

  // If it's a string (yyyy-MM-dd), interpret it as midnight in clinic timezone
  const dateTimeString = `${date}T00:00:00`;
  return fromZonedTime(dateTimeString, timezone);
}

/**
 * Extracts time in clinic timezone from a Date object
 * @param date - The date object
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Time string in HH:mm format in clinic timezone
 */
export function formatTimeForInput(
  date: Date,
  timezone: string = "America/Mexico_City"
): string {
  return formatInTimeZone(date, timezone, "HH:mm");
}

/**
 * Formats a UTC DateTime from DB for display in clinic timezone
 * @param date - UTC DateTime from database
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @param locale - Locale for formatting (default: es-MX)
 * @returns Formatted date and time string in clinic timezone
 */
export function formatDateTimeForDisplay(
  date: Date,
  timezone: string = "America/Mexico_City",
  locale: string = "es-MX"
): string {
  // Convert UTC DateTime to clinic timezone for display
  return formatInTimeZone(date, timezone, "PPP p", {
    /* locale: es */
  });
}

/**
 * Formats a UTC DateTime from DB as date only in clinic timezone
 * @param date - UTC DateTime from database (as Date or ISO string)
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @param locale - Locale for formatting (default: es-MX)
 * @returns Formatted date string in clinic timezone
 */
export function formatDateForDisplay(
  date: Date | string,
  timezone: string = "America/Mexico_City",
  locale: string = "es-MX"
): string {
  let dateObj: Date;

  if (typeof date === "string") {
    // Parse ISO string from DB (stored in UTC)
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  // Convert UTC DateTime to clinic timezone for display
  return formatInTimeZone(dateObj, timezone, "PPP", {
    /* locale: es */
  });
}

/**
 * Formats a time string for display (no timezone conversion needed)
 * @param time - Time string in HH:mm format
 * @param locale - Locale for formatting (default: es-MX)
 * @returns Formatted time string
 */
export function formatTimeForDisplay(
  time: string,
  locale: string = "es-MX"
): string {
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  // This function doesn't involve timezones, just formatting a time string
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Creates a UTC DateTime from a date and time in clinic timezone
 * @param date - Date string in yyyy-MM-dd format (in clinic timezone)
 * @param time - Time string in HH:mm format (in clinic timezone)
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Date object in UTC to be stored in DB
 */
export function createDateTimeInTimezone(
  date: string, // "yyyy-MM-dd"
  time: string, // "HH:mm"
  timezone: string = "America/Mexico_City"
): Date {
  const dateTimeString = `${date}T${time}:00`;
  // Convert from clinic timezone to UTC for storage
  return fromZonedTime(dateTimeString, timezone);
}

/**
 * Gets current date in clinic timezone
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Current date string in yyyy-MM-dd format in clinic timezone
 */
export function getCurrentDateInTimezone(
  timezone: string = "America/Mexico_City"
): string {
  const now = new Date();
  return formatInTimeZone(now, timezone, "yyyy-MM-dd");
}

/**
 * Gets current time in clinic timezone
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Current time string in HH:mm format in clinic timezone
 */
export function getCurrentTimeInTimezone(
  timezone: string = "America/Mexico_City"
): string {
  const now = new Date();
  return formatInTimeZone(now, timezone, "HH:mm");
}

/**
 * Converts a UTC DateTime from DB to clinic timezone Date object
 * Useful when you need to extract date/time components in clinic timezone
 * @param utcDate - UTC DateTime from database
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Date object adjusted to clinic timezone
 */
export function convertUTCToClinicTimezone(
  utcDate: Date | string,
  timezone: string = "America/Mexico_City"
): Date {
  const dateObj = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return toZonedTime(dateObj, timezone);
}

/**
 * Extracts date string (yyyy-MM-dd) from UTC DateTime in clinic timezone
 * @param utcDate - UTC DateTime from database
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Date string in yyyy-MM-dd format in clinic timezone
 */
export function extractDateInClinicTimezone(
  utcDate: Date | string,
  timezone: string = "America/Mexico_City"
): string {
  const dateObj = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return formatInTimeZone(dateObj, timezone, "yyyy-MM-dd");
}

/**
 * Extracts time string (HH:mm) from UTC DateTime in clinic timezone
 * @param utcDate - UTC DateTime from database
 * @param timezone - The clinic's timezone (default: America/Mexico_City)
 * @returns Time string in HH:mm format in clinic timezone
 */
export function extractTimeInClinicTimezone(
  utcDate: Date | string,
  timezone: string = "America/Mexico_City"
): string {
  const dateObj = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return formatInTimeZone(dateObj, timezone, "HH:mm");
}
