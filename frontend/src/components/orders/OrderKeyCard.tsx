import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, Copy, Eye, EyeOff, Info, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import type { OrderItem } from '../../types/api';
import { formatPrice } from '../../utils/format';
import { PlatformBadge, PlatformIcon, RegionTag } from '../Badges';

const REDEMPTION_GUIDE: Record<string, string> = {
  Steam: 'Open Steam client → Games → Activate a Product on Steam… → Paste key.',
  PSN: 'Sign in on PlayStation Store → Profile → Redeem Codes → Enter 12-char voucher.',
  Xbox: 'Press Xbox button → Store → Redeem → Enter your digital key.',
  'Nintendo Switch': 'Open Nintendo eShop → Select Enter Code → Type activation key.',
};

const PLATFORM_CLIENT_LABEL: Record<string, { client: string; accent: string }> = {
  Steam: { client: 'Steam Client Product Activation', accent: 'from-sky-500/25 via-eneba-brand to-eneba-card' },
  PSN: { client: 'PlayStation Network Code Redemption', accent: 'from-blue-600/25 via-eneba-brand to-eneba-card' },
  Xbox: { client: 'Xbox Digital Store Redemption', accent: 'from-emerald-500/25 via-eneba-brand to-eneba-card' },
  'Nintendo Switch': { client: 'Nintendo eShop Code Entry', accent: 'from-rose-500/25 via-eneba-brand to-eneba-card' },
};

