const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the given instant — used for Postgres `DATE` columns. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** `YYYY-MM-DD` for a DATE column value. */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
