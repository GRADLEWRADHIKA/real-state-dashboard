import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Handshake } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, inr, inrShort } from '@/lib/format';
import { DEAL_STAGES, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/Form';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader, Progress } from '@/components/ui/Misc';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import type { Deal, Paged } from '@/types';
import { PropertyThumb } from '@/components/domain/PropertyGallery';

export default function Deals() {
  const navigate = useNavigate();
  const [stage, setStage] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['deals', dq],
    queryFn: () => api.get<Paged<Deal>>('/deals', { q: dq, limit: 500 }).then((r) => r.data),
  });
  const rows = useMemo(() => (data ?? []).filter((d) => !stage || d.stage === stage), [data, stage]);
  const byStage = (s: string) => (data ?? []).filter((d) => d.stage === s);

  const columns: Column<Deal>[] = [
    {
      key: 'code',
      header: 'Deal',
      cell: (d) => <span className="font-semibold whitespace-nowrap text-ink">{d.code}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (d) => (
        <div>
          <p className="font-semibold whitespace-nowrap text-ink">{d.customer_name}</p>
          <p className="text-[12px] text-stone-400">{d.customer_code}</p>
        </div>
      ),
    },
    {
      key: 'property',
      header: 'Property',
      cell: (d) => (
        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <PropertyThumb id={d.property_id} type={d.property_type} project={d.property_project} />
          <div>
            <p className="text-stone-700">{d.property_project}</p>
            <p className="text-[12px] text-stone-400">
              {d.property_unit} · {d.property_type}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'agent',
      header: 'Closed by',
      cell: (d) => <span className="whitespace-nowrap">{d.agent_name}</span>,
    },
    {
      key: 'date',
      header: 'Booked',
      cell: (d) => <span className="whitespace-nowrap text-stone-600">{fmtDate(d.booking_date)}</span>,
    },
    {
      key: 'value',
      header: 'Deal value',
      align: 'right',
      cell: (d) => <span className="num font-bold whitespace-nowrap text-ink">{inrShort(d.value)}</span>,
    },
    {
      key: 'collected',
      header: 'Collected',
      cell: (d) => (
        <div className="w-28">
          <p className="num text-[12.5px] font-semibold text-stone-700">{Math.round(((d.paid ?? 0) / d.value) * 100)}%</p>
          <Progress value={((d.paid ?? 0) / d.value) * 100} size="sm" className="mt-1" />
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (d) => <StatusBadge status={d.stage} />,
    },
  ];

  return (
    <div>
      <PageHeader title="Deals" subtitle="Every booking from token to possession" crumbs={[{ label: 'Home', to: '/' }, { label: 'Deals' }]} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DEAL_STAGES.map((s) => {
          const list = byStage(s);
          return (
            <button key={s} onClick={() => setStage(stage === s ? '' : s)} className={cn('card p-4 text-left transition-shadow hover:shadow-pop', stage === s && 'ring-2 ring-brand-600/40')}>
              <p className="text-[12.5px] font-semibold text-stone-500">{s}</p>
              <p className="mt-1 text-[24px] font-extrabold text-ink">{list.length}</p>
              <p className="text-[12px] text-stone-400">{inrShort(list.reduce((t, d) => t + d.value, 0))}</p>
            </button>
          );
        })}
      </div>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search deal, customer, project…" className="w-full sm:w-72" />
          <p className="hidden text-[13px] text-stone-500 sm:block">
            Total <b className="text-ink">{inr(rows.reduce((t, d) => t + d.value, 0))}</b>
          </p>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(d) => d.id}
            loading={isLoading}
            onRowClick={(d) => navigate(`/customers/${d.customer_id}`)}
            mobileCard={(d) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-bold text-ink">{d.customer_name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      {d.code} · {d.property_project} {d.property_unit}
                    </p>
                  </div>
                  <StatusBadge status={d.stage} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[12.5px]">
                  <span className="font-bold text-ink">{inrShort(d.value)}</span>
                  <span className="text-stone-500">{Math.round(((d.paid ?? 0) / d.value) * 100)}% collected</span>
                </div>
              </div>
            )}
            empty={<EmptyState icon={<Handshake />} title="No deals yet" message="Deals are created when a lead is converted to a customer." />}
          />
        )}
      </Card>
    </div>
  );
}
