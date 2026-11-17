import React, { useEffect, useState } from 'react';
import { api } from './services/api';
import { HealthCheckResponse } from './types';
import { 
  Gamepad2, 
  Search, 
  ShoppingCart, 
  User, 
  ShieldCheck, 
  Database, 
  Server, 
  Zap, 
  Tag, 
  Layers, 
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        setLoading(true);
        const data = await api.getHealth();
        setHealth(data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to reach API server');
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-eneba-bg text-white flex flex-col font-sans">
      {/* Top Banner Announcement */}
      <div className="bg-gradient-to-r from-eneba-purple via-indigo-900 to-eneba-orange px-4 py-2 text-center text-xs sm:text-sm font-semibold tracking-wide flex items-center justify-center gap-2">
        <Zap className="w-4 h-4 text-eneba-yellow animate-pulse" />
        <span>Eneba Internship Project — Step 1 Scaffolding & Database Foundation Active</span>
      </div>

      {/* Main Header / Nav */}
      <header className="sticky top-0 z-50 bg-[#0e121d]/95 backdrop-blur-md border-b border-eneba-border px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-eneba-yellow to-eneba-orange flex items-center justify-center shadow-lg shadow-yellow-500/20 group-hover:scale-105 transition-transform">
              <Gamepad2 className="w-6 h-6 text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-white flex items-center">
                ENEBA<span className="text-eneba-yellow text-xs ml-1 font-bold px-1.5 py-0.5 rounded bg-yellow-400/10 border border-yellow-400/30">CLONE</span>
              </span>
              <span className="text-[10px] text-eneba-text-secondary uppercase tracking-widest font-semibold -mt-1">
                Game Marketplace
              </span>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex-1 max-w-2xl relative hidden md:block">
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search games, keys, subscriptions (with pg_trgm typo tolerance)..."
                className="w-full bg-[#161c2b] text-sm text-white placeholder-eneba-text-secondary rounded-lg pl-10 pr-24 py-2.5 border border-eneba-border focus:outline-none focus:border-eneba-yellow transition-colors"
                disabled
              />
              <Search className="w-4 h-4 text-eneba-text-secondary absolute left-3.5" />
              <button className="absolute right-1.5 px-3 py-1.5 bg-eneba-yellow text-black text-xs font-bold rounded-md hover:bg-yellow-400 transition-colors">
                Search
              </button>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161c2b] hover:bg-eneba-hover border border-eneba-border text-sm font-medium text-eneba-text-secondary hover:text-white transition-colors">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-eneba-yellow text-black font-bold text-sm hover:bg-yellow-400 shadow-md shadow-yellow-500/10 transition-transform active:scale-95">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Cart (0)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero / System Status Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 lg:px-8 py-8 w-full space-y-8">
        
        {/* Foundation Status Card */}
        <section className="bg-eneba-card border border-eneba-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-eneba-yellow/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-cyan-400 border border-cyan-500/20 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                Step 1: Scaffolding & Database Foundation
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Digital Game Marketplace Architecture
              </h1>
              <p className="mt-2 text-eneba-text-secondary text-sm sm:text-base max-w-2xl leading-relaxed">
                Modeled after Eneba with dynamic block-driven homepage layout, multi-seller product offers,
                PostgreSQL <code className="text-eneba-yellow font-mono">pg_trgm</code> typo-tolerant indexing,
                and atomic digital key allocation.
              </p>
            </div>

            {/* Health pill */}
            <div className="bg-[#0b0e17] border border-eneba-border p-4 rounded-xl flex flex-col gap-3 min-w-[280px]">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-bold tracking-wider text-eneba-text-secondary flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-eneba-yellow" /> API Health Check
                </span>
                {loading ? (
                  <span className="text-xs text-eneba-text-muted animate-pulse">Checking...</span>
                ) : health?.status === 'ok' ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> ONLINE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <AlertCircle className="w-3 h-3" /> DEGRADED
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-eneba-text-secondary border-t border-eneba-border/50 pt-2">
                <div className="flex justify-between items-center">
                  <span>Backend Endpoint:</span>
                  <span className="font-mono text-white">GET /api/health</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>PostgreSQL Pool:</span>
                  <span className={`font-mono font-medium ${health?.database.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {health?.database.connected ? `Connected (${health.database.latency_ms}ms)` : 'Awaiting Connection'}
                  </span>
                </div>
                {error && (
                  <div className="text-[11px] text-rose-400 bg-rose-500/10 p-1.5 rounded border border-rose-500/20 mt-1">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Core Architecture Modules */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-eneba-card border border-eneba-border rounded-xl p-5 hover:border-eneba-yellow/50 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Block-Driven Layout</h3>
            <p className="text-xs text-eneba-text-secondary mt-1.5 leading-relaxed">
              <code className="text-eneba-cyan">homepage_blocks</code> table drives hero banners, best sellers, and flash deals with zero hardcoded UI.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-eneba-card border border-eneba-border rounded-xl p-5 hover:border-eneba-yellow/50 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition-transform">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Trigram Typo Search</h3>
            <p className="text-xs text-eneba-text-secondary mt-1.5 leading-relaxed">
              PostgreSQL <code className="text-eneba-cyan">pg_trgm</code> GIN indexes enable fast fuzzy matching, forgiving misspellings on 16 seeded titles.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-eneba-card border border-eneba-border rounded-xl p-5 hover:border-eneba-yellow/50 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <Tag className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Multi-Seller Marketplace</h3>
            <p className="text-xs text-eneba-text-secondary mt-1.5 leading-relaxed">
              <code className="text-eneba-cyan">seller_offers</code> links multiple merchant pricing, seller ratings, and stock to each product.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-eneba-card border border-eneba-border rounded-xl p-5 hover:border-eneba-yellow/50 transition-all group">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Atomic Fulfillment</h3>
            <p className="text-xs text-eneba-text-secondary mt-1.5 leading-relaxed">
              Pre-seeded digital keys allocated with <code className="text-emerald-400">FOR UPDATE SKIP LOCKED</code> preventing double-selling.
            </p>
          </div>
        </section>

        {/* Database & Migrations Overview */}
        <section className="bg-eneba-card border border-eneba-border rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-eneba-yellow">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Database & Seed Verification</h2>
              <p className="text-xs text-eneba-text-secondary">Summary of generated migrations and seed state</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0e121c] p-4 rounded-xl border border-eneba-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">001_init.sql</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Schema Ready</span>
              </div>
              <ul className="text-xs text-eneba-text-secondary space-y-1.5 list-disc pl-4">
                <li><strong className="text-white">users</strong> (JWT auth, bcrypt passwords)</li>
                <li><strong className="text-white">products</strong> (with pg_trgm GIN index on title)</li>
                <li><strong className="text-white">seller_offers</strong> (multi-vendor pricing & ratings)</li>
                <li><strong className="text-white">digital_keys</strong> (unique license keys, status pool)</li>
                <li><strong className="text-white">orders</strong> &amp; <strong className="text-white">order_items</strong> (checkout history)</li>
                <li><strong className="text-white">homepage_blocks</strong> (dynamic block-driven CMS)</li>
              </ul>
            </div>

            <div className="bg-[#0e121c] p-4 rounded-xl border border-eneba-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">002_seed.sql</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">16 Games Seeded</span>
              </div>
              <ul className="text-xs text-eneba-text-secondary space-y-1.5 list-disc pl-4">
                <li>16 realistic games: Cyberpunk 2077, Elden Ring, Baldur's Gate 3, Black Myth: Wukong, etc.</li>
                <li>Platforms: Steam, PSN, Xbox, Nintendo Switch across Global/EU/US regions.</li>
                <li>2-4 distinct seller offers per game (PixelVault, NexusGaming, KeyMaster, etc.).</li>
                <li>3-5 unique license keys pre-seeded per offer (<code className="text-eneba-yellow">XXXX-YYYY-ZZZZ</code>).</li>
                <li>4 dynamic homepage blocks configured (<code className="text-white">hero_banner</code>, <code className="text-white">best_sellers</code>, <code className="text-white">flash_deals</code>, <code className="text-white">recommended</code>).</li>
              </ul>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-eneba-border bg-[#0a0d14] py-6 px-4 text-center text-xs text-eneba-text-secondary">
        <p>Eneba Software Engineer Internship Assignment — Full-Stack Monorepo Scaffold</p>
      </footer>
    </div>
  );
};
