/**
 * Utility functions for robust date parsing, formatting, and sorting across the application.
 */

/**
 * Formats any date string (ISO "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss", "DD/MM/YYYY", etc.)
 * into the uniform Portuguese standard "DD/MM/YYYY".
 */
export const formatDate = (d?: string | null, fallback = '-'): string => {
  if (!d) return fallback;
  const str = String(d).trim();
  if (!str) return fallback;

  // Already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY with time: "DD/MM/YYYY HH:mm..."
  const dmyWithTime = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyWithTime) {
    const [, day, month, year] = dmyWithTime;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  // Fallback via Date constructor
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str || fallback;
};

/**
 * Formats any date string to "YYYY-MM-DD" for HTML <input type="date"> elements.
 */
export const formatDateToInput = (d?: string | null): string => {
  if (!d) return '';
  const str = String(d).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY-MM-DD with time
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
};

/**
 * Returns today's date formatted as DD/MM/YYYY.
 */
export const getTodayFormatted = (): string => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Safely parses any date string into milliseconds for robust chronological sorting.
 * Handles:
 * - ISO strings: "2026-02-01", "2026-02-01T14:30:00Z"
 * - Portuguese formats: "DD/MM/YYYY", "DD/MM/YYYY HH:mm", "DD-MM-YYYY"
 * - Returns 0 for invalid/empty dates so they sort cleanly to the end
 */
export const parseDateToMs = (d?: string | null): number => {
  if (!d) return 0;
  const str = String(d).trim();
  if (!str) return 0;

  // DD/MM/YYYY or DD-MM-YYYY (with optional time)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
  if (dmyMatch) {
    const [, day, month, year, rest] = dmyMatch;
    const timePart = rest?.trim() || '';
    const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${timePart ? 'T' + timePart : ''}`;
    const t = new Date(isoStr).getTime();
    if (!isNaN(t)) return t;
  }

  const parsed = new Date(str).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Sort comparator for newest date first (descending).
 * If dates are identical or missing, falls back to alphanumeric descending of reference/number.
 */
export const sortByDateDesc = <T>(
  getDate: (item: T) => string | undefined | null,
  getFallbackKey?: (item: T) => string | undefined | null
) => {
  return (a: T, b: T): number => {
    const dateA = parseDateToMs(getDate(a));
    const dateB = parseDateToMs(getDate(b));
    if (dateB !== dateA) {
      return dateB - dateA;
    }
    if (getFallbackKey) {
      const keyA = getFallbackKey(a) || '';
      const keyB = getFallbackKey(b) || '';
      return keyB.localeCompare(keyA, undefined, { numeric: true });
    }
    return 0;
  };
};
