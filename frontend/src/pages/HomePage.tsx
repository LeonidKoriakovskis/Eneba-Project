import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { HomepageBlock } from '../types/api';
import { useDocumentTitle } from '../lib/hooks';
import { ErrorState } from '../components/ErrorState';
import { ProductCardSkeleton } from '../components/ProductCard';
import { HeroBanner } from '../components/home/HeroBanner';
import { ProductBlock } from '../components/home/ProductBlock';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; blocks: HomepageBlock[] };

function BlockRenderer({ block }: { block: HomepageBlock }) {
  // The backend decides which blocks exist, their order, and their content.
  switch (block.block_type) {
    case 'hero_banner':
      return <HeroBanner block={block} />;
    case 'best_sellers':
    case 'flash_deals':
    case 'recommended':
    default:
      // Unknown future block types degrade gracefully to a product grid.
      return <ProductBlock block={block} />;
  }
}

function HomeSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading homepage">
      <div className="h-[400px] animate-pulse rounded-2xl bg-eneba-card" />
      <div>
        <div className="mb-4 h-7 w-56 animate-pulse rounded bg-eneba-card" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  useDocumentTitle('Digital game keys at the best prices');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    api
      .getHomepage(ctrl.signal)
      .then((res) => {
        const blocks = [...(res.blocks ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        setState({ status: 'ready', blocks });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setState({ status: 'error', message: errorMessage(err) });
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (state.status === 'loading') return <HomeSkeleton />;
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={retry} />;
  if (state.blocks.length === 0) {
    return <p className="py-20 text-center text-eneba-muted">Nothing to show yet. Check back soon!</p>;
  }

  return (
    <div className="space-y-12">
      {state.blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} />
      ))}
    </div>
  );
}
