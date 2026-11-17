import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
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
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-eneba-muted sm:flex-row">
        <p>Instant digital key delivery · Compare trusted sellers · Best prices on PC & console games</p>
        <nav className="flex gap-4 font-semibold">
          <Link to="/store" className="hover:text-white">
            Store
          </Link>
          <Link to="/orders" className="hover:text-white">
            My Orders
          </Link>
        </nav>
      </div>
      <p className="pb-6 text-center text-xs text-eneba-muted/70">
        Eneba Software Engineer Internship assignment · Demo marketplace, not affiliated with Eneba.
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
