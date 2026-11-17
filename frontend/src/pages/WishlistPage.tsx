import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Heart, Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import type { ProductSummary } from '../types/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useDocumentTitle } from '../utils/hooks';
import { ProductCard, addBestOfferToCart } from '../components/ProductCard';

export default function WishlistPage() {
  useDocumentTitle('My Wishlist');
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { items, count, removeFromWishlist, clearWishlist } = useWishlist();
  const [movingId, setMovingId] = useState<string | null>(null);

  const handleMoveToCart = async (product: ProductSummary) => {
    if (movingId) return;
    const inStock = product.total_stock_count > 0 && product.lowest_price_cents > 0;
    if (!inStock) {
      navigate(`/product/${product.slug}`);
      return;
    }

    setMovingId(product.id);
    try {
      const added = await addBestOfferToCart(product, addItem);
      if (!added) {
        navigate(`/product/${product.slug}`);
        return;
      }
      removeFromWishlist(product.id);
    } catch {
      navigate(`/product/${product.slug}`);
    } finally {
      setMovingId(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-none bg-eneba-card px-6 py-16 text-center shadow-card ring-1 ring-white/10">
        <span className="flex h-16 w-16 items-center justify-center rounded-none bg-eneba-brand/60 ring-1 ring-white/15">
          <Heart className="h-8 w-8 text-eneba-magenta" aria-hidden />
        </span>
        <h1 className="text-2xl font-black text-white">Your wishlist is empty</h1>
        <p className="max-w-sm text-sm text-eneba-muted">
          Tap the heart icon on any game card to save deals here and move them to your cart whenever you are ready.
        </p>
        <Link to="/store" className="btn-yellow mt-2">
          Browse Store <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-none bg-eneba-card px-5 py-4 shadow-card ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-none bg-eneba-magenta/15 ring-1 ring-eneba-magenta/40">
            <Heart className="h-5 w-5 fill-eneba-magenta text-eneba-magenta" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-black text-white md:text-2xl">My Wishlist</h1>
            <p className="text-xs font-semibold text-eneba-muted">
              {count} saved game{count === 1 ? '' : 's'} stored locally in your browser
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/store" className="btn-outline px-4 py-2 text-xs">
            Explore Store
          </Link>
          <button
            type="button"
            onClick={clearWishlist}
            className="inline-flex items-center gap-1.5 rounded-none border border-white/15 px-3.5 py-2 text-xs font-extrabold text-eneba-muted transition hover:border-eneba-magenta/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-eneba-yellow"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Clear Wishlist
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((product) => {
          const inStock = product.total_stock_count > 0 && product.lowest_price_cents > 0;
          const isMoving = movingId === product.id;

          return (
            <div key={product.id} className="flex flex-col gap-2">
              <ProductCard product={product} moveToCartOnAdd />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!inStock || isMoving}
                  onClick={() => handleMoveToCart(product)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-none bg-[#FFDC00] px-3 py-2 text-xs font-extrabold text-[#1F0A4D] transition hover:bg-eneba-yellowHover focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isMoving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Moving…
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5" aria-hidden />
                      {inStock ? 'Move to Cart' : 'Out of Stock'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromWishlist(product.id)}
                  aria-label={`Remove ${product.title} from wishlist`}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none border border-white/15 bg-eneba-card text-eneba-muted transition hover:border-eneba-magenta/60 hover:text-eneba-magenta focus:outline-none focus-visible:ring-2 focus-visible:ring-eneba-yellow"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
