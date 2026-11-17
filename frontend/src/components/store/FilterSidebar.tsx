import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { centsToEuroInput, euroInputToCents } from '../../utils/format';
import { PlatformIcon } from '../PlatformBadge';

export interface StoreFilters {
  q: string;
  platforms: string[];
  regions: string[];
  minPrice: number | undefined; // cents
  maxPrice: number | undefined; // cents
}

export type FilterPatch = Partial<Record<'platform' | 'region' | 'min_price' | 'max_price', string | undefined>>;

export const STORE_PLATFORMS = ['Steam', 'PSN', 'Xbox', 'Nintendo'] as const;
export const STORE_REGIONS = ['GLOBAL', 'EUROPE', 'US'] as const;

/** Parses repeated/comma-separated URL param values into deduplicated canonical pills. */
export function parseMultiParam(values: string[], canonical: readonly string[]): string[] {
  const byLower = new Map(canonical.map((item) => [item.toLowerCase(), item]));
  const selected: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const mapped = byLower.get(trimmed.toLowerCase()) ?? trimmed;
      const key = mapped.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(mapped);
    }
  }
  return selected;
}

/** Toggles a value inside a multi-select group, ordering along canonical options; empty array = ALL. */
export function toggleMultiSelect(current: string[], value: string, canonical: readonly string[]): string[] {
  const targetKey = value.toLowerCase();
  const exists = current.some((item) => item.toLowerCase() === targetKey);
  const nextSet = new Set(current.map((item) => item.toLowerCase()));

  if (exists) {
    nextSet.delete(targetKey);
  } else {
    nextSet.add(targetKey);
  }

  return canonical.filter((item) => nextSet.has(item.toLowerCase()));
}

export function serializeMultiParam(values: string[]): string | undefined {
  return values.length > 0 ? values.join(',') : undefined;
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition ${
        active
          ? 'bg-eneba-yellow text-eneba-ink'
          : 'bg-eneba-canvas/60 text-white ring-1 ring-inset ring-white/15 hover:bg-eneba-canvas'
      }`}
    >
      {children}
    </button>
  );
}

function PriceFilter({
  minPrice,
  maxPrice,
  onChange,
}: {
  minPrice: number | undefined;
  maxPrice: number | undefined;
  onChange: (patch: FilterPatch) => void;
}) {
  const [min, setMin] = useState(centsToEuroInput(minPrice));
  const [max, setMax] = useState(centsToEuroInput(maxPrice));
  const timer = useRef<number | undefined>(undefined);

  // Reflect external changes (e.g. "Clear all") without clobbering in-progress typing.
  useEffect(() => {
    setMin((cur) => (euroInputToCents(cur) === minPrice ? cur : centsToEuroInput(minPrice)));
  }, [minPrice]);
  useEffect(() => {
    setMax((cur) => (euroInputToCents(cur) === maxPrice ? cur : centsToEuroInput(maxPrice)));
  }, [maxPrice]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (nextMin: string, nextMax: string) => {
    const lo = euroInputToCents(nextMin);
    const hi = euroInputToCents(nextMax);
    onChange({
      min_price: lo === undefined ? undefined : String(lo),
      max_price: hi === undefined ? undefined : String(hi),
    });
  };

  const schedule = (nextMin: string, nextMax: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(nextMin, nextMax), 500);
  };

  const lo = euroInputToCents(min);
  const hi = euroInputToCents(max);
  const invalidRange = lo !== undefined && hi !== undefined && lo > hi;

  const inputClass =
    'w-full rounded-lg bg-eneba-canvas/70 py-2 pl-7 pr-2 text-sm font-semibold text-white placeholder-eneba-muted ring-1 ring-inset ring-white/15 focus:outline-none focus:ring-2 focus:ring-eneba-yellow';

  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Minimum price in euros</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-eneba-muted">€</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="Min"
            value={min}
            onChange={(e) => {
              setMin(e.target.value);
              schedule(e.target.value, max);
            }}
            onBlur={() => {
              window.clearTimeout(timer.current);
              commit(min, max);
            }}
            onKeyDown={(e) => e.key === 'Enter' && commit(min, max)}
            className={inputClass}
          />
        </label>
        <span className="text-eneba-muted">–</span>
        <label className="relative flex-1">
          <span className="sr-only">Maximum price in euros</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-eneba-muted">€</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="Max"
            value={max}
            onChange={(e) => {
              setMax(e.target.value);
              schedule(min, e.target.value);
            }}
            onBlur={() => {
              window.clearTimeout(timer.current);
              commit(min, max);
            }}
            onKeyDown={(e) => e.key === 'Enter' && commit(min, max)}
            className={inputClass}
          />
        </label>
      </div>
      {invalidRange && <p className="mt-2 text-xs font-semibold text-eneba-orange">Min price is higher than max price.</p>}
    </div>
  );
}

interface FilterSidebarProps {
  filters: StoreFilters;
  activeCount: number;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
  onClose?: () => void;
}

export function FilterSidebar({ filters, activeCount, onChange, onClear, onClose }: FilterSidebarProps) {
  const togglePlatform = (platform: string) => {
    const next = toggleMultiSelect(filters.platforms, platform, STORE_PLATFORMS);
    onChange({ platform: serializeMultiParam(next) });
  };

  const toggleRegion = (region: string) => {
    const next = toggleMultiSelect(filters.regions, region, STORE_REGIONS);
    onChange({ region: serializeMultiParam(next) });
  };

  return (
    <aside aria-label="Filters" className="space-y-6 rounded-2xl bg-eneba-card p-5 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black">Filters</h2>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close filters" className="rounded p-1 text-eneba-muted hover:text-white lg:hidden">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <fieldset>
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-widest text-eneba-muted">
          Platform {filters.platforms.length > 0 && <span className="text-eneba-yellow">({filters.platforms.length})</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          <Pill active={filters.platforms.length === 0} onClick={() => onChange({ platform: undefined })}>
            All
          </Pill>
          {STORE_PLATFORMS.map((p) => {
            const active = filters.platforms.some((sel) => sel.toLowerCase() === p.toLowerCase());
            return (
              <Pill key={p} active={active} onClick={() => togglePlatform(p)}>
                <span className="inline-flex items-center gap-1.5">
                  <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                  {p}
                </span>
              </Pill>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-widest text-eneba-muted">
          Region {filters.regions.length > 0 && <span className="text-eneba-yellow">({filters.regions.length})</span>}
        </legend>
        <div className="flex flex-wrap gap-2">
          <Pill active={filters.regions.length === 0} onClick={() => onChange({ region: undefined })}>
            All
          </Pill>
          {STORE_REGIONS.map((r) => {
            const active = filters.regions.some((sel) => sel.toLowerCase() === r.toLowerCase());
            return (
              <Pill key={r} active={active} onClick={() => toggleRegion(r)}>
                {r}
              </Pill>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-widest text-eneba-muted">Price range</legend>
        <PriceFilter minPrice={filters.minPrice} maxPrice={filters.maxPrice} onChange={onChange} />
      </fieldset>

      <button
        type="button"
        onClick={onClear}
        disabled={activeCount === 0}
        className="btn-outline w-full disabled:opacity-40"
      >
        Clear All Filters{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
    </aside>
  );
}
