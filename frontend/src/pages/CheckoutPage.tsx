import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  FlaskConical,
  Loader2,
  Lock,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { api, ApiError, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';
import { useDocumentTitle } from '../utils/hooks';
import { PlatformBadge, RegionTag } from '../components/Badges';

export const PENDING_STRIPE_ITEMS_KEY = 'eneba.pendingStripeItems';

type PaymentOptionId = 'stripe' | 'card' | 'paypal' | 'wallet';

interface ConflictInfo {
  message: string;
  sellerOfferId?: string;
  available?: number;
  requested?: number;
}

const SIMULATED_OPTIONS: {
  id: Exclude<PaymentOptionId, 'stripe'>;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'card',
    title: 'Credit / Debit Card (Test Mode)',
    subtitle: 'Instant simulated card authorization — Visa •••• 4242',
  },
  {
    id: 'paypal',
    title: 'PayPal (Sandbox)',
    subtitle: 'Simulated express approval via PayPal Sandbox',
  },
  {
    id: 'wallet',
    title: 'Eneba Wallet Demo',
    subtitle: 'Available demo balance: €250.00',
  },
];

interface CheckoutPageProps {
  /** Allows deterministic SSR rendering of Stripe mode in tests. */
  defaultStripeEnabled?: boolean;
}