interface OrderKeyCardProps {
  item: OrderItem;
  /** Initial visibility of the license key (defaults to masked). */
  defaultRevealed?: boolean;
  /** Allows opening the test activation modal on mount (useful for tests). */
  defaultRedeemOpen?: boolean;
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export function OrderKeyCard({ item, defaultRevealed = false, defaultRedeemOpen = false }: OrderKeyCardProps) {
  const [revealed, setRevealed] = useState(defaultRevealed || defaultRedeemOpen);
  const [copied, setCopied] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(defaultRedeemOpen);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setRevealed(defaultRevealed || defaultRedeemOpen);
  }, [defaultRevealed, defaultRedeemOpen]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!redeemOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRedeemOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redeemOpen]);

  useEffect(() => {
    if (!verifying) return;
    const id = window.setTimeout(() => setVerifying(false), 450);
    return () => window.clearTimeout(id);
  }, [verifying]);

  const handleCopy = async () => {
    setRevealed(true);
    try {
      await copyText(item.license_key);
      setCopied(true);
    } catch {
      /* clipboard permission denied — key is revealed for manual copy */
    }
  };

  const handleOpenRedeem = () => {
    setRevealed(true);
    setRedeemOpen(true);
  };

  const maskedKey = '••••-••••-••••';
  const guide = REDEMPTION_GUIDE[item.platform] ?? `Redeem this key on your ${item.platform} account.`;
  const clientTheme = PLATFORM_CLIENT_LABEL[item.platform] ?? {
    client: `${item.platform} Key Activation`,
    accent: 'from-eneba-brand via-eneba-card to-eneba-canvasLight',
  };

  return (
    <>
      <article className="rounded-2xl bg-eneba-card p-5 shadow-card ring-1 ring-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={item.platform} />
              <RegionTag region={item.region} />
              <span className="inline-flex items-center gap-1 rounded-md bg-[#00D1B2]/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[#00D1B2] ring-1 ring-inset ring-[#00D1B2]/40">
                <KeyRound className="h-3 w-3" aria-hidden />
                Digital Key
              </span>
            </div>
            <Link
              to={`/product/${item.product_slug}`}
              className="block text-lg font-extrabold text-white hover:text-eneba-yellow"
            >
              {item.product_title}
            </Link>
            <p className="text-xs text-eneba-muted">
              Seller: <span className="font-bold text-white">{item.seller_name}</span>
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold uppercase text-eneba-muted">Paid</div>
            <div className="text-lg font-black text-white">{formatPrice(item.unit_price_cents)}</div>
          </div>
        </div>

        {/* License key reveal & copy bar */}
        <div className="mt-4 flex flex-col gap-3 rounded-xl bg-eneba-canvas/90 p-3.5 ring-1 ring-[#00D1B2]/35 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#00D1B2]">
              Activation Key
            </span>
            <code
              data-testid={`license-key-${item.id}`}
              className={`mt-0.5 block select-all font-mono text-base font-black tracking-widest sm:text-lg ${
                revealed ? 'text-white' : 'select-none text-eneba-muted blur-[3px]'
              }`}
            >
              {revealed ? item.license_key : maskedKey}
            </code>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-eneba-brand px-3.5 py-2 text-xs font-extrabold text-white ring-1 ring-white/15 transition hover:bg-eneba-cardHover"
            >
              {revealed ? (
                <>
                  <EyeOff className="h-4 w-4" aria-hidden /> Hide Key
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-eneba-yellow" aria-hidden /> Reveal Key
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-extrabold transition ${
                copied
                  ? 'bg-[#00D1B2] text-eneba-ink'
                  : 'bg-eneba-yellow text-eneba-ink hover:bg-eneba-yellowHover'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden /> Copy Key
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenRedeem}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#00D1B2]/15 px-3.5 py-2 text-xs font-extrabold text-[#00D1B2] ring-1 ring-inset ring-[#00D1B2]/45 transition hover:bg-[#00D1B2]/25"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Verify / Test Redeem
            </button>
          </div>
        </div>

        <p className="mt-3 flex items-start gap-2 text-xs text-eneba-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00D1B2]" aria-hidden />
          <span>{guide}</span>
        </p>
      </article>

      {redeemOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`redeem-title-${item.id}`}
        >
          <button
            type="button"
            aria-label="Close activation modal"
            onClick={() => setRedeemOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-eneba-card shadow-2xl ring-1 ring-white/15">
            <div className={`bg-gradient-to-r ${clientTheme.accent} flex items-center justify-between border-b border-white/10 px-6 py-4`}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/35 text-white ring-1 ring-white/15">
                  <PlatformIcon platform={item.platform} className="h-5 w-5" />
                </span>
                <div>
                  <span className="block text-[10px] font-extrabold uppercase tracking-widest text-eneba-yellow">
                    Simulated Platform Redemption
                  </span>
                  <h3 id={`redeem-title-${item.id}`} className="text-base font-black text-white">
                    {clientTheme.client}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRedeemOpen(false)}
                aria-label="Close modal"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformBadge platform={item.platform} />
                <RegionTag region={item.region} />
                <span className="text-xs font-semibold text-eneba-muted">Seller: {item.seller_name}</span>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-eneba-muted">Product to Activate</p>
                <p className="mt-0.5 text-lg font-black text-white">{item.product_title}</p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-eneba-muted">
                  Product Activation Code
                </span>
                <input
                  type="text"
                  readOnly
                  value={item.license_key}
                  aria-label="Activation code"
                  className="w-full rounded-xl bg-eneba-canvas px-4 py-3 font-mono text-lg font-black tracking-widest text-white ring-1 ring-[#00D1B2]/50 focus:outline-none focus:ring-2 focus:ring-eneba-yellow"
                />
              </label>

              {verifying ? (
                <div className="flex items-center gap-3 rounded-xl bg-eneba-canvas/70 p-4 text-sm font-bold text-white ring-1 ring-white/10">
                  <Loader2 className="h-5 w-5 animate-spin text-eneba-yellow" aria-hidden />
                  <span>Validating license signature with {item.platform} simulator…</span>
                </div>
              ) : (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-xl bg-[#00D1B2]/15 p-4 ring-1 ring-[#00D1B2]/45"
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00D1B2]" aria-hidden />
                  <div>
                    <p className="text-sm font-black text-[#00D1B2]">Key Verified &amp; Activated on Account</p>
                    <p className="mt-0.5 text-xs text-white/80">
                      This license key is valid for {item.region} region activation on {item.platform}.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVerifying(true)}
                  disabled={verifying}
                  className="btn-outline px-4 py-2 text-xs"
                >
                  Re-verify Activation
                </button>
                <button type="button" onClick={() => setRedeemOpen(false)} className="btn-yellow px-5 py-2 text-xs">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
