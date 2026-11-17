import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingCart, Trash2, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import { PlatformBadge, RegionTag } from '../components/Badges';
import { CoverImage } from '../components/CoverImage';

export default function CartPage() {
  useDocumentTitle('Your Cart');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { items, itemCount, totalCents, setQuantity, removeItem, clear } = useCart();

  const totalOriginalCents = items.reduce(
    (sum, item) => sum + Math.max(item.originalPriceCents, item.unitPriceCents) * item.quantity,
    0,
  );
  const totalSavingsCents = Math.max(0, totalOriginalCents - totalCents);

  const handleProceed = () => {
    navigate(isAuthenticated ? '/checkout' : '/login?redirect=/checkout');
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-eneba-card px-6 py-16 text-center shadow-card ring-1 ring-white/10">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-eneba-brand/60 text-eneba-yellow ring-1 ring-white/10">
          <ShoppingCart className="h-8 w-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-black">Your cart is empty</h1>
        <p className="max-w-sm text-sm text-eneba-muted">
          Looks like you haven’t added any digital game keys yet. Explore deals from verified sellers across all platforms.
        </p>
        <Link to="/store" className="btn-yellow mt-2 px-6 py-3">
          Browse Store <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Shopping Cart</h1>
          <p className="text-sm text-eneba-muted">
            {itemCount} digital key{itemCount === 1 ? '' : 's'} ready for instant delivery
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/store" className="text-sm font-bold text-eneba-yellow hover:underline">
            Continue shopping
          </Link>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg bg-black/25 px-3 py-1.5 text-xs font-bold text-eneba-muted ring-1 ring-white/10 transition hover:bg-black/40 hover:text-white"
          >
            Clear cart
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Cart items" className="space-y-4">
          {items.map((item) => {
            const hasDiscount = item.originalPriceCents > item.unitPriceCents;
            const lineTotal = item.unitPriceCents * item.quantity;
            const atLimit = item.quantity >= item.maxQuantity;

            return (
              <article
                key={item.sellerOfferId}
                className="flex flex-col gap-4 rounded-2xl bg-eneba-card p-4 shadow-card ring-1 ring-white/10 sm:flex-row sm:items-center sm:p-5"
              >
                <Link
                  to={`/product/${item.slug}`}
                  className="w-24 shrink-0 overflow-hidden rounded-xl bg-eneba-canvasLight ring-1 ring-white/10 sm:w-28"
                >
                  <CoverImage src={item.coverImageUrl} alt={item.title} className="aspect-[3/4] w-full" />
                </Link>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <PlatformBadge platform={item.platform} />
                    <RegionTag region={item.region} />
                  </div>

                  <Link
                    to={`/product/${item.slug}`}
                    className="line-clamp-2 text-lg font-extrabold text-white hover:text-eneba-yellow"
                  >
                    {item.title}
                  </Link>

                  <p className="text-sm text-eneba-muted">
                    Sold by <span className="font-bold text-white">{item.sellerName}</span>
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-4">
                    <div className="inline-flex items-center rounded-lg bg-eneba-canvas/80 p-1 ring-1 ring-white/10">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.title}`}
                        disabled={item.quantity <= 1}
                        onClick={() => setQuantity(item.sellerOfferId, item.quantity - 1)}
                        className="rounded-md p-1.5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Minus className="h-4 w-4" aria-hidden />
                      </button>
                      <span
                        data-testid={`qty-${item.sellerOfferId}`}
                        className="min-w-[2.25rem] text-center text-sm font-extrabold tabular-nums"
                      >
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.title}`}
                        disabled={atLimit}
                        onClick={() => setQuantity(item.sellerOfferId, item.quantity + 1)}
                        className="rounded-md p-1.5 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    <span className="text-xs font-semibold text-eneba-muted">
                      {atLimit ? `Max stock reached (${item.maxQuantity})` : `Up to ${item.maxQuantity} available`}
                    </span>

                    <button
                      type="button"
                      onClick={() => removeItem(item.sellerOfferId)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-eneba-magenta transition hover:bg-eneba-magenta/10 sm:ml-0"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex shrink-0 items-baseline justify-between border-t border-white/10 pt-3 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                  <div className="text-xs text-eneba-muted">
                    {formatPrice(item.unitPriceCents)} × {item.quantity}
                  </div>
                  <div className="text-right">
                    {hasDiscount && (
                      <div className="text-xs text-eneba-muted line-through">
                        {formatPrice(item.originalPriceCents * item.quantity)}
                      </div>
                    )}
                    <div className="text-xl font-black text-white">{formatPrice(lineTotal)}</div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <aside aria-label="Order summary" className="lg:sticky lg:top-28 lg:self-start">
          <div className="space-y-5 rounded-2xl bg-eneba-card p-6 shadow-card ring-1 ring-white/10">
            <h2 className="text-xl font-black">Order Summary</h2>

            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-eneba-muted">
                  Subtotal ({itemCount} item{itemCount === 1 ? '' : 's'})
                </dt>
                <dd className="font-bold text-white">{formatPrice(totalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-eneba-muted">Service fee</dt>
                <dd className="font-bold text-eneba-teal">€0.00 (Free)</dd>
              </div>
              {totalSavingsCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-eneba-muted">You save</dt>
                  <dd className="font-bold text-eneba-teal">-{formatPrice(totalSavingsCents)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                <dt className="text-base font-extrabold text-white">Total</dt>
                <dd className="text-2xl font-black text-eneba-yellow">{formatPrice(totalCents)}</dd>
              </div>
            </dl>

            <button type="button" onClick={handleProceed} className="btn-yellow w-full py-3.5 text-base">
              Proceed to Checkout <ArrowRight className="h-5 w-5" aria-hidden />
            </button>

            {!isAuthenticated && (
              <p className="text-center text-xs text-eneba-muted">
                You’ll be asked to sign in or create an account before completing payment.
              </p>
            )}

            <ul className="space-y-2 border-t border-white/10 pt-4 text-xs font-semibold text-eneba-muted">
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 shrink-0 text-eneba-yellow" aria-hidden />
                Instant digital key reveal upon checkout
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-eneba-teal" aria-hidden />
                Atomic key reservation prevents double-selling
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
