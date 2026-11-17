import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Clock, KeyRound, ShieldCheck, ShoppingCart, Zap } from 'lucide-react';
import { api, ApiError, errorMessage } from '../api/client';
import type { ProductDetail, SellerOffer } from '../types/api';
import { MAX_QTY_PER_OFFER, useCart, type NewCartItem } from '../context/CartContext';
import { useDocumentTitle } from '../utils/hooks';
import { formatCount, formatPrice, formatReleaseDate } from '../utils/format';
import { CoverImage } from '../components/CoverImage';
import { DiscountPill, PlatformBadge, RegionTag, StarRating } from '../components/Badges';
import { ErrorState } from '../components/ErrorState';
import NotFoundPage from './NotFoundPage';

type State =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'ready'; product: ProductDetail };

function toCartItem(product: ProductDetail, offer: SellerOffer): NewCartItem {
  return {
    sellerOfferId: offer.id,
    productId: product.id,
    slug: product.slug,
    title: product.title,
    coverImageUrl: product.cover_image_url,
    platform: product.platform,
    region: product.region,
    sellerName: offer.seller_name,
    unitPriceCents: offer.price_cents,
    originalPriceCents: offer.original_price_cents,
    maxQuantity: Math.min(MAX_QTY_PER_OFFER, offer.available_keys_count),
  };
}

function Price({ offer, size = 'md' }: { offer: SellerOffer; size?: 'md' | 'lg' }) {
  const hasDiscount = offer.discount_percent > 0 && offer.original_price_cents > offer.price_cents;
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {hasDiscount && <DiscountPill percent={offer.discount_percent} />}
      {hasDiscount && <span className="text-sm text-eneba-muted line-through">{formatPrice(offer.original_price_cents)}</span>}
      <span className={`font-black text-white ${size === 'lg' ? 'text-4xl' : 'text-xl'}`}>{formatPrice(offer.price_cents)}</span>
    </div>
  );
}

function StockLabel({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-sm font-extrabold text-eneba-magenta">Sold Out</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-eneba-teal">
      <KeyRound className="h-4 w-4" aria-hidden />
      {formatCount(count)} key{count === 1 ? '' : 's'} in stock
    </span>
  );
}

