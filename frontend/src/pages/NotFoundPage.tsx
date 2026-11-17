import { Link } from 'react-router-dom';
import { Ghost } from 'lucide-react';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFoundPage({ message = "This page doesn't exist." }: { message?: string }) {
  useDocumentTitle('Not found');
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <Ghost className="h-16 w-16 text-eneba-muted" aria-hidden />
      <h1 className="text-3xl font-black">404 – Not found</h1>
      <p className="text-eneba-muted">{message}</p>
      <div className="flex gap-3">
        <Link to="/" className="btn-yellow">Go home</Link>
        <Link to="/store" className="btn-outline">Browse store</Link>
      </div>
    </div>
  );
}
