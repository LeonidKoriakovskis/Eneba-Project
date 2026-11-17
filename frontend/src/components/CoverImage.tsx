import { useState } from 'react';
import { Gamepad2 } from 'lucide-react';

interface CoverImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
}

function initials(title: string): string {
  return title
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/** Cover art with a sleek Eneba-styled box-art fallback when the external image is missing or fails to load. */
export function CoverImage({ src, alt, className = '' }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-gradient-to-br from-[#4618AC] via-[#2B0F6B] to-[#1F0A4D] p-4 text-center text-eneba-muted ${className}`}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-eneba-yellow/10 blur-2xl" />
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
          <Gamepad2 className="h-7 w-7 text-eneba-yellow" aria-hidden />
        </div>
        <span className="text-xl font-black tracking-widest text-white/90">{initials(alt) || 'GAME'}</span>
        {alt && <span className="line-clamp-2 max-w-[14ch] text-[11px] font-bold text-white/70">{alt}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={`object-cover ${className}`}
    />
  );
}
