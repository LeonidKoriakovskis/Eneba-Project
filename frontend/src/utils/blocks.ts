import type { HeroItem } from '../types/api';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function readString(config: Record<string, unknown> | null, key: string): string | undefined {
  const v = config?.[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function readNumber(config: Record<string, unknown> | null, key: string): number | undefined {
  const v = config?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);

/** Parses hero_banner slides from config.items; slides without a resolvable product are dropped. */
export function parseHeroItems(config: Record<string, unknown> | null): HeroItem[] {
  const raw = config?.items;
  if (!Array.isArray(raw)) return [];

  const items: HeroItem[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const productId = str(entry.product_id);
    const slug = str(entry.product_slug);
    const headline = str(entry.headline);
    if (!productId || !slug || !headline) continue;

    items.push({
      productId,
      slug,
      headline,
      subheading: str(entry.subheading),
      badge: str(entry.badge),
      bannerImage: str(entry.banner_image),
      lowestPriceCents: num(entry.lowest_price_cents),
      originalPriceCents: num(entry.original_price_cents),
      discountPercent: num(entry.discount_percent),
      totalStockCount: num(entry.total_stock_count),
    });
  }
  return items;
}
