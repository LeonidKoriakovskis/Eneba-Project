import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronRight, KeyRound, Package } from 'lucide-react';
import { api, errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Order } from '../types/api';
import { formatDateTime, formatPrice } from '../utils/format';
import { useDocumentTitle } from '../utils/hooks';
import { ErrorState } from '../components/ErrorState';
import { OrderKeyCard } from '../components/orders/OrderKeyCard';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; orders: Order[] };

export default function OrdersPage() {
  useDocumentTitle('My Orders');
  const { token, isAuthenticated } = useAuth();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isAuthenticated || !token) return;
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    api
      .listOrders(token, ctrl.signal)
      .then((res) => setState({ status: 'ready', orders: res.orders ?? [] }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', message: errorMessage(err) });
      });
    return () => ctrl.abort();
  }, [isAuthenticated, token, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login?redirect=/orders" replace />;
  }

  const toggleOrder = (orderId: string) => {
    setCollapsedIds((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-4xl space-y-4" aria-busy="true" aria-label="Loading orders">
        <div className="h-9 w-48 animate-pulse rounded-none bg-eneba-card" />
        <div className="h-48 animate-pulse rounded-none bg-eneba-card" />
        <div className="h-48 animate-pulse rounded-none bg-eneba-card" />
      </div>
    );
  }

  if (state.status === 'error') {
    return <ErrorState message={state.message} onRetry={retry} />;
  }

  const { orders } = state;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">My Orders</h1>
          <p className="text-sm text-eneba-muted">
            Retrieve and copy your purchased digital activation keys anytime.
          </p>
        </div>
        <Link to="/store" className="text-sm font-bold text-eneba-yellow hover:underline">
          Browse Store
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-none bg-eneba-card px-6 py-16 text-center shadow-card ring-1 ring-white/10">
          <div className="flex h-16 w-16 items-center justify-center rounded-none bg-eneba-brand/60 text-eneba-yellow ring-1 ring-white/10">
            <Package className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="text-xl font-black">No orders yet</h2>
          <p className="max-w-sm text-sm text-eneba-muted">
            Once you purchase a digital game key, your order receipt and activation key will appear right here.
          </p>
          <Link to="/store" className="btn-yellow mt-1">
            Explore Games <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const expanded = !collapsedIds[order.id];
            return (
              <section
                key={order.id}
                aria-label={`Order ${order.id.slice(0, 8)}`}
                className="overflow-hidden rounded-none bg-eneba-card shadow-card ring-1 ring-white/10"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-black/20 px-5 py-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-sm font-black text-white">
                        Order #{order.id.slice(0, 8)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-none bg-[#00D1B2]/15 px-2 py-0.5 text-[11px] font-extrabold uppercase text-[#00D1B2]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden />
                        {order.status}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-eneba-muted">
                        <KeyRound className="h-3.5 w-3.5 text-eneba-yellow" aria-hidden />
                        {order.items.length} key{order.items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-xs text-eneba-muted">{formatDateTime(order.created_at)}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-eneba-muted">Total</span>
                      <span className="text-lg font-black text-eneba-yellow">{formatPrice(order.total_cents)}</span>
                    </div>

                    <Link
                      to={`/orders/${order.id}`}
                      state={{ order }}
                      className="rounded-none bg-eneba-canvas/70 px-3 py-2 text-xs font-bold text-white ring-1 ring-white/10 hover:bg-eneba-canvas"
                    >
                      Receipt
                    </Link>

                    <button
                      type="button"
                      onClick={() => toggleOrder(order.id)}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse keys' : 'Expand keys'}
                      className="rounded-none bg-eneba-canvas/70 p-2 text-white ring-1 ring-white/10 hover:bg-eneba-canvas"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-3 p-4 sm:p-5">
                    {order.items.map((item) => (
                      <OrderKeyCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
