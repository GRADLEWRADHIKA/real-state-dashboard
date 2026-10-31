import { Clock3 } from 'lucide-react';
import { heatBand } from '@estateflow/shared';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types';

const BAND_STYLE: Record<string, string> = {
  Hot: 'text-red-700',
  Warm: 'text-amber-700',
  Cold: 'text-sky-700',
};
const BAND_FILL: Record<string, string> = {
  Hot: 'bg-red-500',
  Warm: 'bg-amber-500',
  Cold: 'bg-sky-500',
};

/** Score number with its Hot/Warm/Cold band, e.g. "72 Hot". */
export function ScoreBadge({ score, className }: { score?: number | null; className?: string }) {
  if (score === undefined || score === null) return <span className="text-stone-300">—</span>;
  const band = heatBand(score);
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap', className)} title={`Lead score ${score} of 100`}>
      <span className="num text-[14px] font-bold text-ink">{score}</span>
      <span className={cn('text-[11.5px] font-semibold', BAND_STYLE[band])}>{band}</span>
    </span>
  );
}

/** Small horizontal bar for a 0–100 score. */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const band = heatBand(score);
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-stone-100', className)} role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`Score ${score}`}>
      <div className={cn('h-full rounded-full', BAND_FILL[band])} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
    </div>
  );
}

/** "12 days idle" in amber when a lead is stuck. Renders nothing otherwise. */
export function IdleMarker({ lead, className }: { lead: Pick<Lead, 'stuck' | 'idle_days'>; className?: string }) {
  if (!lead.stuck) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap text-amber-700', className)}>
      <Clock3 className="size-3" />
      {lead.idle_days} days idle
    </span>
  );
}
