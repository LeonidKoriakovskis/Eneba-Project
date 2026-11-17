import { Star } from 'lucide-react';
import { formatCount } from '../lib/format';

const PLATFORM_STYLES: Record<string, { label: string; dot: string }> = {
  Steam: { label: 'Steam', dot: 'bg-sky-400' },
  PSN: { label: 'PlayStation', dot: 'bg-blue-500' },
  Xbox: { label: 'Xbox', dot: 'bg-green-500' },
  'Nintendo Switch': { label: 'Nintendo', dot: 'bg-red-500' },
};

export function PlatformBadge({ platform, className = '' }: { platform: string; className?: string }) {
  const style = PLATFORM_STYLES[platform] ?? { label: platform, dot: 'bg-eneba-muted' };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-black/30 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
      {style.label}
    </span>
  );
}

export function RegionTag({ region, className = '' }: { region: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-eneba-teal/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-eneba-teal ring-1 ring-inset ring-eneba-teal/40 ${className}`}
    >
      {region}
    </span>
  );
}

export function DiscountPill({ percent, className = '' }: { percent: number; className?: string }) {
  if (percent <= 0) return null;
  const color = percent >= 50 ? 'bg-eneba-magenta' : 'bg-eneba-orange';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold text-white shadow ${color} ${className}`}
    >
      -{percent}%
    </span>
  );
}

export function StarRating({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="h-4 w-4 fill-eneba-yellow text-eneba-yellow" aria-hidden />
      <span className="font-bold text-white">{rating.toFixed(2)}</span>
      {reviewCount !== undefined && <span className="text-eneba-muted">({formatCount(reviewCount)})</span>}
    </span>
  );
}
