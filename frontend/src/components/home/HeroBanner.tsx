import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HomepageBlock } from '../../types/api';
import { parseHeroItems, readNumber, readString } from '../../utils/blocks';
import { formatPrice } from '../../utils/format';
import { CoverImage } from '../CoverImage';
import { DiscountPill, PlatformBadge, RegionTag } from '../Badges';

const DEFAULT_INTERVAL_MS = 6000;

export function HeroBanner({ block }: { block: HomepageBlock }) {
  const slides = useMemo(() => parseHeroItems(block.config), [block.config]);
  const products = block.products ?? [];
  const intervalMs = readNumber(block.config, 'autoplay_interval_ms') ?? DEFAULT_INTERVAL_MS;
  const tagline = readString(block.config, 'tagline');

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(id);
  }, [count, paused, intervalMs]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={block.title}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative overflow-hidden rounded-2xl bg-eneba-card shadow-card ring-1 ring-white/10"
    >
      <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => {
          const product = products.find((p) => p.id === slide.productId);
          const inStock = slide.totalStockCount > 0 && slide.lowestPriceCents > 0;
          const hasDiscount = slide.discountPercent > 0 && slide.originalPriceCents > slide.lowestPriceCents;
          return (
            <article
              key={slide.productId}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== index}
              className="relative min-h-[420px] w-full shrink-0 md:min-h-[400px]"
            >
              <CoverImage src={slide.bannerImage ?? product?.cover_image_url} alt="" className="absolute inset-0 h-full w-full" />
              <div className="absolute inset-0 bg-gradient-to-r from-eneba-canvas via-eneba-canvas/85 to-eneba-canvas/10" />
              <div className="absolute inset-0 bg-gradient-to-t from-eneba-canvas/70 to-transparent md:hidden" />

              <div className="relative z-10 flex h-full min-h-[420px] items-center gap-8 px-6 py-10 md:min-h-[400px] md:px-12">
                <div className="max-w-xl">
                  {slide.badge && (
                    <span className="mb-4 inline-block rounded-md bg-eneba-yellow px-3 py-1 text-xs font-black uppercase tracking-widest text-eneba-ink">
                      {slide.badge}
                    </span>
                  )}
                  <h2 className="text-3xl font-black leading-tight text-white drop-shadow md:text-5xl">{slide.headline}</h2>
                  {slide.subheading && <p className="mt-3 text-base font-medium text-white/85 md:text-lg">{slide.subheading}</p>}

                  {product && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <PlatformBadge platform={product.platform} />
                      <RegionTag region={product.region} />
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center gap-4">
                    {inStock ? (
                      <div>
                        {hasDiscount && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white/70 line-through">
                              {formatPrice(slide.originalPriceCents)}
                            </span>
                            <DiscountPill percent={slide.discountPercent} />
                          </div>
                        )}
                        <div className="mt-1 flex items-baseline gap-1.5 leading-none">
                          <span className="text-xs font-semibold uppercase text-white/70">From</span>
                          <span className="text-3xl font-black text-white">{formatPrice(slide.lowestPriceCents)}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="rounded-md bg-black/40 px-3 py-1.5 text-sm font-bold">Currently out of stock</span>
                    )}
                    <Link to={`/product/${slide.slug}`} tabIndex={i === index ? 0 : -1} className="btn-yellow px-7 py-3 text-base">
                      Buy Now
                    </Link>
                  </div>
                </div>

                {product && (
                  <div className="ml-auto hidden w-52 shrink-0 rotate-3 overflow-hidden rounded-xl shadow-2xl ring-4 ring-white/15 lg:block">
                    <CoverImage src={product.cover_image_url} alt={product.title} className="aspect-[3/4] w-full" />
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
            {slides.map((s, i) => (
              <button
                key={s.productId}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => go(i)}
                className={`h-2.5 rounded-full transition-all ${i === index ? 'w-8 bg-eneba-yellow' : 'w-2.5 bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>

          <div className="absolute bottom-4 right-6 z-20 flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(index - 1)}
              className="rounded-full bg-black/45 p-2 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:shadow-glow"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(index + 1)}
              className="rounded-full bg-black/45 p-2 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70 focus:outline-none focus-visible:shadow-glow"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </>
      )}

      {tagline && <p className="sr-only">{tagline}</p>}
    </section>
  );
}
