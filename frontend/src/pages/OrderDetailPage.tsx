import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Package, Sparkles } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import type { CheckoutItemRequest, Order } from '../types/api';
import { formatDateTime, formatPrice } from '../utils/format';
import { useDocumentTitle } from '../utils/hooks';
import { ErrorState } from '../components/ErrorState';
import { OrderKeyCard } from '../components/orders/OrderKeyCard';
import { PENDING_STRIPE_ITEMS_KEY } from './CheckoutPage';

interface LocationState {
  order?: Order;
  justPurchased?: boolean;
}

// Tracks in-flight Stripe session finalization across React StrictMode double mounts.
const inflightStripeCheckouts = new Map<string, Promise<Order>>();

function readCachedOrder(id: string | undefined): Order | null {
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(`eneba.lastOrder.${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Order;
  } catch {
    return null;
  }
}

function readCachedStripeOrder(sessionId: string | null): Order | null {
  if (!sessionId) return null;
  try {
    const raw = sessionStorage.getItem(`eneba.stripeOrder.${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw) as Order;
  } catch {
    return null;
  }
}

function readPendingStripeItems(): CheckoutItemRequest[] {
  try {
    const raw = sessionStorage.getItem(PENDING_STRIPE_ITEMS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CheckoutItemRequest =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CheckoutItemRequest).seller_offer_id === 'string' &&
        typeof (item as CheckoutItemRequest).quantity === 'number',
    );
  } catch {
    return [];
  }
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { token, isAuthenticated } = useAuth();
  const { items: cartItems, clear: clearCart } = useCart();

  const stripeSessionId = searchParams.get('session_id')?.trim() || null;

  const navState = (location.state ?? null) as LocationState | null;
  const initialOrder = navState?.order ?? readCachedOrder(id) ?? readCachedStripeOrder(stripeSessionId);
  const justPurchased = Boolean(navState?.justPurchased || stripeSessionId);

  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [revealAll, setRevealAll] = useState(Boolean(stripeSessionId));

  useDocumentTitle(order ? `Order #${order.id.slice(0, 8)}` : 'Order Confirmation');

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    // 1. Returning from Stripe Checkout (/checkout/success?session_id=...)
    if (stripeSessionId) {
      if (order) {
        setLoading(false);
        return;
      }

      let active = true;
      setLoading(true);
      setError(null);

      const pending = readPendingStripeItems();
      const checkoutItems: CheckoutItemRequest[] =
        pending.length > 0
          ? pending
          : cartItems.map((item) => ({
              seller_offer_id: item.sellerOfferId,
              quantity: item.quantity,
            }));

      let promise = inflightStripeCheckouts.get(stripeSessionId);
      if (!promise) {
        promise = api
          .checkout(
            {
              items: checkoutItems,
              payment_method: 'stripe_test',
              stripe_session_id: stripeSessionId,
            },
            token,
          )
          .finally(() => {
            inflightStripeCheckouts.delete(stripeSessionId);
          });
        inflightStripeCheckouts.set(stripeSessionId, promise);
      }

      promise
        .then((fulfilled) => {
          try {
            sessionStorage.setItem(`eneba.lastOrder.${fulfilled.id}`, JSON.stringify(fulfilled));
            sessionStorage.setItem(`eneba.stripeOrder.${stripeSessionId}`, JSON.stringify(fulfilled));
            sessionStorage.removeItem(PENDING_STRIPE_ITEMS_KEY);
          } catch {
            /* ignore storage failures */
          }
          clearCart();
          if (!active) return;
          setOrder(fulfilled);
          setRevealAll(true);
          setLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          setError(errorMessage(err));
          setLoading(false);
        });

      return () => {
        active = false;
      };
    }

    // 2. Standard order receipt view (/orders/:id)
    if (order && (!id || order.id === id)) {
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);

    api
      .listOrders(token, ctrl.signal)
      .then((res) => {
        const list = res.orders ?? [];
        const match = id ? list.find((o) => o.id === id) : list[0];
        if (!match) {
          setError('Order not found for this account.');
        } else {
          setOrder(match);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(errorMessage(err));
        setLoading(false);
      });

    return () => ctrl.abort();
  }, [id, stripeSessionId, isAuthenticated, token, order, attempt, cartItems, clearCart]);

  const retry = useCallback(() => {
    setOrder(null);
    setAttempt((n) => n + 1);
  }, []);

  if (!isAuthenticated || !token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={stripeSessionId ? 'Verifying Stripe payment & unlocking keys' : 'Loading order'}>
        <div className="h-32 animate-pulse rounded-none bg-eneba-card" />
        <div className="h-44 animate-pulse rounded-none bg-eneba-card" />
      </div>
    );
  }

  if (error || !order) {
    return <ErrorState message={error ?? 'Could not load order details.'} onRetry={retry} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 rounded-none bg-eneba-card px-3 py-2 text-xs font-bold text-eneba-muted ring-1 ring-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All Orders
        </Link>

        <Link to="/store" className="text-sm font-bold text-eneba-yellow hover:underline">
          Browse more games
        </Link>
      </div>

      {/* Confirmation Hero */}
      <section className="relative overflow-hidden rounded-none bg-gradient-to-br from-eneba-brand via-eneba-card to-eneba-canvasLight p-6 shadow-card ring-2 ring-[#00D1B2]/50 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-none bg-[#00D1B2]/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#00D1B2]">
              {justPurchased ? <Sparkles className="h-3.5 w-3.5" aria-hidden /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
              {order.status}
            </div>
            <h1 className="text-2xl font-black text-white sm:text-3xl">
              {justPurchased
                ? 'Payment Successful — Your Digital Keys Are Ready!'
                : 'Order Receipt & Digital Keys'}
            </h1>
            <p className="text-sm text-eneba-muted">
              Order <code className="font-mono font-bold text-white">#{order.id.slice(0, 8)}</code> · Placed{' '}
              {formatDateTime(order.created_at)}
            </p>
          </div>

          <div className="rounded-none bg-black/25 px-5 py-3.5 text-left ring-1 ring-white/10 sm:text-right">
            <span className="block text-xs font-bold uppercase tracking-wider text-eneba-muted">Total Paid</span>
            <span className="text-3xl font-black text-eneba-yellow">{formatPrice(order.total_cents)}</span>
          </div>
        </div>
      </section>

      {/* Keys Section */}
      <section aria-labelledby="keys-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#00D1B2]" aria-hidden />
            <h2 id="keys-heading" className="text-xl font-black">
              Your Digital Keys ({order.items.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setRevealAll((r) => !r)}
            className="btn-outline px-4 py-2 text-xs"
          >
            {revealAll ? (
              <>
                <EyeOff className="h-4 w-4" aria-hidden /> Hide All Keys
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" aria-hidden /> Reveal All Keys
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          {order.items.map((item) => (
            <OrderKeyCard key={item.id} item={item} defaultRevealed={revealAll} />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-none bg-eneba-card p-5 ring-1 ring-white/10">
        <div className="flex items-center gap-3 text-sm text-eneba-muted">
          <Package className="h-5 w-5 text-eneba-yellow" aria-hidden />
          <span>Your keys are saved permanently in your account under My Orders.</span>
        </div>
        <Link to="/orders" className="btn-yellow px-5 py-2.5">
          View Order History
        </Link>
      </div>
    </div>
  );
}