export default function CheckoutPage({ defaultStripeEnabled = false }: CheckoutPageProps) {
  useDocumentTitle('Checkout');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, token, isAuthenticated } = useAuth();
  const { items, itemCount, totalCents, setQuantity, removeItem, clear } = useCart();

  const [stripeEnabled, setStripeEnabled] = useState(defaultStripeEnabled);
  const [paymentMethod, setPaymentMethod] = useState<PaymentOptionId>(defaultStripeEnabled ? 'stripe' : 'card');
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCard, setCopiedCard] = useState(false);

  const canceled = searchParams.get('canceled') === '1';

  useEffect(() => {
    const ctrl = new AbortController();
    api
      .getPaymentConfig(ctrl.signal)
      .then((cfg) => {
        if (cfg.stripe_enabled) {
          setStripeEnabled(true);
          setPaymentMethod((prev) => (prev === 'card' ? 'stripe' : prev));
        }
      })
      .catch(() => {
        /* fallback silently to built-in simulated checkout */
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!copiedCard) return;
    const id = window.setTimeout(() => setCopiedCard(false), 1800);
    return () => window.clearTimeout(id);
  }, [copiedCard]);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login?redirect=/checkout" replace />;
  }

  if (completed) {
    return null;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-none bg-eneba-card px-6 py-16 text-center shadow-card ring-1 ring-white/10">
        <ShoppingCart className="h-12 w-12 text-eneba-muted" aria-hidden />
        <h1 className="text-2xl font-black">Nothing to check out</h1>
        <p className="text-sm text-eneba-muted">Add at least one game offer to your cart before proceeding to payment.</p>
        <Link to="/store" className="btn-yellow">
          Browse Store
        </Link>
      </div>
    );
  }

  const handleCopyTestCard = async () => {
    try {
      await navigator.clipboard.writeText('4242424242424242');
      setCopiedCard(true);
    } catch {
      setCopiedCard(false);
    }
  };

  const handleCheckoutConflict = (err: unknown) => {
    if (err instanceof ApiError && err.status === 409) {
      const body = (typeof err.body === 'object' && err.body !== null ? err.body : {}) as Record<string, unknown>;
      const offerId = typeof body.seller_offer_id === 'string' ? body.seller_offer_id : undefined;
      const available = typeof body.available === 'number' ? body.available : undefined;
      const requested = typeof body.requested === 'number' ? body.requested : undefined;
      const matched = offerId ? items.find((i) => i.sellerOfferId === offerId) : undefined;

      const message = matched
        ? available && available > 0
          ? `Only ${available} key${available === 1 ? '' : 's'} remaining for "${matched.title}" from ${matched.sellerName} (you requested ${requested ?? matched.quantity}).`
          : `"${matched.title}" from ${matched.sellerName} just sold out.`
        : err.message;

      setConflict({ message, sellerOfferId: offerId, available, requested });
      return;
    }
    setError(errorMessage(err));
  };

  const handlePay = async () => {
    setSubmitting(true);
    setError(null);
    setConflict(null);

    const requestItems = items.map((item) => ({
      seller_offer_id: item.sellerOfferId,
      quantity: item.quantity,
    }));

    try {
      if (paymentMethod === 'stripe' && stripeEnabled) {
        try {
          sessionStorage.setItem(PENDING_STRIPE_ITEMS_KEY, JSON.stringify(requestItems));
        } catch {
          /* ignore storage failures */
        }
        const session = await api.createStripeSession(requestItems, token);
        window.location.assign(session.url);
        return;
      }

      const order = await api.checkout(
        {
          items: requestItems,
          payment_method: 'card_sim',
        },
        token,
      );

      try {
        sessionStorage.setItem(`eneba.lastOrder.${order.id}`, JSON.stringify(order));
      } catch {
        /* ignore storage failures */
      }

      setCompleted(true);
      clear();
      navigate(`/orders/${order.id}`, {
        replace: true,
        state: { order, justPurchased: true },
      });
    } catch (err) {
      handleCheckoutConflict(err);
    } finally {
      setSubmitting(false);
    }
  };

  const usingStripe = stripeEnabled && paymentMethod === 'stripe';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/cart"
            className="inline-flex items-center gap-1.5 rounded-none bg-eneba-card px-3 py-2 text-xs font-bold text-eneba-muted ring-1 ring-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Cart
          </Link>
          <h1 className="text-2xl font-black md:text-3xl">Checkout</h1>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-none bg-[#00D1B2]/15 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-[#00D1B2] ring-1 ring-inset ring-[#00D1B2]/40">
          <FlaskConical className="h-4 w-4" aria-hidden />
          {stripeEnabled ? 'Stripe Test Mode Enabled' : 'Test Mode — No Real Money Charged'}
        </span>
      </div>

      {canceled && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-none bg-eneba-orange/15 p-4 text-sm font-semibold text-white ring-1 ring-eneba-orange/70"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-eneba-orange" aria-hidden />
          <span>Stripe checkout was canceled. Your cart items are still saved — ready whenever you want to try again.</span>
        </div>
      )}

      {conflict && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-none bg-eneba-orange/15 p-5 ring-1 ring-eneba-orange sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-eneba-orange" aria-hidden />
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-eneba-orange">Stock Changed During Checkout</h2>
              <p className="mt-1 text-sm font-medium text-white">{conflict.message}</p>
            </div>
          </div>

          {conflict.sellerOfferId && (
            <div className="flex shrink-0 gap-2">
              {conflict.available !== undefined && conflict.available > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuantity(conflict.sellerOfferId!, conflict.available!);
                    setConflict(null);
                  }}
                  className="btn-yellow px-4 py-2 text-xs"
                >
                  Adjust to {conflict.available}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    removeItem(conflict.sellerOfferId!);
                    setConflict(null);
                  }}
                  className="btn-yellow px-4 py-2 text-xs"
                >
                  Remove Item
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-none bg-eneba-magenta/15 p-4 text-sm font-semibold text-white ring-1 ring-eneba-magenta/60"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-eneba-magenta" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Left column: Buyer + Payment Options */}
        <div className="space-y-6">
          <section className="rounded-none bg-eneba-card p-5 shadow-card ring-1 ring-white/10 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-eneba-muted">Buyer Account</h2>
                <p className="mt-1 text-base font-extrabold text-white">{user?.full_name}</p>
                <p className="text-sm text-eneba-muted">{user?.email}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-none bg-[#00D1B2]/15 px-3 py-1.5 text-xs font-bold text-[#00D1B2]">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Keys delivered to your account immediately
              </span>
            </div>
          </section>

          <section aria-labelledby="payment-heading" className="rounded-none bg-eneba-card p-5 shadow-card ring-1 ring-white/10 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="payment-heading" className="text-xl font-black">
                Payment Method
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-eneba-muted">
                <Lock className="h-3.5 w-3.5 text-[#00D1B2]" aria-hidden />
                {stripeEnabled ? 'Stripe Test Mode & Local Sandbox' : 'Simulated Secure Payment'}
              </span>
            </div>

            <div className="space-y-3" role="radiogroup" aria-label="Payment Method">
              {stripeEnabled && (
                <label
                  className={`flex cursor-pointer items-start gap-3.5 rounded-none p-4 ring-1 transition ${
                    paymentMethod === 'stripe'
                      ? 'bg-eneba-brand/50 ring-2 ring-eneba-yellow'
                      : 'bg-eneba-canvas/50 ring-white/10 hover:bg-eneba-canvas/80'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="stripe"
                    checked={paymentMethod === 'stripe'}
                    onChange={() => setPaymentMethod('stripe')}
                    className="mt-1 h-4 w-4 accent-[#FFDC00]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CreditCard className="h-4 w-4 text-eneba-yellow" aria-hidden />
                      <span className="font-extrabold text-white">Stripe Checkout (Test Mode)</span>
                      <span className="bg-eneba-teal/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-eneba-teal">
                        Hosted Checkout
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-eneba-muted">
                      Redirects cleanly to Stripe&apos;s hosted payment page using server-verified EUR pricing.
                    </p>
                  </div>
                </label>
              )}

              {SIMULATED_OPTIONS.map((option) => {
                const selected = paymentMethod === option.id;
                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3.5 rounded-none p-4 ring-1 transition ${
                      selected
                        ? 'bg-eneba-brand/50 ring-2 ring-eneba-yellow'
                        : 'bg-eneba-canvas/50 ring-white/10 hover:bg-eneba-canvas/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={option.id}
                      checked={selected}
                      onChange={() => setPaymentMethod(option.id)}
                      className="mt-1 h-4 w-4 accent-[#FFDC00]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {option.id === 'card' && <CreditCard className="h-4 w-4 text-eneba-yellow" aria-hidden />}
                        {option.id === 'paypal' && <ShieldCheck className="h-4 w-4 text-sky-400" aria-hidden />}
                        {option.id === 'wallet' && <Wallet className="h-4 w-4 text-[#00D1B2]" aria-hidden />}
                        <span className="font-extrabold text-white">{option.title}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-eneba-muted">{option.subtitle}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {usingStripe && (
              <div className="mt-4 rounded-none bg-gradient-to-br from-eneba-canvas to-eneba-brand/60 p-4 ring-1 ring-eneba-teal/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-eneba-teal">
                    Stripe Test Card Details
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyTestCard}
                    className="inline-flex items-center gap-1.5 bg-eneba-yellow px-2.5 py-1 text-[11px] font-black text-eneba-ink transition hover:bg-eneba-yellowHover"
                  >
                    {copiedCard ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden /> Copy Test Card
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-2 font-mono text-lg font-black tracking-widest text-white">
                  4242 4242 4242 4242
                </div>
                <p className="mt-1 text-xs text-eneba-muted">
                  Use any future expiry (e.g. <span className="font-bold text-white">12/28</span>) and any 3-digit CVC (e.g.{' '}
                  <span className="font-bold text-white">424</span>) on the hosted Stripe page.
                </p>
              </div>
            )}

            {/* Simulated payment previews */}
            {paymentMethod === 'card' && (
              <div className="mt-4 rounded-none bg-gradient-to-br from-eneba-canvas to-eneba-brand/60 p-4 ring-1 ring-white/15">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-eneba-muted">
                  <span>Sandbox Visa Card</span>
                  <span className="text-[#00D1B2]">TEST MODE</span>
                </div>
                <div className="mt-3 font-mono text-lg font-black tracking-widest text-white">
                  •••• •••• •••• 4242
                </div>
                <div className="mt-3 flex gap-6 text-xs text-eneba-muted">
                  <div>
                    <span className="block text-[10px] uppercase">Cardholder</span>
                    <span className="font-bold text-white">{user?.full_name.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">Expires</span>
                    <span className="font-bold text-white">12/28</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase">CVC</span>
                    <span className="font-bold text-white">•••</span>
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'paypal' && (
              <div className="mt-4 rounded-none bg-eneba-canvas/70 p-4 text-sm ring-1 ring-white/15">
                <p className="font-bold text-white">PayPal Sandbox Account</p>
                <p className="mt-1 text-xs text-eneba-muted">
                  Authorized as <span className="font-semibold text-white">buyer-sandbox@eneba-demo.com</span>. No real funds will leave your account.
                </p>
              </div>
            )}

            {paymentMethod === 'wallet' && (
              <div className="mt-4 flex items-center justify-between rounded-none bg-eneba-canvas/70 p-4 text-sm ring-1 ring-white/15">
                <div>
                  <p className="font-bold text-white">Eneba Demo Wallet</p>
                  <p className="mt-0.5 text-xs text-eneba-muted">Instant simulated wallet deduction</p>
                </div>
                <span className="text-lg font-black text-[#00D1B2]">€250.00</span>
              </div>
            )}
          </section>
        </div>

        {/* Right column: Order Summary & Pay CTA */}
        <aside aria-label="Checkout summary" className="lg:sticky lg:top-28 lg:self-start">
          <div className="space-y-5 rounded-none bg-eneba-card p-6 shadow-card ring-1 ring-white/10">
            <h2 className="text-xl font-black">Order Summary</h2>

            <ul className="divide-y divide-white/10">
              {items.map((item) => (
                <li key={item.sellerOfferId} className="flex items-start justify-between gap-3 py-3 first:pt-0">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-extrabold text-white">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <PlatformBadge platform={item.platform} />
                      <RegionTag region={item.region} />
                    </div>
                    <p className="mt-1 text-xs text-eneba-muted">
                      {item.sellerName} · Qty {item.quantity}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-sm font-black text-white">
                    {formatPrice(item.unitPriceCents * item.quantity)}
                  </div>
                </li>
              ))}
            </ul>

            <dl className="space-y-2.5 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-eneba-muted">Items ({itemCount})</dt>
                <dd className="font-bold text-white">{formatPrice(totalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-eneba-muted">Service fee</dt>
                <dd className="font-bold text-[#00D1B2]">€0.00</dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/10 pt-3">
                <dt className="text-base font-extrabold text-white">Total to pay</dt>
                <dd className="text-2xl font-black text-eneba-yellow">{formatPrice(totalCents)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handlePay}
              disabled={submitting}
              className="btn-yellow w-full py-3.5 text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  {usingStripe ? 'Redirecting to Stripe…' : 'Processing Payment & Locking Keys…'}
                </>
              ) : usingStripe ? (
                <>
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Continue to Stripe ({formatPrice(totalCents)})
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" aria-hidden />
                  Pay {formatPrice(totalCents)} &amp; Reveal Keys
                </>
              )}
            </button>

            <p className="text-center text-[11px] text-eneba-muted">
              {usingStripe
                ? 'Stripe Test Mode verifies payment before reserving your digital keys atomically.'
                : 'Simulated checkout reserves unique keys atomically via PostgreSQL transaction locking.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
