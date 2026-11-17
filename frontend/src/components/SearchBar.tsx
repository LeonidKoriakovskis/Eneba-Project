import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '../api/client';
import type { ProductSummary } from '../types/api';
import { useDebouncedValue } from '../lib/hooks';
import { formatPrice } from '../lib/format';
import { CoverImage } from './CoverImage';
import { PlatformBadge, RegionTag } from './Badges';

const MIN_CHARS = 2;
const MAX_SUGGESTIONS = 6;

export function SearchBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(-1);

  const term = value.trim();
  const debounced = useDebouncedValue(term, 250);
  const pending = term !== debounced;
  const showPanel = open && term.length >= MIN_CHARS;

  // Mirror the ?q= param on /store; clear the box everywhere else.
  useEffect(() => {
    setValue(location.pathname === '/store' ? (new URLSearchParams(location.search).get('q') ?? '') : '');
    setOpen(false);
  }, [location.pathname, location.search]);

  // Live typo-tolerant suggestions from the backend (pg_trgm).
  useEffect(() => {
    if (!open || debounced.length < MIN_CHARS) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    api
      .listProducts({ q: debounced, limit: MAX_SUGGESTIONS }, ctrl.signal)
      .then((res) => {
        setResults(res.products ?? []);
        setTotal(res.total_count);
        setActive(-1);
        setLoading(false);
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setResults([]);
        setTotal(0);
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [debounced, open]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const picked = active >= 0 ? results[active] : undefined;
    if (picked) {
      navigate(`/product/${picked.slug}`);
    } else {
      navigate(term ? `/store?q=${encodeURIComponent(term)}` : '/store');
    }
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <form onSubmit={onSubmit} role="search" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-eneba-muted" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search games, keys, platforms..."
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          aria-label="Search games"
          className="h-11 w-full rounded-lg bg-eneba-canvas/80 pl-11 pr-20 text-sm font-medium text-white placeholder-eneba-muted ring-1 ring-white/10 transition focus:bg-eneba-canvas focus:outline-none focus:ring-2 focus:ring-eneba-yellow"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {(loading || pending) && showPanel && <Loader2 className="h-4 w-4 animate-spin text-eneba-muted" aria-hidden />}
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setValue('');
                inputRef.current?.focus();
              }}
              className="rounded p-1 text-eneba-muted hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button type="submit" aria-label="Search" className="rounded-md bg-eneba-yellow p-1.5 text-eneba-ink hover:bg-eneba-yellowHover">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </form>

      {showPanel && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl bg-eneba-card shadow-2xl ring-1 ring-white/10"
        >
          {results.map((p, i) => (
            <Link
              key={p.id}
              to={`/product/${p.slug}`}
              role="option"
              aria-selected={i === active}
              onClick={close}
              onMouseEnter={() => setActive(i)}
              className={`flex items-center gap-3 px-3 py-2.5 transition ${i === active ? 'bg-eneba-cardHover' : ''}`}
            >
              <CoverImage src={p.cover_image_url} alt={p.title} className="h-14 w-11 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{p.title}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <PlatformBadge platform={p.platform} />
                  <RegionTag region={p.region} />
                </div>
              </div>
              <div className="shrink-0 text-right text-sm font-black text-white">
                {p.total_stock_count > 0 ? formatPrice(p.lowest_price_cents) : <span className="text-xs text-eneba-muted">Sold out</span>}
              </div>
            </Link>
          ))}

          {results.length === 0 && !loading && !pending && (
            <div className="px-4 py-5 text-center text-sm text-eneba-muted">No games found for “{debounced}”.</div>
          )}
          {results.length === 0 && (loading || pending) && (
            <div className="px-4 py-5 text-center text-sm text-eneba-muted">Searching…</div>
          )}

          {results.length > 0 && (
            <Link
              to={`/store?q=${encodeURIComponent(debounced)}`}
              onClick={close}
              className="block border-t border-white/10 bg-black/20 px-4 py-2.5 text-center text-sm font-bold text-eneba-yellow hover:bg-black/30"
            >
              See all {total} result{total === 1 ? '' : 's'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
