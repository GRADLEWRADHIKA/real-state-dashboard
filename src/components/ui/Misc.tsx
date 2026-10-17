import type { ReactNode } from 'react';
import { Link } from 'react-router';
import * as RTooltip from '@radix-ui/react-tooltip';
import * as RMenu from '@radix-ui/react-dropdown-menu';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

// ─── Avatar ──────────────────────────────────────────────────────────────
const AVATAR_TONES = ['bg-brand-100 text-brand-800', 'bg-gold-100 text-gold-700', 'bg-sky-100 text-sky-800', 'bg-violet-100 text-violet-800', 'bg-orange-100 text-orange-800', 'bg-rose-100 text-rose-800', 'bg-teal-100 text-teal-800'];
export function Avatar({ name, size = 'md', className }: { name?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const s = {
    xs: 'size-6 text-[10px]',
    sm: 'size-7 text-[11px]',
    md: 'size-9 text-[12.5px]',
    lg: 'size-11 text-[14px]',
    xl: 'size-14 text-[18px]',
  }[size];
  const hash = [...(name ?? '')].reduce((h, c) => h + c.charCodeAt(0), 0);
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-wide', s, AVATAR_TONES[hash % AVATAR_TONES.length], className)}>{initials(name)}</span>;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} className="z-[70] max-w-xs rounded-lg bg-stone-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-pop data-[state=delayed-open]:animate-fade-in">
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

// ─── Dropdown menu ───────────────────────────────────────────────────────
export function Menu({ trigger, children, align = 'end' }: { trigger: ReactNode; children: ReactNode; align?: 'start' | 'end' | 'center' }) {
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={6} className="z-50 min-w-[190px] rounded-xl border border-stone-200 bg-white p-1.5 shadow-pop data-[state=open]:animate-fade-in">
          {children}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}
export function MenuItem({ children, onSelect, icon, danger, disabled }: { children: ReactNode; onSelect?: () => void; icon?: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <RMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4',
        danger ? 'text-red-600 data-[highlighted]:bg-red-50' : 'text-stone-700 data-[highlighted]:bg-stone-100 data-[highlighted]:text-ink [&_svg]:text-stone-400',
      )}
    >
      {icon}
      {children}
    </RMenu.Item>
  );
}
export const MenuSeparator = () => <RMenu.Separator className="my-1 h-px bg-stone-100" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <RMenu.Label className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">{children}</RMenu.Label>;

// ─── Tabs (underline) & segmented control ───────────────────────────────
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('scroll-thin -mx-1 flex gap-1 overflow-x-auto border-b border-stone-200 px-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn('relative flex shrink-0 items-center gap-1.5 px-3 pt-2 pb-2.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors', value === t.value ? 'text-brand-800' : 'text-stone-500 hover:text-stone-800')}
        >
          {t.label}
          {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-[11px] leading-[18px] font-bold', value === t.value ? 'bg-brand-100 text-brand-800' : 'bg-stone-100 text-stone-500')}>{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-700" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode; icon?: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-[10px] border border-stone-200 bg-stone-100/70 p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-all [&_svg]:size-4', value === o.value ? 'bg-white text-ink shadow-card' : 'text-stone-500 hover:text-stone-800')}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Progress bar ────────────────────────────────────────────────────────
export function Progress({ value, className, tone = 'brand', size = 'md' }: { value: number; className?: string; tone?: 'brand' | 'gold' | 'red'; size?: 'sm' | 'md' | 'lg' }) {
  const fill = {
    brand: 'bg-brand-700',
    gold: 'bg-gold-500',
    red: 'bg-red-500',
  }[tone];
  const track = {
    brand: 'bg-brand-100',
    gold: 'bg-gold-100',
    red: 'bg-red-100',
  }[tone];
  const h = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' }[size];
  return (
    <div className={cn('w-full overflow-hidden rounded-full', track, h, className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', fill)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ─── Page header with breadcrumbs ────────────────────────────────────────
export function PageHeader({ title, subtitle, crumbs, actions, className }: { title: ReactNode; subtitle?: ReactNode; crumbs?: { label: string; to?: string }[]; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 hidden items-center gap-1 text-[12.5px] font-medium text-stone-500 sm:flex">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 text-stone-300" />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-brand-800">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-stone-700">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] leading-tight font-extrabold tracking-[-0.02em] text-ink sm:text-[26px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-stone-500 sm:text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
