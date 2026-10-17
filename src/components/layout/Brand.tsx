import mark from '@/assets/starwiz-mark.png';
import { cn } from '@/lib/utils';

export const BRAND = {
  company: 'Starwiz Realty',
  product: 'EstateFlow CRM',
  vendor: 'TheGradleW Technologies',
  vendorUrl: 'https://thegradlew.com/',
  tagline: 'From Lead to Deal, Everything in One Place.',
};

export function BrandMark({ className }: { className?: string }) {
  return <img src={mark} alt="Starwiz Realty" className={cn('rounded-[10px] object-cover ring-1 ring-gold-400/30', className)} draggable={false} />;
}

/** Logo + names. `tone="dark"` for green surfaces. */
export function BrandLockup({ tone = 'dark', compact }: { tone?: 'dark' | 'light'; compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark className={compact ? 'size-8' : 'size-9'} />
      <div className="min-w-0 leading-tight">
        <p className={cn('truncate text-[14.5px] font-extrabold tracking-[-0.01em]', tone === 'dark' ? 'text-white' : 'text-ink')}>{BRAND.company}</p>
        <p className={cn('truncate text-[11px] font-semibold tracking-[0.08em] uppercase', tone === 'dark' ? 'text-gold-300/90' : 'text-gold-600')}>{BRAND.product}</p>
      </div>
    </div>
  );
}

export function PoweredBy({ className, tone = 'muted' }: { className?: string; tone?: 'muted' | 'dark' }) {
  return (
    <a href={BRAND.vendorUrl} target="_blank" rel="noreferrer" className={cn('text-[11.5px] font-medium transition-colors', tone === 'dark' ? 'text-brand-200/60 hover:text-gold-200' : 'text-stone-400 hover:text-brand-800', className)}>
      Powered by <span className="font-semibold">{BRAND.vendor}</span>
    </a>
  );
}

/** Full-screen splash while the session is restored. */
export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand-950 bg-[radial-gradient(ellipse_at_top,rgb(15_81_50/0.6),transparent_65%)]">
      <BrandMark className="size-16 rounded-2xl shadow-2xl shadow-black/40" />
      <p className="mt-5 font-display text-[22px] font-semibold text-white">{BRAND.product}</p>
      <p className="mt-1 text-[13px] text-brand-200/70">{BRAND.company}</p>
      <div className="mt-8 h-0.5 w-28 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 rounded-full bg-gold-400" style={{ animation: 'splash-bar 1.1s ease-in-out infinite' }} />
      </div>
      <style>{`@keyframes splash-bar{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
      <PoweredBy tone="dark" className="absolute bottom-8" />
    </div>
  );
}
