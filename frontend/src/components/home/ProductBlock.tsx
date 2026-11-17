import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { HomepageBlock } from '../../types/api';
import { readNumber, readString } from '../../lib/blocks';
import { ProductCard } from '../ProductCard';

/** Countdown anchored per-session so it doesn't reset on every navigation. */
function useCountdown(hours: number | undefined): number | null {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!hours || hours <= 0) {
      setRemaining(null);
      return;
    }
    const key = `eneba.countdown.${hours}`;
    const read = (): number => {
      let end = Number(sessionStorage.getItem(key));
      if (!Number.isFinite(end) || end <= Date.now()) {
        end = Date.now() + hours * 3600_000;
        sessionStorage.setItem(key, String(end));
      }
      return end;
    };
    const end = read();
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hours]);

  return remaining;
}

function Countdown({ ms }: { ms: number }) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-black/30 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-white">
      <Clock className="h-4 w-4 text-eneba-yellow" aria-hidden />
      {h}:{m}:{s}
    </span>
  );
}

/**
 * Generic product block. All presentation hints come from the block itself:
 *  - title            -> heading
 *  - config.layout    -> 'carousel' renders a horizontal scroller, anything else a grid
 *  - config.limit     -> max products shown
 *  - config.badge     -> highlighted pill next to the heading
 *  - config.countdown_end_hours -> live countdown
 */
export function ProductBlock({ block }: { block: HomepageBlock }) {
  const limit = readNumber(block.config, 'limit');
  const layout = readString(block.config, 'layout');
  const badge = readString(block.config, 'badge');
  const countdownHours = readNumber(block.config, 'countdown_end_hours');
  const remaining = useCountdown(countdownHours);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const all = block.products ?? [];
  const products = limit && limit > 0 ? all.slice(0, limit) : all;
  if (products.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section aria-labelledby={`block-${block.id}`}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id={`block-${block.id}`} className="text-xl font-black md:text-2xl">
          {block.title}
        </h2>
        {badge && (
          <span className="rounded-md bg-eneba-magenta px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-white">
            {badge}
          </span>
        )}
        {remaining !== null && <Countdown ms={remaining} />}

        <div className="ml-auto flex items-center gap-2">
          {layout === 'carousel' && (
            <div className="hidden gap-1 md:flex">
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollBy(-1)}
                className="rounded-full bg-eneba-card p-1.5 ring-1 ring-white/10 hover:bg-eneba-cardHover"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollBy(1)}
                className="rounded-full bg-eneba-card p-1.5 ring-1 ring-white/10 hover:bg-eneba-cardHover"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
          <Link to="/store" className="text-sm font-bold text-eneba-yellow hover:underline">
            See all
          </Link>
        </div>
      </div>

      {layout === 'carousel' ? (
        <div ref={scrollerRef} className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} className="w-44 shrink-0 snap-start sm:w-52" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}
