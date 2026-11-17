import { FaGamepad, FaPlaystation, FaSteam, FaXbox } from 'react-icons/fa';
import { BsNintendoSwitch } from 'react-icons/bs';

interface PlatformMeta {
  label: string;
  accent: string;
}

function getPlatformMeta(platform: string): PlatformMeta {
  const normalized = platform.toLowerCase();
  if (normalized.includes('steam')) {
    return { label: 'Steam', accent: 'text-sky-300' };
  }
  if (normalized.includes('psn') || normalized.includes('playstation')) {
    return { label: 'PlayStation', accent: 'text-blue-400' };
  }
  if (normalized.includes('xbox')) {
    return { label: 'Xbox', accent: 'text-emerald-400' };
  }
  if (normalized.includes('nintendo')) {
    return { label: 'Nintendo', accent: 'text-rose-400' };
  }
  return { label: platform, accent: 'text-eneba-muted' };
}

export function PlatformIcon({ platform, className = 'h-3.5 w-3.5' }: { platform: string; className?: string }) {
  const normalized = platform.toLowerCase();
  if (normalized.includes('steam')) {
    return <FaSteam className={className} aria-hidden />;
  }
  if (normalized.includes('psn') || normalized.includes('playstation')) {
    return <FaPlaystation className={className} aria-hidden />;
  }
  if (normalized.includes('xbox')) {
    return <FaXbox className={className} aria-hidden />;
  }
  if (normalized.includes('nintendo')) {
    return <BsNintendoSwitch className={className} aria-hidden />;
  }
  return <FaGamepad className={className} aria-hidden />;
}

export function PlatformBadge({ platform, className = '' }: { platform: string; className?: string }) {
  const meta = getPlatformMeta(platform);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-black/35 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-inset ring-white/10 ${className}`}
    >
      <PlatformIcon platform={platform} className={`h-3.5 w-3.5 shrink-0 ${meta.accent}`} />
      <span>{meta.label}</span>
    </span>
  );
}
