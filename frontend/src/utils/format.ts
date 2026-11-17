const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

export function formatPrice(cents: number): string {
  return eur.format(cents / 100);
}

export function formatReleaseDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Rejects open-redirect schemes or protocol-relative URLs; allows safe in-app relative paths. */
export function sanitizeRedirect(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return fallback;
  }
  return trimmed;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

/** cents -> editable euro string ("" when undefined). */
export function centsToEuroInput(cents: number | undefined): string {
  if (cents === undefined) return '';
  const euros = cents / 100;
  return Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
}

/** Euro input string -> cents (undefined when empty/invalid/negative). */
export function euroInputToCents(value: string): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return undefined;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}
