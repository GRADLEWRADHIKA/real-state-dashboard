import type { ReactNode } from 'react';
import { AlertCircle, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton', className)} />;

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-5 animate-spin text-brand-700', className)} />;
}

export function EmptyState({ icon, title, message, action, className, compact }: { icon?: ReactNode; title: string; message?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
      {icon && (
        <div className="relative mb-4">
          <div className="absolute inset-0 scale-150 rounded-full bg-brand-100/50 blur-xl" />
          <div className="relative flex size-12 items-center justify-center rounded-2xl border border-brand-100 bg-gradient-to-b from-white to-brand-50 text-brand-700 shadow-card [&_svg]:size-[22px]">{icon}</div>
        </div>
      )}
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {message && <p className="mt-1 max-w-sm text-[13.5px] leading-relaxed text-stone-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong while loading this page.';
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-[15px] font-bold text-ink">Couldn’t load this data</p>
      <p className="mt-1 max-w-sm text-[13.5px] text-stone-500">{msg}</p>
      {onRetry && (
        <Button className="mt-4" icon={<RefreshCw />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Generic page skeleton: header + stat row + two panels. */
export function PageSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className={cn('grid gap-4', stats >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3')}>
        {Array.from({ length: stats }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[14px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-[14px] lg:col-span-2" />
        <Skeleton className="h-80 rounded-[14px]" />
      </div>
    </div>
  );
}
