import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { ProductSummary } from '../types/api';

export const WISHLIST_STORAGE_KEY = 'eneba_wishlist';

export type WishlistAction =
  | { type: 'toggle'; product: ProductSummary }
  | { type: 'remove'; productId: string }
  | { type: 'replace'; items: ProductSummary[] }
  | { type: 'clear' };

export function wishlistReducer(state: ProductSummary[], action: WishlistAction): ProductSummary[] {
  switch (action.type) {
    case 'toggle': {
      const exists = state.some((item) => item.id === action.product.id);
      if (exists) {
        return state.filter((item) => item.id !== action.product.id);
      }
      return [action.product, ...state];
    }
    case 'remove':
      return state.filter((item) => item.id !== action.productId);
    case 'replace':
      return action.items;
    case 'clear':
      return [];
  }
}

function isProductSummary(v: unknown): v is ProductSummary {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const strings = ['id', 'title', 'slug', 'cover_image_url', 'platform', 'region'];
  return (
    strings.every((k) => typeof o[k] === 'string') &&
    typeof o.lowest_price_cents === 'number' &&
    Number.isFinite(o.lowest_price_cents)
  );
}

function loadStoredWishlist(): ProductSummary[] {
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isProductSummary) : [];
  } catch {
    return [];
  }
}

interface WishlistContextValue {
  items: ProductSummary[];
  count: number;
  toggleWishlist: (product: ProductSummary) => void;
  isWishlisted: (productId: string) => boolean;
  removeFromWishlist: (productId: string) => void;
  clearWishlist: () => void;
}

const DEFAULT_WISHLIST_CONTEXT: WishlistContextValue = {
  items: [],
  count: 0,
  toggleWishlist: () => {},
  isWishlisted: () => false,
  removeFromWishlist: () => {},
  clearWishlist: () => {},
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(wishlistReducer, undefined, loadStoredWishlist);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [items]);

  // Keep multiple browser tabs synchronized when localStorage updates.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== WISHLIST_STORAGE_KEY) return;
      dispatch({ type: 'replace', items: loadStoredWishlist() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleWishlist = useCallback((product: ProductSummary) => {
    dispatch({ type: 'toggle', product });
  }, []);

  const removeFromWishlist = useCallback((productId: string) => {
    dispatch({ type: 'remove', productId });
  }, []);

  const clearWishlist = useCallback(() => {
    dispatch({ type: 'clear' });
  }, []);

  const savedIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);

  const isWishlisted = useCallback((productId: string) => savedIds.has(productId), [savedIds]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      items,
      count: items.length,
      toggleWishlist,
      isWishlisted,
      removeFromWishlist,
      clearWishlist,
    }),
    [items, toggleWishlist, isWishlisted, removeFromWishlist, clearWishlist],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  return useContext(WishlistContext) ?? DEFAULT_WISHLIST_CONTEXT;
}
