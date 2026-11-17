import { AlertTriangle, RefreshCw } from 'lucide-react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-2xl bg-eneba-card p-8 text-center ring-1 ring-eneba-magenta/50"
    >
      <AlertTriangle className="h-10 w-10 text-eneba-magenta" aria-hidden />
      <h2 className="text-lg font-extrabold">Something went wrong</h2>
      <p className="text-sm text-eneba-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-yellow mt-1">
          <RefreshCw className="h-4 w-4" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}
