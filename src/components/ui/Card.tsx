import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className, icon }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4.5 pb-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 text-stone-400 [&_svg]:size-[18px]">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-stone-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/** Label/value pair used in detail panels. */
export function InfoRow({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <dt className="text-[12px] font-medium text-stone-500">{label}</dt>
      <dd className="text-[14px] font-semibold break-words text-ink">{children || <span className="font-normal text-stone-400">—</span>}</dd>
    </div>
  );
}
