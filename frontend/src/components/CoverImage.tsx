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

/** Cover art with a branded gradient fallback when the image is missing or fails to load. */
export function CoverImage({ src, alt, className = '' }: CoverImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-eneba-brand via-eneba-card to-eneba-canvasLight text-eneba-muted ${className}`}
      >
        <Gamepad2 className="h-10 w-10 opacity-70" aria-hidden />
        <span className="text-2xl font-black tracking-wider text-white/80">{initials(alt)}</span>
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
