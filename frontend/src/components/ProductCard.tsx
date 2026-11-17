import { Link } from 'react-router-dom';
import type { ProductSummary } from '../types/api';
import { formatPrice } from '../lib/format';
import { CoverImage } from './CoverImage';
import { DiscountPill, PlatformBadge, RegionTag } from './Badges';

export function ProductCard({ product, className = '' }: { product: ProductSummary; className?: string }) {
  const inStock = product.total_stock_count > 0 && product.lowest_price_cents > 0;
  const hasDiscount = product.discount_percent > 0 && product.original_price_cents > product.lowest_price_cents;

  return (
    <Link
      to={`/product/${product.slug}`}
      className={`group flex flex-col overflow-hidden rounded-xl bg-eneba-card shadow-card ring-1 ring-white/5 transition duration-200 hover:-translate-y-1 hover:bg-eneba-cardHover hover:ring-eneba-yellow/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-eneba-yellow ${className}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-eneba-canvasLight">
        <CoverImage
          src={product.cover_image_url}
          alt={product.title}
          className={`h-full w-full transition duration-300 group-hover:scale-105 ${inStock ? '' : 'opacity-40 grayscale'}`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-eneba-card to-transparent" />
        {inStock && hasDiscount && <DiscountPill percent={product.discount_percent} className="absolute left-2 top-2" />}
        <RegionTag region={product.region} className="absolute bottom-2 left-2 backdrop-blur" />
        {!inStock && (
          <span className="absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-md bg-black/70 px-2 py-1 text-center text-xs font-extrabold uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-snug text-white">{product.title}</h3>
        <div>
          <PlatformBadge platform={product.platform} />
        </div>

        <div className="mt-auto pt-1">
          {inStock ? (
            <>
              {hasDiscount && (
                <div className="text-xs text-eneba-muted line-through">{formatPrice(product.original_price_cents)}</div>
              )}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold uppercase text-eneba-muted">From</span>
                <span className="text-lg font-black text-white">{formatPrice(product.lowest_price_cents)}</span>
              </div>
            </>
          ) : (
            <div className="text-sm font-bold text-eneba-muted">Currently unavailable</div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl bg-eneba-card ring-1 ring-white/5" aria-hidden>
      <div className="aspect-[3/4] animate-pulse bg-eneba-canvasLight" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-11/12 animate-pulse rounded bg-eneba-canvasLight" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-eneba-canvasLight" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-eneba-canvasLight" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-eneba-canvasLight" />
      </div>
    </div>
  );
}
