const MONEY_LOCALE = "sv-SE";
const DATE_LOCALE = "en-GB";
const TIME_ZONE = "Europe/Stockholm";

export const formatNumber = (n: number) =>
  n.toLocaleString(MONEY_LOCALE, {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

export const formatMoney = (n: number, currency: string) => `${formatNumber(n)} ${currency}`;

export const formatSek = (n: number) => formatMoney(n, "SEK");

export const formatRate = (rate: number) =>
  rate.toLocaleString(MONEY_LOCALE, { maximumFractionDigits: 6 });

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(DATE_LOCALE, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

// Date only strings like an ECB rate date: read as noon UTC so the day never shifts.
export const formatDay = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(DATE_LOCALE, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const formatUsd = (n: number) => `$${n.toFixed(4)}`;

export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
