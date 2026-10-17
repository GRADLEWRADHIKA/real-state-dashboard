import type { ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { inr, inrShort, monthLabel, num } from '@/lib/format';
import { SERIES, cn } from '@/lib/utils';

const AXIS = { fontSize: 11.5, fill: '#8a857d', fontFamily: 'inherit' };
const GRID = '#ece9e2';

export function ChartTip({ active, payload, label, format = (v: number) => num(v), labelFormat }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-xl border border-stone-200 bg-white px-3 py-2.5 shadow-pop">
      <p className="mb-1.5 text-[12px] font-semibold text-stone-500">{labelFormat ? labelFormat(label) : label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-2 text-stone-600">
            <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
            {p.name}
          </span>
          <span className="num font-bold text-ink">{format(p.value, p)}</span>
        </div>
      ))}
    </div>
  );
}

/** 2px trend line with an end dot; current period in brand, history muted. */
export function Sparkline({ data, className, color = '#0f5132' }: { data: number[]; className?: string; color?: string }) {
  if (!data.length || data.every((d) => d === 0)) return <div className={className} />;
  const w = 96;
  const h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((d, i) => [(i / (data.length - 1)) * (w - 6) + 3, h - 4 - ((d - min) / (max - min || 1)) * (h - 8)]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <path d={`${path} L${last[0]} ${h} L${pts[0][0]} ${h} Z`} fill={color} opacity="0.08" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} stroke="white" strokeWidth="2" />
    </svg>
  );
}

export function Delta({ value, goodWhenUp = true, className }: { value: number | null | undefined; goodWhenUp?: boolean; className?: string }) {
  if (value === null || value === undefined) return <span className={cn('text-[12px] font-semibold text-stone-400', className)}>—</span>;
  const flat = Math.abs(value) < 0.05;
  const good = flat ? null : value > 0 === goodWhenUp;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-bold', good === null ? 'bg-stone-100 text-stone-600' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600', className)}>
      <Icon className="size-3.5" />
      {flat ? '0%' : `${Math.abs(value).toFixed(1)}%`}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  change,
  goodWhenUp = true,
  caption,
  trend,
  footer,
  accent,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  change?: number | null;
  goodWhenUp?: boolean;
  caption?: ReactNode;
  trend?: number[];
  footer?: ReactNode;
  accent?: 'gold' | 'red';
  onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={cn('card group relative flex flex-col overflow-hidden p-4 transition-shadow sm:p-5', onClick && 'cursor-pointer hover:shadow-pop')} role={onClick ? 'button' : undefined}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] font-semibold text-stone-500">{label}</p>
        {icon && <span className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', accent === 'gold' ? 'bg-gold-50 text-gold-600' : accent === 'red' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700')}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-[24px] leading-none font-extrabold tracking-[-0.02em] text-ink sm:text-[28px]">{value}</p>
        {trend && <Sparkline data={trend} className="hidden h-8 w-24 shrink-0 sm:block" />}
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1">
        {change !== undefined && <Delta value={change} goodWhenUp={goodWhenUp} />}
        {caption && <span className="text-[12px] text-stone-500">{caption}</span>}
      </div>
      {footer}
    </div>
  );
}

/** Monthly rupee columns (single series). */
export function MonthlyBars({ data, dataKey, name, height = 260, color = SERIES[0], format = inrShort, target }: { data: any[]; dataKey: string; name: string; height?: number; color?: string; format?: (v: number) => string; target?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="month" tickFormatter={monthLabel} tick={AXIS} axisLine={{ stroke: '#d6d3cc' }} tickLine={false} interval={0} />
        <YAxis tickFormatter={(v) => format(v).replace('₹', '')} tick={AXIS} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          cursor={{ fill: 'rgb(15 81 50 / 0.05)' }}
          content={
            <ChartTip
              format={(v: number) => inr(v)}
              labelFormat={(l: string) =>
                new Date(`${l}-01T00:00:00`).toLocaleDateString('en-IN', {
                  month: 'long',
                  year: 'numeric',
                })
              }
            />
          }
        />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={24} />
        {!!target && <ReferenceLine y={target} stroke="#c59d09" strokeDasharray="5 4" strokeWidth={1.5} ifOverflow="extendDomain" label={{ value: `Target ${format(target)}`, position: 'insideTopRight', fill: '#8a6d06', fontSize: 11.5, fontWeight: 700 }} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal funnel of lead counts per stage, value at the bar tip. */
export function StageBars({ data, height = 300, onSelect }: { data: { stage: string; count: number; value?: number }[]; height?: number; onSelect?: (stage: string) => void }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={{ ...AXIS, fill: '#57534e', fontWeight: 600 }} axisLine={false} tickLine={false} width={84} />
        <Tooltip cursor={{ fill: 'rgb(15 81 50 / 0.05)' }} content={<ChartTip format={(v: number, p: any) => `${v} leads${p?.payload?.value ? ` · ${inrShort(p.payload.value)}` : ''}`} />} />
        <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]} maxBarSize={20} onClick={(d: any) => onSelect?.(d.stage)} className={onSelect ? 'cursor-pointer' : ''}>
          {data.map((d) => (
            <Cell key={d.stage} fill={d.stage === 'Lost' ? '#c9c4bb' : d.stage === 'Booked' || d.stage === 'Closed' ? '#0f5132' : '#36855f'} />
          ))}
          <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#44403c' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut + legend table (legend always present; identity never colour-only). */
export function Donut({ data, centerLabel, centerValue, height = 200, vertical }: { data: { name: string; value: number; color?: string; extra?: ReactNode }[]; centerLabel: string; centerValue: ReactNode; height?: number; vertical?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className={cn('flex flex-col items-center gap-5', !vertical && 'sm:flex-row sm:items-center')}>
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="66%" outerRadius="100%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive>
              {data.map((d, i) => (
                <Cell key={d.name} fill={d.color ?? SERIES[i % SERIES.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTip format={(v: number) => `${v} · ${total ? Math.round((v / total) * 100) : 0}%`} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-extrabold tracking-tight text-ink">{centerValue}</span>
          <span className="text-[11.5px] font-medium text-stone-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2.5 text-[13px]">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color ?? SERIES[i % SERIES.length] }} />
            <span className="flex-1 truncate font-medium text-stone-700">{d.name}</span>
            {d.extra}
            <span className="num w-8 text-right font-bold text-ink">{d.value}</span>
            <span className="num w-10 text-right text-stone-400">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Segmented meter (2px gaps) for collected / pending / overdue. */
export function SegmentMeter({ segments }: { segments: { label: string; value: number; color: string; hint?: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-stone-100">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(s.value / total) * 100}%`,
                background: s.color,
              }}
              title={`${s.label}: ${inr(s.value)}`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {segments.map((s) => (
          <li key={s.label} className="min-w-0">
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-stone-500">
              <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
              {s.label}
            </p>
            <p className="mt-1 text-[18px] font-extrabold tracking-tight text-ink">{inrShort(s.value)}</p>
            <p className="text-[12px] text-stone-400">
              {Math.round((s.value / total) * 100)}% {s.hint ? `· ${s.hint}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
