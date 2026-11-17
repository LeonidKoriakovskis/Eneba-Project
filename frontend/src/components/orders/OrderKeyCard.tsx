import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Eye, EyeOff, Info, KeyRound } from 'lucide-react';
import type { OrderItem } from '../../types/api';
import { formatPrice } from '../../utils/format';
import { PlatformBadge, RegionTag } from '../Badges';

const REDEMPTION_GUIDE: Record<string, string> = {
  Steam: 'Open Steam client → Games → Activate a Product on Steam… → Paste key.',
  PSN: 'Sign in on PlayStation Store → Profile → Redeem Codes → Enter 12-char voucher.',
  Xbox: 'Press Xbox button → Store → Redeem → Enter your digital key.',
  'Nintendo Switch': 'Open Nintendo eShop → Select Enter Code → Type activation key.',
};

interface OrderKeyCardProps {
  item: OrderItem;
  /** Initial visibility of the license key (defaults to masked). */
  defaultRevealed?: boolean;
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

export function OrderKeyCard({ item, defaultRevealed = false }: OrderKeyCardProps) {
  const [revealed, setRevealed] = useState(defaultRevealed);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setRevealed(defaultRevealed);
  }, [defaultRevealed]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const handleCopy = async () => {
    setRevealed(true);
    try {
      await copyText(item.license_key);
      setCopied(true);
    } catch {
      /* clipboard permission denied — key is revealed for manual copy */
    }
  };

  const maskedKey = '••••-••••-••••';
  const guide = REDEMPTION_GUIDE[item.platform] ?? `Redeem this key on your ${item.platform} account.`;

  return (
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
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-eneba-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00D1B2]" aria-hidden />
        <span>{guide}</span>
      </p>
    </article>
  );
}
