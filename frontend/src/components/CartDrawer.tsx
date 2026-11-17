import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import { PlatformBadge, RegionTag } from './Badges';
import { CoverImage } from './CoverImage';

interface CartDrawerProps {
  /** Allows deterministic SSR rendering in automated tests. */
  forceOpen?: boolean;
}

export function CartDrawer({ forceOpen }: CartDrawerProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const {
    items,
    itemCount,
    totalCents,
    isDrawerOpen,
    lastAddedItem,
    closeDrawer,
    setQuantity,
    removeItem,
  } = useCart();

  const open = forceOpen ?? isDrawerOpen;

  // Close drawer on Escape key
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeDrawer]);

  // Close drawer when navigating between routes
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  if (!open) return null;

  const totalOriginalCents = items.reduce(
    (sum, item) => sum + Math.max(item.originalPriceCents, item.unitPriceCents) * item.quantity,
    0,
  );
  const totalSavingsCents = Math.max(0, totalOriginalCents - totalCents);

  const handleCheckout = () => {
    closeDrawer();
    navigate(isAuthenticated ? '/checkout' : '/login?redirect=/checkout');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Quick cart">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close cart drawer"
        onClick={closeDrawer}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-over panel */}
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-eneba-canvasLight shadow-2xl ring-1 ring-white/15">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-eneba-brand px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="h-5 w-5 text-eneba-yellow" aria-hidden />
            <h2 className="text-lg font-black text-white">
              Your Cart <span className="text-sm font-bold text-eneba-muted">({itemCount})</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="rounded-none p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Added confirmation banner */}
        {lastAddedItem && items.some((i) => i.sellerOfferId === lastAddedItem.sellerOfferId) && (
          <div className="flex items-center gap-2.5 border-b border-eneba-teal/25 bg-eneba-teal/15 px-5 py-3 text-xs font-bold text-eneba-teal">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">
              Added <span className="text-white">{lastAddedItem.title}</span> to your cart
            </span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-eneba-muted/70" aria-hidden />
              <p className="text-lg font-extrabold text-white">Your cart is empty</p>
              <p className="max-w-xs text-xs text-eneba-muted">
                Browse our catalog to add digital game keys from verified sellers.
              </p>
              <Link to="/store" onClick={closeDrawer} className="btn-yellow mt-2">
                Browse Store
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const atLimit = item.quantity >= item.maxQuantity;
                const lineTotal = item.unitPriceCents * item.quantity;

                return (
                  <li
                    key={item.sellerOfferId}
                    className="flex gap-3 rounded-none bg-eneba-card p-3.5 ring-1 ring-white/10"
                  >
                    <Link
                      to={`/product/${item.slug}`}
                      onClick={closeDrawer}
                      className="h-20 w-14 shrink-0 overflow-hidden rounded-none bg-eneba-canvas ring-1 ring-white/10"
                    >
                      <CoverImage src={item.coverImageUrl} alt={item.title} className="h-full w-full" />
                    </Link>

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/product/${item.slug}`}
                          onClick={closeDrawer}
                          className="line-clamp-1 text-sm font-extrabold text-white hover:text-eneba-yellow"
                        >
                          {item.title}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeItem(item.sellerOfferId)}
                          aria-label={`Remove ${item.title}`}
                          className="rounded-none p-1 text-eneba-muted transition hover:bg-eneba-magenta/15 hover:text-eneba-magenta"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <PlatformBadge platform={item.platform} />
                        <RegionTag region={item.region} />
                      </div>

                      <p className="text-[11px] text-eneba-muted">
                        Seller: <span className="font-semibold text-white">{item.sellerName}</span>
                      </p>

                      <div className="mt-auto flex items-center justify-between pt-1">
                        <div className="inline-flex items-center rounded-none bg-eneba-canvas/80 p-0.5 ring-1 ring-white/10">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${item.title}`}
                            disabled={item.quantity <= 1}
                            onClick={() => setQuantity(item.sellerOfferId, item.quantity - 1)}
                            className="rounded-none p-1 text-white hover:bg-white/10 disabled:opacity-40"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span className="min-w-[1.75rem] text-center text-xs font-extrabold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${item.title}`}
                            disabled={atLimit}
                            onClick={() => setQuantity(item.sellerOfferId, item.quantity + 1)}
                            className="rounded-none p-1 text-white hover:bg-white/10 disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>

                        <div className="text-right">
                          {item.originalPriceCents > item.unitPriceCents && (
                            <div className="text-[10px] text-eneba-muted line-through">
                              {formatPrice(item.originalPriceCents * item.quantity)}
                            </div>
                          )}
                          <div className="text-sm font-black text-white">{formatPrice(lineTotal)}</div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="space-y-3 border-t border-white/10 bg-eneba-card px-5 py-4">
            <dl className="space-y-1.5 text-sm">
              {totalSavingsCents > 0 && (
                <div className="flex justify-between text-xs">
                  <dt className="text-eneba-muted">Total savings</dt>
                  <dd className="font-bold text-eneba-teal">-{formatPrice(totalSavingsCents)}</dd>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <dt className="text-eneba-muted">Service fee</dt>
                <dd className="font-bold text-eneba-teal">€0.00</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <dt className="font-extrabold text-white">Subtotal</dt>
                <dd className="text-2xl font-black text-eneba-yellow">{formatPrice(totalCents)}</dd>
              </div>
            </dl>

            <button type="button" onClick={handleCheckout} className="btn-yellow w-full py-3 text-base">
              Proceed to Checkout <ArrowRight className="h-4 w-4" aria-hidden />
            </button>

            <Link
              to="/cart"
              onClick={closeDrawer}
              className="block rounded-none py-2 text-center text-xs font-extrabold text-eneba-yellow hover:bg-white/5 hover:underline"
            >
              View Full Cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
