import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { fetchProducts, errorMessage } from '../api/client';
import type { ProductListResponse, SortOption } from '../types/api';
import { useDocumentTitle } from '../utils/hooks';
import { formatPrice } from '../utils/format';
import { ErrorState } from '../components/ErrorState';
import { ProductCard, ProductCardSkeleton } from '../components/ProductCard';
import {
  FilterSidebar,
  STORE_PLATFORMS,
  STORE_REGIONS,
  parseMultiParam,
  serializeMultiParam,
  toggleMultiSelect,
  type FilterPatch,
  type StoreFilters,
} from '../components/store/FilterSidebar';

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest' },
];

function intParam(sp: URLSearchParams, name: string): number | undefined {
  const raw = sp.get(name);
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function parseSort(raw: string | null): SortOption {
  return SORT_OPTIONS.some((o) => o.value === raw) ? (raw as SortOption) : 'popular';
}

type LoadState = { status: 'loading' | 'ready' | 'error'; data?: ProductListResponse; error?: string };

export default function StorePage() {
  const [sp, setSp] = useSearchParams();

  const filters = useMemo<StoreFilters>(
    () => ({
      q: sp.get('q')?.trim() ?? '',
      platforms: parseMultiParam(sp.getAll('platform'), STORE_PLATFORMS),
      regions: parseMultiParam(sp.getAll('region'), STORE_REGIONS),
      minPrice: intParam(sp, 'min_price'),
      maxPrice: intParam(sp, 'max_price'),
    }),
    [sp],
  );
  const sort = parseSort(sp.get('sort'));
  const page = Math.max(1, intParam(sp, 'page') ?? 1);

  useDocumentTitle(filters.q ? `“${filters.q}” – Store` : 'Store');

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const queryKey = sp.toString();

  useEffect(() => {
    const ctrl = new AbortController();
    setState((prev) => ({ status: 'loading', data: prev.data }));
    fetchProducts(
      {
        q: filters.q || undefined,
        platform: filters.platforms,
        region: filters.regions,
        min_price: filters.minPrice,
        max_price: filters.maxPrice,
        sort,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      },
      ctrl.signal,
    )
      .then((data) => setState({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((prev) => ({ status: 'error', data: prev.data, error: errorMessage(err) }));
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, attempt]);

  /** Update URL params; any change other than `page` resets to page 1. */
  const update = useCallback(
    (patch: Partial<Record<string, string | undefined>>) => {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined || value === '') next.delete(key);
          else next.set(key, value);
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      });
    },
    [setSp],
  );

  const onFilterChange = useCallback((patch: FilterPatch) => update(patch), [update]);

  const removePlatform = useCallback(
    (p: string) => {
      const next = toggleMultiSelect(filters.platforms, p, STORE_PLATFORMS);
      update({ platform: serializeMultiParam(next) });
    },
    [filters.platforms, update],
  );

  const removeRegion = useCallback(
    (r: string) => {
      const next = toggleMultiSelect(filters.regions, r, STORE_REGIONS);
      update({ region: serializeMultiParam(next) });
    },
    [filters.regions, update],
  );

  const clearFilters = useCallback(() => {
    setSp((prev) => {
      const next = new URLSearchParams();
      const q = prev.get('q');
      if (q) next.set('q', q);
      const s = prev.get('sort');
      if (s) next.set('sort', s);
      return next;
    });
  }, [setSp]);

  const activeCount =
    filters.platforms.length +
    filters.regions.length +
    (filters.minPrice !== undefined ? 1 : 0) +
    (filters.maxPrice !== undefined ? 1 : 0);

  const products = state.data?.products ?? [];
  const total = state.data?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const loading = state.status === 'loading';

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black md:text-3xl">{filters.q ? 'Search results' : 'Store'}</h1>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className="btn-outline ml-auto px-3 py-1.5 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={filtersOpen ? 'block' : 'hidden lg:block'}>
          <div className="lg:sticky lg:top-28">
            <FilterSidebar
              filters={filters}
              activeCount={activeCount}
              onChange={onFilterChange}
              onClear={clearFilters}
              onClose={() => setFiltersOpen(false)}
            />
          </div>
        </div>

        <section aria-live="polite">
          {/* Sort & result bar */}
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-eneba-card px-4 py-3 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-extrabold">
                {loading && !state.data ? 'Loading…' : `${total} result${total === 1 ? '' : 's'}`}
              </span>
              {filters.q && (
                <span className="inline-flex items-center gap-1 rounded-full bg-eneba-yellow py-1 pl-3 pr-1.5 text-xs font-extrabold text-eneba-ink">
                  “{filters.q}”
                  <button type="button" aria-label="Remove search query" onClick={() => update({ q: undefined })} className="rounded-full p-0.5 hover:bg-black/10">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
              {filters.platforms.map((p) => (
                <FilterChip key={`platform-${p}`} label={p} onRemove={() => removePlatform(p)} />
              ))}
              {filters.regions.map((r) => (
                <FilterChip key={`region-${r}`} label={r} onRemove={() => removeRegion(r)} />
              ))}
              {filters.minPrice !== undefined && (
                <FilterChip label={`≥ ${formatPrice(filters.minPrice)}`} onRemove={() => update({ min_price: undefined })} />
              )}
              {filters.maxPrice !== undefined && (
                <FilterChip label={`≤ ${formatPrice(filters.maxPrice)}`} onRemove={() => update({ max_price: undefined })} />
              )}
            </div>

            <label className="ml-auto flex items-center gap-2 text-sm">
              <span className="font-semibold text-eneba-muted">Sort by</span>
              <select
                value={sort}
                onChange={(e) => update({ sort: e.target.value === 'popular' ? undefined : e.target.value })}
                className="rounded-lg bg-eneba-canvas py-2 pl-3 pr-8 text-sm font-bold text-white ring-1 ring-inset ring-white/15 focus:outline-none focus:ring-2 focus:ring-eneba-yellow"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {state.status === 'error' && !state.data && (
            <ErrorState message={state.error ?? 'Failed to load products'} onRetry={() => setAttempt((n) => n + 1)} />
          )}

          {loading && !state.data && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          )}

          {state.data && products.length === 0 && state.status !== 'error' && (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-eneba-card px-6 py-16 text-center ring-1 ring-white/10">
              <SearchX className="h-12 w-12 text-eneba-muted" aria-hidden />
              <h2 className="text-xl font-black">No games found</h2>
              <p className="max-w-md text-sm text-eneba-muted">
                Try a different spelling, remove a filter, or browse everything in the store.
              </p>
              <button
                type="button"
                className="btn-yellow"
                onClick={() => setSp(new URLSearchParams())}
              >
                Reset search & filters
              </button>
            </div>
          )}

          {products.length > 0 && (
            <div className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

          {state.status === 'error' && state.data && (
            <div className="mt-4">
              <ErrorState message={state.error ?? 'Failed to refresh results'} onRetry={() => setAttempt((n) => n + 1)} />
            </div>
          )}

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                className="btn-outline px-3 py-2"
                disabled={page <= 1}
                onClick={() => update({ page: page - 1 <= 1 ? undefined : String(page - 1) })}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
              </button>
              <span className="text-sm font-bold text-eneba-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-outline px-3 py-2"
                disabled={page >= totalPages}
                onClick={() => update({ page: String(page + 1) })}
              >
                Next <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-eneba-canvas py-1 pl-3 pr-1.5 text-xs font-bold ring-1 ring-inset ring-white/15">
      {label}
      <button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove} className="rounded-full p-0.5 hover:bg-white/10">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
