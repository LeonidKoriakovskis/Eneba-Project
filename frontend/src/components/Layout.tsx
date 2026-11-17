import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Logo, Navbar } from './Navbar';
import { CartDrawer } from './CartDrawer';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [pathname]);
  return null;
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-black/20">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-eneba-muted sm:flex-row">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <Logo />
          <p className="text-xs">Instant digital key delivery · Compare trusted sellers · Best prices on PC &amp; console games</p>
        </div>
        <nav aria-label="Footer" className="flex gap-5 font-semibold">
          <Link to="/store" className="hover:text-white">
            Store
          </Link>
          <Link to="/wishlist" className="hover:text-white">
            Wishlist
          </Link>
          <Link to="/orders" className="hover:text-white">
            My Orders
          </Link>
        </nav>
      </div>
      <p className="border-t border-white/5 py-4 text-center text-xs text-eneba-muted/80">
        Marketplace prototype built for the Eneba Engineering Internship Assignment • Test mode only (no real transactions).
      </p>
    </footer>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <CartDrawer />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
