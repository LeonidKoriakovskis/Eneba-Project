import { useEffect, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Heart, Loader2, ShoppingCart } from 'lucide-react';
import type { ProductSummary } from '../types/api';
import { api } from '../api/client';
import { MAX_QTY_PER_OFFER, useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import { CoverImage } from './CoverImage';
import { DiscountPill } from './Badges';
import { PlatformIcon } from './PlatformBadge';

function platformLabel(platform: string): string {
  const normalized = platform.toLowerCase();
  if (normalized.includes('steam')) return 'Steam';
  if (normalized.includes('psn') || normalized.includes('playstation')) return 'PSN';
  if (normalized.includes('xbox')) return 'Xbox';
  if (normalized.includes('nintendo')) return 'Nintendo';
  return platform;
}

export function ProductCard({ product, className = '' }: { product: ProductSummary; className?: string }) {
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [wishlisted, setWishlisted] = useState(false);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const inStock = product.total_stock_count > 0 && product.lowest_price_cents > 0;
  const hasDiscount = product.discount_percent > 0 && product.original_price_cents > product.lowest_price_cents;

  useEffect(() => {
    if (!justAdded) return;
    const id = window.setTimeout(() => setJustAdded(false), 1600);
    return () => window.clearTimeout(id);
  }, [justAdded]);

  const handleToggleWishlist = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlisted((prev) => !prev);
  };

  const handleQuickAdd = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock || adding) return;

    setAdding(true);
    try {
      const detail = await api.getProduct(product.slug);
      const bestOffer = (detail.offers ?? []).find((o) => o.in_stock && o.available_keys_count > 0);
      if (!bestOffer) {
        navigate(`/product/${product.slug}`);
        return;
      }

      addItem(
        {
          sellerOfferId: bestOffer.id,
          productId: product.id,
          slug: product.slug,
          title: product.title,
          coverImageUrl: product.cover_image_url,
          platform: product.platform,
          region: product.region,
          sellerName: bestOffer.seller_name,
          unitPriceCents: bestOffer.price_cents,
          originalPriceCents: bestOffer.original_price_cents,
          maxQuantity: Math.min(MAX_QTY_PER_OFFER, bestOffer.available_keys_count),
        },
        1,
        { openDrawer: true },
      );
      setJustAdded(true);
    } catch {
      navigate(`/product/${product.slug}`);
    } finally {
      setAdding(false);
    }
  };

  return (
    <article
      className={`group relative flex h-[380px] flex-col overflow-hidden rounded-xl bg-eneba-card shadow-card ring-1 ring-white/10 transition-colors duration-300 hover:ring-eneba-yellow/70 focus-within:ring-2 focus-within:ring-eneba-yellow ${className}`}
    >
      {/* Cover artwork + centered bottom platform strip + wishlist button */}
      <div className="relative h-[236px] w-full shrink-0 overflow-hidden bg-eneba-canvasLight">
        <Link to={`/product/${product.slug}`} tabIndex={-1} aria-label={product.title} className="block h-full w-full">
          <CoverImage
            src={product.cover_image_url}
            alt={product.title}
            className={`h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 ${inStock ? '' : 'opacity-40 grayscale'}`}
          />
        </Link>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#12052E]/85 to-transparent" />

        <button
          type="button"
          onClick={handleToggleWishlist}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          aria-pressed={wishlisted}
          className={`absolute right-2.5 top-2.5 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#12052E]/75 text-white ring-1 ring-white/15 backdrop-blur-sm transition-all duration-200 hover:bg-[#12052E] hover:text-eneba-magenta focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-eneba-yellow ${
            wishlisted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart className={`h-4 w-4 ${wishlisted ? 'fill-eneba-magenta text-eneba-magenta' : ''}`} aria-hidden />
        </button>

        {!inStock && (
          <span className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-md bg-black/75 px-2.5 py-1 text-center text-xs font-extrabold uppercase tracking-wide text-white">
            Out of stock
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1.5 border-t border-white/10 bg-[#12052E]/85 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm">
          <PlatformIcon platform={product.platform} className="h-3.5 w-3.5 shrink-0 text-white" />
          <span>{platformLabel(product.platform)}</span>
        </div>
      </div>

      {/* Lower card body & hover slide-up action panel */}
      <div className="relative z-20 flex min-h-[236px] shrink-0 flex-col bg-eneba-card p-3.5 transition-[transform,background-color,box-shadow] duration-300 ease-out group-hover:-translate-y-[92px] group-hover:bg-eneba-cardHover group-hover:shadow-[0_-10px_24px_rgba(18,5,46,0.85)] group-focus-within:-translate-y-[92px] group-focus-within:bg-eneba-cardHover group-focus-within:shadow-[0_-10px_24px_rgba(18,5,46,0.85)]">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-extrabold leading-snug text-white">
          <Link to={`/product/${product.slug}`} className="transition-colors hover:text-eneba-yellow focus:outline-none">
            {product.title}
          </Link>
        </h3>

        <div className="mt-1 text-[11px] font-black uppercase tracking-wider text-eneba-teal">
          {product.region}
        </div>

        <div className="mt-2">
          {inStock ? (
            <>
              <div className="flex min-h-[1.25rem] items-center gap-1.5">
                {hasDiscount && (
                  <>
                    <span className="text-xs font-medium text-eneba-muted line-through">
                      {formatPrice(product.original_price_cents)}
                    </span>
                    <DiscountPill percent={product.discount_percent} />
                  </>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[11px] font-semibold uppercase text-eneba-muted">From</span>
                <span className="text-lg font-black text-white">{formatPrice(product.lowest_price_cents)}</span>
              </div>
            </>
          ) : (
            <div className="flex min-h-[3rem] items-center text-sm font-bold text-eneba-muted">Currently unavailable</div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            disabled={!inStock || adding}
            onClick={handleQuickAdd}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FFDC00] px-3 py-2 text-xs font-extrabold text-[#1F0A4D] transition hover:bg-eneba-yellowHover focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Adding…
              </>
            ) : justAdded ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Added
              </>
            ) : (
              <>
                <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                {inStock ? 'Add to Cart' : 'Out of Stock'}
              </>
            )}
          </button>

          <Link
            to={`/product/${product.slug}`}
            className="inline-flex w-full items-center justify-center rounded-lg border border-white/30 px-3 py-1.5 text-xs font-extrabold text-white transition hover:border-[#FFDC00] hover:text-[#FFDC00] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFDC00]"
          >
            View Offers
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="h-[380px] overflow-hidden rounded-xl bg-eneba-card ring-1 ring-white/5" aria-hidden>
      <div className="h-[236px] animate-pulse bg-eneba-canvasLight" />
      <div className="space-y-2 p-3.5">
        <div className="h-4 w-11/12 animate-pulse rounded bg-eneba-canvasLight" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-eneba-canvasLight" />
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-eneba-canvasLight" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-eneba-canvasLight" />
      </div>
    </div>
  );
}
