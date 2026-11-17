import { Link } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { useDocumentTitle } from '../lib/hooks';

/** Temporary stand-in for screens delivered in the next step (Cart, Sign-In, Orders). */
export default function ComingSoonPage({ title, description }: { title: string; description: string }) {
  useDocumentTitle(title);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-eneba-card px-6 py-16 text-center ring-1 ring-white/10">
      <Hammer className="h-12 w-12 text-eneba-yellow" aria-hidden />
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="text-sm text-eneba-muted">{description}</p>
      <Link to="/store" className="btn-yellow">Continue browsing</Link>
    </div>
  );
}
