import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'eneba.cart';
export const MAX_QTY_PER_OFFER = 10;

export interface CartItem {
  sellerOfferId: string;
  productId: string;
  slug: string;
  title: string;
  coverImageUrl: string;
  platform: string;
  region: string;
  sellerName: string;
  unitPriceCents: number;
  originalPriceCents: number;
  quantity: number;
  /** min(10, keys in stock when added) - caps the quantity selector. */
  maxQuantity: number;
}

export type NewCartItem = Omit<CartItem, 'quantity'>;

export type CartAction =
  | { type: 'add'; item: NewCartItem; quantity: number }
  | { type: 'setQuantity'; sellerOfferId: string; quantity: number }
  | { type: 'remove'; sellerOfferId: string }
  | { type: 'clear' };

function clamp(qty: number, max: number): number {
  return Math.max(1, Math.min(qty, max, MAX_QTY_PER_OFFER));
}

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const max = Math.max(1, Math.min(action.item.maxQuantity, MAX_QTY_PER_OFFER));
      const existing = state.find((i) => i.sellerOfferId === action.item.sellerOfferId);
      if (existing) {
        return state.map((i) =>
          i.sellerOfferId === existing.sellerOfferId
            ? { ...i, ...action.item, maxQuantity: max, quantity: clamp(i.quantity + action.quantity, max) }
            : i,
        );
      }
      return [...state, { ...action.item, maxQuantity: max, quantity: clamp(action.quantity, max) }];
    }
    case 'setQuantity':
      return state.map((i) =>
        i.sellerOfferId === action.sellerOfferId ? { ...i, quantity: clamp(action.quantity, i.maxQuantity) } : i,
      );
    case 'remove':
      return state.filter((i) => i.sellerOfferId !== action.sellerOfferId);
    case 'clear':
      return [];
  }
}

function isCartItem(v: unknown): v is CartItem {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const strings = ['sellerOfferId', 'productId', 'slug', 'title', 'coverImageUrl', 'platform', 'region', 'sellerName'];
  const numbers = ['unitPriceCents', 'originalPriceCents', 'quantity', 'maxQuantity'];
  return (
    strings.every((k) => typeof o[k] === 'string') &&
    numbers.every((k) => typeof o[k] === 'number' && Number.isFinite(o[k]))
  );
}

function loadStored(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : [];
  } catch {
    return [];
  }
}

export interface AddCartOptions {
  openDrawer?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  totalCents: number;
  isDrawerOpen: boolean;
  lastAddedItem: CartItem | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: NewCartItem, quantity?: number, options?: AddCartOptions) => void;
  setQuantity: (sellerOfferId: string, quantity: number) => void;
  removeItem: (sellerOfferId: string) => void;
  clear: () => void;
  getQuantity: (sellerOfferId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, dispatch] = useReducer(cartReducer, undefined, loadStored);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [items]);

  // Keep multiple tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      dispatch({ type: 'clear' });
      for (const item of loadStored()) {
        dispatch({ type: 'add', item, quantity: item.quantity });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const addItem = useCallback((item: NewCartItem, quantity = 1, options?: AddCartOptions) => {
    dispatch({ type: 'add', item, quantity });
    setLastAddedItem({
      ...item,
      quantity: clamp(quantity, Math.max(1, Math.min(item.maxQuantity, MAX_QTY_PER_OFFER))),
    });
    if (options?.openDrawer !== false) {
      setIsDrawerOpen(true);
    }
  }, []);

  const setQuantity = useCallback(
    (sellerOfferId: string, quantity: number) => dispatch({ type: 'setQuantity', sellerOfferId, quantity }),
    [],
  );
  const removeItem = useCallback((sellerOfferId: string) => dispatch({ type: 'remove', sellerOfferId }), []);
  const clear = useCallback(() => {
    dispatch({ type: 'clear' });
    setLastAddedItem(null);
    setIsDrawerOpen(false);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((n, i) => n + i.quantity, 0),
      totalCents: items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0),
      isDrawerOpen,
      lastAddedItem,
      openDrawer,
      closeDrawer,
      addItem,
      setQuantity,
      removeItem,
      clear,
      getQuantity: (id: string) => items.find((i) => i.sellerOfferId === id)?.quantity ?? 0,
    }),
    [items, isDrawerOpen, lastAddedItem, openDrawer, closeDrawer, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within <CartProvider>');
  return ctx;
}
