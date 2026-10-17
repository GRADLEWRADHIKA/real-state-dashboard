import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Table';
import { FilterSelect, SearchInput } from '@/components/ui/Form';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { InstallmentTable } from '@/components/domain/FinanceViews';
import { RecordPaymentModal } from '@/components/domain/FinanceForms';
import type { Installment, Paged } from '@/types';

type Range = 'overdue' | 'next30' | 'month' | 'all';

export default function Installments() {
  const [params, setParams] = useSearchParams();
  const range = (params.get('range') as Range) || 'next30';
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [pay, setPay] = useState<Installment | null>(null);
  const page = Number(params.get('page') || 1);
  const query = {
    range: range === 'all' ? undefined : range,
    status,
    q: dq,
    page,
    limit: 25,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['installments', query],
    queryFn: () =>
      api.get<
        Paged<
          Installment,
          {
            balance: number;
            counts: { status: string; n: number; balance: number }[];
          }
        >
      >('/installments', query),
    placeholderData: keepPreviousData,
  });
  const counts = Object.fromEntries((data?.meta.counts ?? []).map((c) => [c.status, c]));

  return (
    <div>
      <PageHeader title="Installments" subtitle="Payment schedules for every customer — record collections in one click" crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Installments' }]} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['Overdue', 'Partially Paid', 'Pending', 'Paid'] as const).map((s) => (
          <div key={s} className="card p-4">
            <p className="text-[12.5px] font-semibold text-stone-500">{s}</p>
            <p className="mt-1 text-[24px] font-extrabold text-ink">{counts[s]?.n ?? 0}</p>
            <p className={s === 'Overdue' ? 'text-[12px] font-semibold text-red-600' : 'text-[12px] text-stone-400'}>{s === 'Paid' ? 'fully collected' : `${inr(counts[s]?.balance ?? 0)} balance`}</p>
          </div>
        ))}
      </div>
      <Card className="overflow-hidden">
        <Tabs
          className="px-4 pt-1 sm:px-5"
          value={range}
          onChange={(v) => setParams({ range: v }, { replace: true })}
          tabs={[
            { value: 'overdue', label: 'Overdue' },
            { value: 'next30', label: 'Due in 30 days' },
            { value: 'month', label: 'This month' },
            { value: 'all', label: 'All installments' },
          ]}
        />
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search customer or unit…" className="sm:w-72" />
          <FilterSelect value={status} onChange={setStatus} placeholder="Any status" options={['Overdue', 'Partially Paid', 'Pending', 'Paid']} className="sm:w-44" />
          <p className="text-[13px] text-stone-500 sm:ml-auto">
            {data?.meta.total ?? 0} installments · <b className="text-ink">{inr(data?.meta.balance ?? 0)}</b> to collect
          </p>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState icon={<CalendarClock />} title={range === 'overdue' ? 'Nothing overdue' : 'No installments in this view'} message={range === 'overdue' ? 'Every customer is up to date.' : 'Try another range.'} />
        ) : (
          <InstallmentTable rows={data.data} onPay={setPay} showCustomer />
        )}
        {data && <Pagination meta={data.meta} onPage={(p) => setParams({ range, page: String(p) }, { replace: true })} />}
      </Card>
      <RecordPaymentModal open={!!pay} onClose={() => setPay(null)} installment={pay} />
    </div>
  );
}