export default function ProductPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem, getQuantity } = useCart();

  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    api
      .getProduct(slug, ctrl.signal)
      .then((product) => setState({ status: 'ready', product }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.status === 404) setState({ status: 'not_found' });
        else setState({ status: 'error', message: errorMessage(err) });
      });
    return () => ctrl.abort();
  }, [slug, attempt]);

  useEffect(() => {
    if (!justAdded) return;
    const id = window.setTimeout(() => setJustAdded(null), 1600);
    return () => window.clearTimeout(id);
  }, [justAdded]);

  const product = state.status === 'ready' ? state.product : null;
  useDocumentTitle(product ? `Buy ${product.title} – ${product.platform} key` : undefined);

  // The API returns offers sorted by price ASC; "best" = cheapest one that is actually in stock.
  const offers = useMemo(() => product?.offers ?? [], [product]);
  const bestOffer = useMemo(() => offers.find((o) => o.in_stock && o.available_keys_count > 0), [offers]);

  const handleAdd = useCallback(
    (offer: SellerOffer) => {
      if (!product) return;
      addItem(toCartItem(product, offer), 1);
      setJustAdded(offer.id);
    },
    [addItem, product],
  );

  const handleBuyNow = useCallback(
    (offer: SellerOffer) => {
      if (!product) return;
      if (getQuantity(offer.id) === 0) addItem(toCartItem(product, offer), 1, { openDrawer: false });
      navigate('/cart');
    },
    [addItem, getQuantity, navigate, product],
  );

  if (state.status === 'loading') return <ProductSkeleton />;
  if (state.status === 'not_found') return <NotFoundPage message="We couldn't find that game." />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => setAttempt((n) => n + 1)} />;

  const p = state.product;

  const addLabel = (offer: SellerOffer) => {
    if (justAdded === offer.id) return <><Check className="h-4 w-4" aria-hidden /> Added</>;
    return <><ShoppingCart className="h-4 w-4" aria-hidden /> Add to Cart</>;
  };
  const atMax = (offer: SellerOffer) => getQuantity(offer.id) >= Math.min(MAX_QTY_PER_OFFER, offer.available_keys_count);

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-eneba-muted">
        <Link to="/" className="hover:text-white">Home</Link>
        <ChevronRight className="h-4 w-4" aria-hidden />
        <Link to="/store" className="hover:text-white">Store</Link>
        <ChevronRight className="h-4 w-4" aria-hidden />
        <span className="truncate font-semibold text-white">{p.title}</span>
      </nav>

      {/* Hero card */}
      <section className="grid gap-6 rounded-2xl bg-eneba-card p-5 shadow-card ring-1 ring-white/10 md:grid-cols-[300px_minmax(0,1fr)] md:p-7 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[320px] md:max-w-none">
          <div className="overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/15">
            <CoverImage src={p.cover_image_url} alt={p.title} className="aspect-[3/4] w-full" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <PlatformBadge platform={p.platform} />
              <RegionTag region={p.region} />
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{p.genre}</span>
            </div>
            <h1 className="text-3xl font-black leading-tight md:text-4xl">{p.title}</h1>
            <p className="mt-2 text-sm text-eneba-muted">
              Released {formatReleaseDate(p.release_date)} · {p.total_offers_count} offer{p.total_offers_count === 1 ? '' : 's'} from trusted sellers
            </p>
          </div>

          <p className="max-w-3xl text-sm leading-relaxed text-white/85 md:text-base">{p.description}</p>

          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-eneba-muted">
            <li className="inline-flex items-center gap-2"><Zap className="h-4 w-4 text-eneba-yellow" aria-hidden /> Instant key delivery</li>
            <li className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-eneba-teal" aria-hidden /> Verified sellers</li>
            <li className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-eneba-orange" aria-hidden /> Activate on {p.platform}</li>
          </ul>

          {/* Featured / best offer */}
          {bestOffer ? (
            <div className="mt-auto rounded-2xl bg-gradient-to-br from-eneba-brand to-eneba-canvasLight p-5 ring-2 ring-eneba-yellow/70">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-eneba-yellow px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-eneba-ink">
                  {bestOffer.is_featured ? 'Featured · Best offer' : 'Best offer'}
                </span>
                <span className="text-sm font-bold">{bestOffer.seller_name}</span>
                <StarRating rating={bestOffer.seller_rating} reviewCount={bestOffer.review_count} />
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                  <Price offer={bestOffer} size="lg" />
                  <StockLabel count={bestOffer.available_keys_count} />
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <button type="button" className="btn-outline px-6 py-3" disabled={atMax(bestOffer)} onClick={() => handleAdd(bestOffer)}>
                    {addLabel(bestOffer)}
                  </button>
                  <button type="button" className="btn-yellow px-8 py-3 text-base" onClick={() => handleBuyNow(bestOffer)}>
                    Buy Now
                  </button>
                </div>
              </div>
              {atMax(bestOffer) && (
                <p className="mt-2 text-xs font-semibold text-eneba-muted">You already have the maximum available quantity in your cart.</p>
              )}
            </div>
          ) : (
            <div className="mt-auto rounded-2xl bg-black/25 p-5 ring-1 ring-white/10">
              <p className="text-lg font-extrabold">Currently out of stock</p>
              <p className="mt-1 text-sm text-eneba-muted">All sellers are sold out right now. Check back soon for new keys.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-outline" disabled>Add to Cart</button>
                <button type="button" className="btn-yellow" disabled>Buy Now</button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Compare seller offers */}
      <section aria-labelledby="offers-heading">
        <div className="mb-4 flex items-baseline gap-3">
          <h2 id="offers-heading" className="text-xl font-black md:text-2xl">Compare seller offers</h2>
          <span className="text-sm font-semibold text-eneba-muted">{offers.length} seller{offers.length === 1 ? '' : 's'}</span>
        </div>

        {offers.length === 0 ? (
          <p className="rounded-xl bg-eneba-card p-6 text-eneba-muted ring-1 ring-white/10">No seller offers available yet.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-eneba-card ring-1 ring-white/10">
            <div className="hidden grid-cols-[minmax(0,2fr)_1.2fr_1.2fr_1.4fr_auto] gap-4 border-b border-white/10 bg-black/20 px-5 py-3 text-xs font-extrabold uppercase tracking-widest text-eneba-muted md:grid">
              <span>Seller</span>
              <span>Rating</span>
              <span>Availability</span>
              <span>Price</span>
              <span className="w-36 text-right">&nbsp;</span>
            </div>

            <ul>
              {offers.map((offer) => {
                const soldOut = !offer.in_stock || offer.available_keys_count <= 0;
                const isBest = bestOffer?.id === offer.id;
                return (
                  <li
                    key={offer.id}
                    className={`grid gap-3 border-b border-white/5 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,2fr)_1.2fr_1.2fr_1.4fr_auto] md:items-center md:gap-4 ${
                      soldOut ? 'opacity-60' : isBest ? 'bg-eneba-yellow/5' : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate font-extrabold">{offer.seller_name}</span>
                      {isBest && <span className="rounded bg-eneba-yellow px-1.5 py-0.5 text-[10px] font-black uppercase text-eneba-ink">Best price</span>}
                      {offer.is_featured && <span className="rounded bg-eneba-teal/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-eneba-teal">Featured</span>}
                    </div>
                    <div><StarRating rating={offer.seller_rating} reviewCount={offer.review_count} /></div>
                    <div><StockLabel count={offer.available_keys_count} /></div>
                    <div><Price offer={offer} /></div>
                    <div className="md:w-36 md:text-right">
                      <button
                        type="button"
                        className="btn-yellow w-full px-4 py-2 md:w-auto"
                        disabled={soldOut || atMax(offer)}
                        onClick={() => handleAdd(offer)}
                      >
                        {soldOut ? 'Sold Out' : justAdded === offer.id ? <><Check className="h-4 w-4" aria-hidden /> Added</> : <><ShoppingCart className="h-4 w-4" aria-hidden /> Add to Cart</>}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading product">
      <div className="h-5 w-64 animate-pulse rounded bg-eneba-card" />
      <div className="grid gap-6 rounded-2xl bg-eneba-card p-7 md:grid-cols-[300px_1fr]">
        <div className="aspect-[3/4] animate-pulse rounded-xl bg-eneba-canvasLight" />
        <div className="space-y-4">
          <div className="h-6 w-40 animate-pulse rounded bg-eneba-canvasLight" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-eneba-canvasLight" />
          <div className="h-24 w-full animate-pulse rounded bg-eneba-canvasLight" />
          <div className="h-36 w-full animate-pulse rounded-2xl bg-eneba-canvasLight" />
        </div>
      </div>
    </div>
  );
}
