const LOCALE = "en-US";

export function formatCurrency(
  amount: number,
  currency: string,
  options: { compact?: boolean } = {},
): string {
  const locale = currency.toUpperCase() === "PHP" ? "en-PH" : LOCALE;
  if (options.compact && amount === 0) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(0);
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    minimumFractionDigits: options.compact ? 0 : 2,
    maximumFractionDigits: options.compact ? 1 : 2,
  }).format(amount);
}

/** Formats a per-currency total map, e.g. "$120K · €4.5K". Never sums across currencies. */
export function formatCurrencyTotals(
  totals: Record<string, number>,
  fallbackCurrency: string,
  options: { compact?: boolean } = {},
): string {
  const entries = Object.entries(totals).filter(([, value]) => value !== 0);
  if (entries.length === 0) return formatCurrency(0, fallbackCurrency, options);
  return entries
    .sort(([, a], [, b]) => b - a)
    .map(([currency, value]) => formatCurrency(value, currency, options))
    .join(" · ");
}

export function addToTotals(totals: Record<string, number>, currency: string, amount: number): void {
  totals[currency] = (totals[currency] ?? 0) + amount;
}

/** Formats a `YYYY-MM-DD` (or ISO) date without timezone drift. */
export function formatDate(isoDate: string, options: { withYear?: boolean } = {}): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    year: options.withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

export function formatDateTimeUtc(isoDate: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(isoDate));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
