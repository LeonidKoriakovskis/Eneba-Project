import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Package, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AccountMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!isAuthenticated || !user) {
    return (
      <Link
        to="/login"
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-eneba-yellow px-3 text-sm font-extrabold text-eneba-ink transition hover:bg-eneba-yellowHover sm:px-4"
      >
        <User className="h-5 w-5" aria-hidden />
        <span className="hidden sm:inline">Sign In / Register</span>
        <span className="sm:hidden">Sign In</span>
      </Link>
    );
  }

  const firstName = user.full_name.split(' ')[0] ?? user.full_name;
  const initial = user.full_name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-eneba-canvas/60 px-2.5 text-sm font-bold ring-1 ring-white/10 transition hover:bg-eneba-canvas sm:px-3"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-eneba-yellow text-sm font-black text-eneba-ink">
          {initial}
        </span>
        <span className="hidden max-w-[7rem] truncate sm:inline">{firstName}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl bg-eneba-card shadow-2xl ring-1 ring-white/10"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <div className="truncate text-sm font-extrabold">{user.full_name}</div>
            <div className="truncate text-xs text-eneba-muted">{user.email}</div>
          </div>
          <Link
            to="/orders"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-semibold hover:bg-eneba-cardHover"
          >
            <Package className="h-4 w-4 text-eneba-yellow" aria-hidden /> My Orders
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-eneba-cardHover"
          >
            <LogOut className="h-4 w-4 text-eneba-magenta" aria-hidden /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
