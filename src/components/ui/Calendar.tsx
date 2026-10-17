import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { todayStr } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Card } from './Card';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** First and last day (YYYY-MM-DD) of the month containing `month` (YYYY-MM). */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  return [`${month}-01`, iso(new Date(y, m, 0))];
}

export const currentMonth = () => todayStr().slice(0, 7);

function shift(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Month grid (Monday first). Each day lists its items; overflow collapses to "+N more". */
export function MonthCalendar<T>({
  month,
  onMonth,
  items,
  dateOf,
  keyOf,
  renderItem,
  maxPerDay = 3,
  onDayClick,
}: {
  month: string;
  onMonth: (m: string) => void;
  items: T[];
  dateOf: (t: T) => string;
  keyOf: (t: T) => string | number;
  renderItem: (t: T) => ReactNode;
  maxPerDay?: number;
  onDayClick?: (date: string) => void;
}) {
  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const start = new Date(first);
    start.setDate(1 - ((first.getDay() + 6) % 7));
    const last = new Date(y, m, 0);
    const end = new Date(last);
    end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const out: string[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(iso(d));
    return out;
  }, [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const it of items) {
      const d = dateOf(it).slice(0, 10);
      map.set(d, [...(map.get(d) ?? []), it]);
    }
    return map;
  }, [items, dateOf]);
  const today = todayStr();
  const label = new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 sm:px-5">
        <h2 className="text-[15px] font-bold text-ink">{label}</h2>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onMonth(currentMonth())} disabled={month === currentMonth()}>
            Today
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Previous month" icon={<ChevronLeft />} onClick={() => onMonth(shift(month, -1))} />
          <Button size="icon-sm" variant="ghost" aria-label="Next month" icon={<ChevronRight />} onClick={() => onMonth(shift(month, 1))} />
        </div>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-b border-stone-100 bg-stone-50/70 px-2 py-1.5 text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">
              {d}
            </div>
          ))}
          {days.map((d) => {
            const list = byDay.get(d) ?? [];
            const inMonth = d.startsWith(month);
            return (
              <div
                key={d}
                data-date={d}
                className={cn('min-h-[104px] border-r border-b border-stone-100 p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-stone-50/60', onDayClick && 'cursor-pointer hover:bg-brand-50/40')}
                onClick={onDayClick ? () => onDayClick(d) : undefined}
              >
                <span className={cn('mb-1 inline-flex size-6 items-center justify-center rounded-full text-[12px] font-bold', d === today ? 'bg-brand-800 text-white' : inMonth ? 'text-ink' : 'text-stone-400')}>{Number(d.slice(8))}</span>
                <div className="space-y-1">
                  {list.slice(0, maxPerDay).map((it) => (
                    <div key={keyOf(it)} onClick={(e) => e.stopPropagation()}>
                      {renderItem(it)}
                    </div>
                  ))}
                  {list.length > maxPerDay && <p className="px-1 text-[11.5px] font-semibold text-stone-500">+{list.length - maxPerDay} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/** Compact pill used inside calendar cells. */
export function CalendarPill({ tone = 'brand', children, onClick, title }: { tone?: 'brand' | 'amber' | 'red' | 'gray' | 'blue'; children: ReactNode; onClick?: () => void; title?: string }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-900 hover:bg-brand-100',
    amber: 'bg-amber-50 text-amber-900 hover:bg-amber-100',
    red: 'bg-red-50 text-red-800 hover:bg-red-100',
    gray: 'bg-stone-100 text-stone-500 line-through hover:bg-stone-200',
    blue: 'bg-sky-50 text-sky-900 hover:bg-sky-100',
  };
  return (
    <button type="button" title={title} onClick={onClick} className={cn('block w-full truncate rounded-md px-1.5 py-1 text-left text-[11.5px] font-semibold', tones[tone])}>
      {children}
    </button>
  );
}
