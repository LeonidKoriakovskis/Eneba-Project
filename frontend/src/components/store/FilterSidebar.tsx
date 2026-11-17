import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { centsToEuroInput, euroInputToCents } from '../../lib/format';
import { PlatformIcon } from '../PlatformBadge';

export interface StoreFilters {
  q: string;
  platform: string;
  region: string;
  minPrice: number | undefined; // cents
  maxPrice: number | undefined; // cents
}

export type FilterPatch = Partial<Record<'platform' | 'region' | 'min_price' | 'max_price', string | undefined>>;

const PLATFORMS = ['Steam', 'PSN', 'Xbox', 'Nintendo'] as const;
const REGIONS = ['GLOBAL', 'EUROPE', 'US'] as const;

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
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-widest text-eneba-muted">Platform</legend>
        <div className="flex flex-wrap gap-2">
          <Pill active={!filters.platform} onClick={() => onChange({ platform: undefined })}>
            All
          </Pill>
          {PLATFORMS.map((p) => (
            <Pill key={p} active={filters.platform === p} onClick={() => onChange({ platform: p })}>
              <span className="inline-flex items-center gap-1.5">
                <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                {p}
              </span>
            </Pill>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2.5 text-xs font-extrabold uppercase tracking-widest text-eneba-muted">Region</legend>
        <div className="flex flex-wrap gap-2">
          <Pill active={!filters.region} onClick={() => onChange({ region: undefined })}>
            All
          </Pill>
          {REGIONS.map((r) => (
            <Pill key={r} active={filters.region === r} onClick={() => onChange({ region: r })}>
              {r}
            </Pill>
          ))}
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
