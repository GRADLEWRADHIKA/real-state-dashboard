import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fmtDate, inr, inrShort, monthYearLabel, todayStr } from '@/lib/format';
import { SERIES, STATUS_COLORS, cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { PageHeader, Progress, Segmented } from '@/components/ui/Misc';
import { ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { ChartTip, Donut, MonthlyBars, SegmentMeter, StageBars, StatCard } from '@/components/charts/Charts';

interface ReportData {
  from: string;
  to: string;
  sections: string[];
  conversion?: {
    total: number;
    won: number;
    lost: number;
    rate: number;
    stages: { stage: string; count: number }[];
  };
  sales?: {
    months: { month: string; deals: number; value: number }[];
    total_deals: number;
    total_value: number;
  };
  agents?: {
    id: number;
    name: string;
    role: string;
    leads: number;
    followups: number;
    site_visits: number;
    deals: number;
    value: number;
  }[];
  sources?: {
    source: string;
    leads: number;
    qualified: number;
    converted: number;
    value: number;
    rate: number;
  }[];
  properties?: {
    project: string;
    units: number;
    available: number;
    reserved: number;
    booked: number;
    sold: number;
    inventory_value: number;
    sold_value: number;
    interested: number;
  }[];
  revenue?: {
    months: { month: string; amount: number; count: number }[];
    total: number;
    count: number;
  };
  collection?: {
    collected: number;
    pending: number;
    overdue: number;
    due_in_range: number;
    collected_in_range: number;
    efficiency: number;
    methods: { method: string; amount: number; count: number }[];
  };
  outstanding?: {
    id: number;
    code: string;
    name: string;
    phone: string;
    property_project: string;
    property_unit: string;
    total_value: number;
    paid: number;
    outstanding: number;
    overdue: number;
    next_due?: string;
  }[];
  aging?: {
    buckets: { label: string; amount: number; count: number }[];
    customers: {
      id: number;
      code: string;
      name: string;
      phone: string;
      buckets: number[];
      total: number;
      oldest_due: string;
    }[];
  };
}

const RANGES: Record<string, () => [string, string]> = {
  '30d': () => [todayStr(-30), todayStr()],
  '90d': () => [todayStr(-90), todayStr()],
  '6m': () => [todayStr(-182), todayStr()],
  fy: () => {
    const d = new Date();
    const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return [`${y}-04-01`, todayStr()];
  },
  '12m': () => [todayStr(-365), todayStr()],
};

const LABELS: Record<string, string> = {
  conversion: 'Lead conversion',
  sales: 'Sales',
  revenue: 'Revenue',
  collection: 'Payment collection',
  outstanding: 'Outstanding',
  aging: 'Receivables ageing',
  agents: 'Agent performance',
  properties: 'Property performance',
  sources: 'Source performance',
};

function Table({ head, rows, foot }: { head: { label: string; right?: boolean }[]; rows: ReactNode[][]; foot?: ReactNode[] }) {
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13.5px]">
        <thead>
          <tr className="border-y border-stone-100 bg-stone-50/70 text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">
            {head.map((h, i) => (
              <th key={h.label} className={cn('px-3 py-2.5', h.right ? 'text-right' : 'text-left', i === 0 && 'pl-5', i === head.length - 1 && 'pr-5')}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-stone-100 last:border-0">
              {r.map((c, i) => (
                <td key={i} className={cn('px-3 py-2.5 text-stone-700', head[i]?.right && 'num text-right', i === 0 && 'pl-5 font-semibold text-ink', i === r.length - 1 && 'pr-5')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-stone-200 bg-stone-50/50 font-bold text-ink">
              {foot.map((c, i) => (
                <td key={i} className={cn('px-3 py-2.5', head[i]?.right && 'num text-right', i === 0 && 'pl-5', i === foot.length - 1 && 'pr-5')}>
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export default function Reports() {
  const [preset, setPreset] = useState('12m');
  const [custom, setCustom] = useState<[string, string]>([todayStr(-90), todayStr()]);
  const [from, to] = preset === 'custom' ? custom : RANGES[preset]();
  const [section, setSection] = useState<string>('');
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.get<ReportData>('/reports', { from, to }),
    placeholderData: keepPreviousData,
  });
  const active = section && data?.sections.includes(section) ? section : (data?.sections[0] ?? '');
  const fileTag = `${from}_to_${to}`;

  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const exportSection = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      await api.download('/reports/export', `${active}_${fileTag}.${format}`, {
        section: active,
        format,
        from,
        to,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) return <PageSkeleton stats={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`${fmtDate(from)} – ${fmtDate(to)}`}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Reports' }]}
        actions={
          <div className="flex gap-2">
            <Button icon={<Download />} loading={exporting === 'csv'} onClick={() => exportSection('csv')}>
              CSV
            </Button>
            <Button icon={<FileText />} loading={exporting === 'pdf'} onClick={() => exportSection('pdf')}>
              PDF
            </Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <div className="scroll-thin overflow-x-auto">
          <Segmented
            value={preset}
            onChange={setPreset}
            options={[
              { value: '30d', label: '30 days' },
              { value: '90d', label: '90 days' },
              { value: '6m', label: '6 months' },
              { value: 'fy', label: 'This FY' },
              { value: '12m', label: '12 months' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom[0]} max={custom[1]} onChange={(e) => setCustom([e.target.value, custom[1]])} className="h-9 w-40" aria-label="From date" />
            <span className="text-stone-400">to</span>
            <Input type="date" value={custom[1]} min={custom[0]} max={todayStr()} onChange={(e) => setCustom([custom[0], e.target.value])} className="h-9 w-40" aria-label="To date" />
          </div>
        )}
        {isFetching && <span className="size-4 animate-spin rounded-full border-2 border-stone-200 border-t-brand-700" />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Reports">
          {data.sections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                active === s ? 'bg-white text-brand-800 shadow-card ring-1 ring-stone-200' : 'text-stone-600 hover:bg-white/60 hover:text-ink',
              )}
            >
              <BarChart3 className={cn('size-4', active === s ? 'text-brand-700' : 'text-stone-400')} />
              {LABELS[s]}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          {active === 'conversion' && data.conversion && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Leads created" value={data.conversion.total} />
                <StatCard label="Converted" value={data.conversion.won} caption="Booked or closed" />
                <StatCard label="Conversion rate" value={`${data.conversion.rate}%`} />
                <StatCard label="Lost" value={data.conversion.lost} accent="red" />
              </div>
              <Card>
                <CardHeader title="Funnel by stage" subtitle="Current stage of leads created in this period" />
                <div className="px-3 pb-4">
                  <StageBars data={data.conversion.stages} />
                </div>
              </Card>
            </>
          )}

          {active === 'sales' && data.sales && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard label="Deals booked" value={data.sales.total_deals} />
                <StatCard label="Booked value" value={inrShort(data.sales.total_value)} />
                <StatCard label="Average deal" value={inrShort(data.sales.total_deals ? data.sales.total_value / data.sales.total_deals : 0)} />
              </div>
              <Card>
                <CardHeader title="Booked value by month" />
                <div className="px-3 pb-4">
                  <MonthlyBars data={data.sales.months} dataKey="value" name="Booked value" color={SERIES[1]} />
                </div>
              </Card>
              <Card className="overflow-hidden">
                <Table
                  head={[{ label: 'Month' }, { label: 'Deals', right: true }, { label: 'Booked value', right: true }]}
                  rows={data.sales.months.map((m) => [monthYearLabel(m.month), m.deals, inr(m.value)])}
                  foot={['Total', data.sales.total_deals, inr(data.sales.total_value)]}
                />
              </Card>
            </>
          )}

          {active === 'revenue' && data.revenue && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <StatCard label="Collected" value={inrShort(data.revenue.total)} />
                <StatCard label="Payments" value={data.revenue.count} />
                <StatCard label="Monthly average" value={inrShort(data.revenue.total / Math.max(1, data.revenue.months.length))} />
              </div>
              <Card>
                <CardHeader title="Collections by month" />
                <div className="px-3 pb-4">
                  <MonthlyBars data={data.revenue.months} dataKey="amount" name="Collected" />
                </div>
              </Card>
              <Card className="overflow-hidden">
                <Table head={[{ label: 'Month' }, { label: 'Payments', right: true }, { label: 'Collected', right: true }]} rows={data.revenue.months.map((m) => [monthYearLabel(m.month), m.count, inr(m.amount)])} foot={['Total', data.revenue.count, inr(data.revenue.total)]} />
              </Card>
            </>
          )}

          {active === 'collection' && data.collection && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Due in period" value={inrShort(data.collection.due_in_range)} />
                <StatCard label="Collected against dues" value={inrShort(data.collection.collected_in_range)} />
                <StatCard label="Collection efficiency" value={`${data.collection.efficiency}%`} />
                <StatCard label="Overdue today" value={inrShort(data.collection.overdue)} accent="red" />
              </div>
              <Card>
                <CardHeader title="Receivables position" subtitle="All schedules as of today" />
                <div className="px-5 pb-5">
                  <SegmentMeter
                    segments={[
                      {
                        label: 'Collected',
                        value: data.collection.collected,
                        color: STATUS_COLORS.good,
                      },
                      {
                        label: 'Pending',
                        value: data.collection.pending,
                        color: STATUS_COLORS.warning,
                        hint: 'not yet due',
                      },
                      {
                        label: 'Overdue',
                        value: data.collection.overdue,
                        color: STATUS_COLORS.critical,
                      },
                    ]}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader title="Collections by payment method" />
                <div className="px-5 pb-5">
                  <Donut
                    vertical
                    height={170}
                    centerValue={data.collection.methods.reduce((s, m) => s + m.count, 0)}
                    centerLabel="payments"
                    data={data.collection.methods.map((m, i) => ({
                      name: m.method,
                      value: m.count,
                      color: SERIES[i],
                      extra: <span className="num text-[12px] text-stone-500">{inrShort(m.amount)}</span>,
                    }))}
                  />
                </div>
              </Card>
            </>
          )}

          {active === 'outstanding' && data.outstanding && (
            <Card className="overflow-hidden">
              <CardHeader title="Outstanding by customer" subtitle={`${inr(data.outstanding.reduce((s, r) => s + r.outstanding, 0))} receivable · ${inr(data.outstanding.reduce((s, r) => s + r.overdue, 0))} overdue`} />
              <Table
                head={[{ label: 'Customer' }, { label: 'Property' }, { label: 'Total', right: true }, { label: 'Paid', right: true }, { label: 'Outstanding', right: true }, { label: 'Overdue', right: true }, { label: 'Next due' }]}
                rows={data.outstanding.map((r) => [
                  <Link key="n" to={`/customers/${r.id}`} className="hover:text-brand-800">
                    {r.name}
                  </Link>,
                  `${r.property_project} · ${r.property_unit}`,
                  inrShort(r.total_value),
                  inrShort(r.paid),
                  inrShort(r.outstanding),
                  r.overdue ? (
                    <span key="o" className="font-bold text-red-600">
                      {inrShort(r.overdue)}
                    </span>
                  ) : (
                    '—'
                  ),
                  fmtDate(r.next_due),
                ])}
              />
            </Card>
          )}

          {active === 'aging' && data.aging && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {data.aging.buckets.map((b, i) => (
                  <StatCard key={b.label} label={`${b.label} overdue`} value={inrShort(b.amount)} caption={`${b.count} installment${b.count === 1 ? '' : 's'}`} accent={i >= 2 ? 'red' : undefined} />
                ))}
              </div>
              <Card className="overflow-hidden">
                <CardHeader title="Overdue by customer" subtitle={`${inr(data.aging.buckets.reduce((s, b) => s + b.amount, 0))} past due as of today`} />
                {data.aging.customers.length ? (
                  <Table
                    head={[
                      { label: 'Customer' },
                      ...data.aging.buckets.map((b) => ({
                        label: b.label,
                        right: true,
                      })),
                      { label: 'Total', right: true },
                      { label: 'Oldest due' },
                    ]}
                    rows={data.aging.customers.map((c) => [
                      <Link key="n" to={`/customers/${c.id}`} className="hover:text-brand-800">
                        {c.name}
                      </Link>,
                      ...c.buckets.map((v) => (v ? inrShort(v) : '—')),
                      <span key="t" className="font-bold text-red-600">
                        {inrShort(c.total)}
                      </span>,
                      fmtDate(c.oldest_due),
                    ])}
                    foot={['Total', ...data.aging.buckets.map((b) => inrShort(b.amount)), inrShort(data.aging.buckets.reduce((s, b) => s + b.amount, 0)), '']}
                  />
                ) : (
                  <p className="px-5 pb-5 text-[13.5px] text-stone-500">No customer has an overdue installment.</p>
                )}
              </Card>
            </>
          )}

          {active === 'agents' && data.agents && (
            <>
              <Card>
                <CardHeader title="Booked value by agent" />
                <div className="px-3 pb-4">
                  <ResponsiveContainer width="100%" height={Math.max(200, data.agents.length * 44)}>
                    <BarChart data={data.agents} layout="vertical" margin={{ left: 0, right: 24 }}>
                      <CartesianGrid horizontal={false} stroke="#ece9e2" />
                      <XAxis type="number" tickFormatter={(v) => inrShort(v).replace('₹', '')} tick={{ fontSize: 11.5, fill: '#8a857d' }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        tick={{
                          fontSize: 12,
                          fill: '#57534e',
                          fontWeight: 600,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip cursor={{ fill: 'rgb(15 81 50 / 0.05)' }} content={<ChartTip format={(v: number) => inr(v)} />} />
                      <Bar dataKey="value" name="Booked value" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <Table
                  head={[{ label: 'Agent' }, { label: 'Leads', right: true }, { label: 'Follow-ups', right: true }, { label: 'Site visits', right: true }, { label: 'Deals', right: true }, { label: 'Conversion', right: true }, { label: 'Booked value', right: true }]}
                  rows={data.agents.map((a) => [a.name, a.leads, a.followups, a.site_visits, a.deals, a.leads ? `${Math.round((a.deals / a.leads) * 100)}%` : '—', inr(a.value)])}
                  foot={['Team', ...(['leads', 'followups', 'site_visits', 'deals'] as const).map((k) => data.agents!.reduce((s, a) => s + a[k], 0)), '', inr(data.agents.reduce((s, a) => s + a.value, 0))]}
                />
              </Card>
            </>
          )}

          {active === 'properties' && data.properties && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.properties.map((p) => {
                const sold = p.booked + p.sold;
                return (
                  <Card key={p.project} className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[15px] font-bold text-ink">{p.project}</p>
                        <p className="text-[12.5px] text-stone-500">
                          {p.units} units · {p.interested} interested leads
                        </p>
                      </div>
                      <p className="text-right text-[18px] font-extrabold text-ink">{inrShort(p.sold_value)}</p>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-stone-500">
                        <span>
                          {sold} of {p.units} sold or booked
                        </span>
                        <span className="text-ink">{Math.round((sold / p.units) * 100)}%</span>
                      </div>
                      <Progress value={(sold / p.units) * 100} />
                    </div>
                    <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                      {[
                        ['Available', p.available],
                        ['Reserved', p.reserved],
                        ['Booked', p.booked],
                        ['Sold', p.sold],
                      ].map(([l, v]) => (
                        <div key={l} className="rounded-lg bg-stone-50 py-2">
                          <dd className="text-[16px] font-extrabold text-ink">{v}</dd>
                          <dt className="text-[11px] font-semibold text-stone-500">{l}</dt>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-[12px] text-stone-500">Unsold inventory value {inrShort(p.inventory_value)}</p>
                  </Card>
                );
              })}
            </div>
          )}

          {active === 'sources' && data.sources && (
            <>
              <Card>
                <CardHeader title="Leads vs conversions by source" />
                <div className="px-3 pb-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.sources} margin={{ top: 10, right: 8, left: -16 }} barGap={2}>
                      <CartesianGrid vertical={false} stroke="#ece9e2" />
                      <XAxis dataKey="source" tick={{ fontSize: 11.5, fill: '#8a857d' }} axisLine={{ stroke: '#d6d3cc' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: '#8a857d' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgb(15 81 50 / 0.05)' }} content={<ChartTip />} />
                      <Bar dataKey="leads" name="Leads" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                      <Bar dataKey="converted" name="Converted" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-1 flex justify-center gap-5 text-[12.5px] font-semibold text-stone-600">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[1] }} /> Leads
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[0] }} /> Converted
                    </span>
                  </div>
                </div>
              </Card>
              <Card className="overflow-hidden">
                <Table
                  head={[{ label: 'Source' }, { label: 'Leads', right: true }, { label: 'Qualified+', right: true }, { label: 'Converted', right: true }, { label: 'Conversion', right: true }, { label: 'Booked value', right: true }]}
                  rows={data.sources.map((s) => [s.source, s.leads, s.qualified, s.converted, `${s.rate}%`, inr(s.value)])}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
