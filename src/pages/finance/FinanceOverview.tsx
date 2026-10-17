import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarClock, Clock, IndianRupee, Landmark, Phone, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, inr, inrShort, relativeDay } from '@/lib/format';
import { SERIES, cn, telHref } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Donut, MonthlyBars, StatCard } from '@/components/charts/Charts';
import { RecordPaymentModal } from '@/components/domain/FinanceForms';
import type { Installment, Transaction } from '@/types';

interface Summary {
  total_sales: number;
  collected: number;
  pending: number;
  overdue: number;
  overdue_count: number;
  upcoming_30: number;
  outstanding: number;
  this_month: number;
  last_month: number;
  last_month_to_date: number;
  monthly: { month: string; amount: number; count: number }[];
  methods: { method: string; amount: number; count: number }[];
  pending_clearance: { count: number; amount: number };
  upcoming: Installment[];
  overdue_list: Installment[];
  recent: Transaction[];
}

function DueList({ rows, onPay, overdue }: { rows: Installment[]; onPay: (i: Installment) => void; overdue?: boolean }) {
  if (!rows.length) return <EmptyState compact icon={<CalendarClock />} title={overdue ? 'No overdue installments' : 'Nothing due in the next 45 days'} />;
  return (
    <ul className="divide-y divide-stone-100">
      {rows.map((i) => (
        <li key={i.id} className="flex items-center gap-3 px-5 py-3">
          <div className={cn('w-14 shrink-0 text-center', overdue ? 'text-red-600' : 'text-stone-700')}>
            <p className="text-[15px] leading-none font-extrabold">{new Date(`${i.due_date}T00:00:00`).getDate()}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase">{fmtDate(i.due_date, { month: 'short' })}</p>
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/customers/${i.customer_id}`} className="block truncate text-[13.5px] font-semibold text-ink hover:text-brand-800">
              {i.customer_name}
            </Link>
            <p className="truncate text-[12px] text-stone-500">
              {i.label} · {i.property_project?.replace('Green Valley ', 'GV ')} {i.property_unit} · <span className={cn(overdue && 'font-semibold text-red-600')}>{relativeDay(i.due_date)}</span>
            </p>
          </div>
          <span className="num hidden text-[13.5px] font-bold text-ink sm:block">{inrShort(i.balance)}</span>
          {overdue && i.customer_phone && (
            <a href={telHref(i.customer_phone)} aria-label={`Call ${i.customer_name}`} className="flex size-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink">
              <Phone className="size-4" />
            </a>
          )}
          <Button size="sm" variant={overdue ? 'primary' : 'secondary'} onClick={() => onPay(i)} className="shrink-0">
            Collect
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function FinanceOverview() {
  const [pay, setPay] = useState<Installment | null>(null);
  const {
    data: s,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['finance', 'summary'],
    queryFn: () => api.get<Summary>('/finance/summary'),
  });
  if (isLoading) return <PageSkeleton stats={6} />;
  if (error || !s) return <ErrorState error={error} onRetry={refetch} />;
  const monthChange = s.last_month_to_date ? ((s.this_month - s.last_month_to_date) / s.last_month_to_date) * 100 : null;
  const year = s.monthly.reduce((t, m) => t + m.amount, 0);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Collections, receivables and installment health across every booking"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Finance' }]}
        actions={
          <>
            <ButtonLink to="/finance/transactions" icon={<Receipt />}>
              Transactions
            </ButtonLink>
            <ButtonLink to="/finance/installments?range=next30" variant="primary" icon={<IndianRupee />}>
              Record payment
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total sales" value={inrShort(s.total_sales)} icon={<TrendingUp />} caption="Booked deal value" />
        <StatCard label="Total collected" value={inrShort(s.collected)} icon={<IndianRupee />} caption={`${Math.round((s.collected / Math.max(1, s.total_sales)) * 100)}% of sales`} />
        <StatCard label="Pending" value={inrShort(s.pending)} icon={<Clock />} accent="gold" caption="Scheduled, not yet due" />
        <StatCard label="Overdue" value={inrShort(s.overdue)} icon={<AlertTriangle />} accent="red" caption={`${s.overdue_count} installments past due`} />
        <StatCard label="Upcoming · 30 days" value={inrShort(s.upcoming_30)} icon={<CalendarClock />} caption="Expected collections" />
        <StatCard label="This month" value={inrShort(s.this_month)} icon={<Wallet />} change={monthChange} caption={`vs ${inrShort(s.last_month_to_date)} same period last month`} />
      </div>

      {s.pending_clearance.count > 0 && (
        <Link to="/finance/transactions?status=Pending" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100/70">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-amber-700 shadow-card">
            <Landmark className="size-[18px]" />
          </span>
          <p className="flex-1 text-[13.5px] text-amber-900">
            <b>
              {s.pending_clearance.count} cheque
              {s.pending_clearance.count > 1 ? 's' : ''}
            </b>{' '}
            worth <b>{inr(s.pending_clearance.amount)}</b> awaiting bank clearance.
          </p>
          <ArrowRight className="size-4 text-amber-700" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Monthly collections"
            subtitle={
              <>
                <b className="text-ink">{inr(year)}</b> collected in the last 12 months
              </>
            }
          />
          <div className="px-2 pb-4 sm:px-4">
            <MonthlyBars data={s.monthly} dataKey="amount" name="Collected" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment methods" subtitle="Share of amount collected" />
          <div className="px-5 pb-5">
            <Donut
              height={170}
              vertical
              centerValue={inrShort(s.collected, 1)}
              centerLabel="collected"
              data={s.methods.map((m, i) => ({
                name: m.method,
                value: m.count,
                color: SERIES[i],
                extra: <span className="num text-[12px] text-stone-500">{inrShort(m.amount)}</span>,
              }))}
            />
            <p className="mt-3 text-[12px] text-stone-400">Counts show number of payments; amounts on the right.</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader
            title="Overdue installments"
            subtitle={`${inr(s.overdue)} past due`}
            icon={<AlertTriangle />}
            action={
              <ButtonLink to="/finance/installments?range=overdue" size="sm" variant="ghost">
                All
              </ButtonLink>
            }
          />
          <DueList rows={s.overdue_list} onPay={setPay} overdue />
        </Card>
        <Card className="overflow-hidden">
          <CardHeader
            title="Upcoming collections"
            subtitle="Due in the next 45 days"
            icon={<CalendarClock />}
            action={
              <ButtonLink to="/finance/installments?range=next30" size="sm" variant="ghost">
                All
              </ButtonLink>
            }
          />
          <DueList rows={s.upcoming} onPay={setPay} />
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Recent transactions"
          action={
            <ButtonLink to="/finance/transactions" size="sm" variant="ghost">
              View all <ArrowRight />
            </ButtonLink>
          }
        />
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {s.recent.map((t) => (
            <li key={t.id}>
              <Link to={t.status === 'Completed' ? `/receipts/${t.id}` : `/customers/${t.customer_id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-50">
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', t.status === 'Completed' ? 'bg-brand-50 text-brand-700' : t.status === 'Pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>
                  <IndianRupee className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{t.customer_name}</p>
                  <p className="truncate text-[12px] text-stone-500">
                    {t.receipt_number ?? t.code} · {t.method} · {fmtDate(t.payment_date)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
                <span className="num w-24 text-right text-[13.5px] font-bold text-ink">{inrShort(t.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <RecordPaymentModal open={!!pay} onClose={() => setPay(null)} installment={pay} />
    </div>
  );
}
