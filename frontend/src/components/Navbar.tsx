import { Link, NavLink } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { SearchBar } from './SearchBar';
import { AccountMenu } from './AccountMenu';

export function Logo() {
  return (
    <Link to="/" aria-label="Eneba home" className="flex shrink-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:shadow-glow">
      <svg viewBox="0 0 32 32" className="h-9 w-9" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#FFDC00" />
        <path d="M10 8h12v3.5h-8.2v3H21v3.5h-7.2v3H22V24H10z" fill="#1F0A4D" />
      </svg>
      <span className="text-2xl font-black lowercase tracking-tight text-white">eneba</span>
    </Link>
  );
}

function WishlistButton() {
  const { count } = useWishlist();
  return (
    <Link
      to="/wishlist"
      aria-label={`Wishlist, ${count} item${count === 1 ? '' : 's'}`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg bg-eneba-canvas/60 ring-1 ring-white/10 transition hover:bg-eneba-canvas focus:outline-none focus-visible:shadow-glow"
    >
      <Heart
        className={`h-5 w-5 transition ${count > 0 ? 'fill-eneba-magenta text-eneba-magenta' : 'text-white'}`}
        aria-hidden
      />
      {count > 0 && (
        <span
          data-testid="wishlist-badge"
          className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-eneba-magenta px-1 text-[11px] font-black leading-none text-white ring-2 ring-eneba-brand"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

function CartButton() {
  const { itemCount, openDrawer } = useCart();
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg bg-eneba-canvas/60 ring-1 ring-white/10 transition hover:bg-eneba-canvas focus:outline-none focus-visible:shadow-glow"
    >
      <ShoppingCart className="h-5 w-5" aria-hidden />
      {itemCount > 0 && (
        <span
          data-testid="cart-badge"
          className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-eneba-magenta px-1 text-[11px] font-black leading-none text-white ring-2 ring-eneba-brand"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-eneba-brand shadow-lg shadow-black/30">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 md:flex-nowrap lg:gap-x-6">
        <Logo />

        <nav aria-label="Primary" className="flex items-center">
          <NavLink
            to="/store"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-extrabold transition hover:bg-white/10 ${isActive ? 'text-eneba-yellow' : 'text-white'}`
            }
          >
            Store
          </NavLink>
        </nav>

        {/* One search instance: full-width second row on mobile, flexible centre column on desktop. */}
        <div className="order-last w-full md:order-none md:max-w-2xl md:flex-1">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <WishlistButton />
          <CartButton />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
