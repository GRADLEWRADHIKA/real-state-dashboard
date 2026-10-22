import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, IndianRupee, Plus, UserRound, Wallet, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fmtDate, inrShort, relativeDay, todayStr } from '@/lib/format';
import { cn, downloadCsv } from '@/lib/utils';
import { useDebounce, useProjects } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Form';
import { Badge, RegistryBadge, StatusBadge } from '@/components/ui/Badge';
import { Avatar, PageHeader, Progress } from '@/components/ui/Misc';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { StatCard } from '@/components/charts/Charts';
import { ConvertLeadModal } from '@/components/domain/FinanceForms';
import { useUser } from '@/lib/auth';
import type { Broker, Customer, Paged } from '@/types';

const REGISTRY_FILTER = [
  { value: 'pending', label: 'Registry pending' },
  { value: 'due15', label: 'Registry in 15 days' },
  { value: 'Not done', label: 'Registry not done' },
  { value: 'Date fixed', label: 'Registry date fixed' },
  { value: 'Done', label: 'Registry done' },
];

type Resp = Paged<
  Customer,
  {
    totals: {
      customers: number;
      value: number;
      paid: number;
      outstanding: number;
      overdue: number;
    };
  }
>;

export default function CustomersList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = useUser();
  const [booking, setBooking] = useState(false);
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const projects = useProjects().data ?? [];
  const brokers = useQuery({
    queryKey: ['brokers', 'filter'],
    queryFn: () => api.get<{ data: Broker[] }>('/brokers', { limit: 100 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  }).data;
  const get = (k: string) => params.get(k) ?? '';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const query = {
    q: dq,
    status: get('status'),
    payment: get('payment'),
    project: get('project'),
    registry: get('registry'),
    broker: get('broker'),
    sort: get('sort') || 'booking_date',
    order: get('order') || 'desc',
    page: Number(get('page') || 1),
    limit: 15,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', query],
    queryFn: () => api.get<Resp>('/customers', query),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<Column<Customer>[]>(
    () => [
      {
        key: 'name',
        header: 'Customer',
        sortKey: 'name',
        cell: (c) => (
          <div className="flex items-center gap-3">
            <Avatar name={c.name} size="sm" />
            <div>
              <p className="font-semibold whitespace-nowrap text-ink">{c.name}</p>
              <p className="text-[12px] text-stone-400">{c.code}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'contact',
        header: 'Contact',
        cell: (c) => (
          <div className="whitespace-nowrap">
            <p className="num">{c.phone}</p>
            <p className="max-w-[180px] truncate text-[12px] text-stone-400">{c.email}</p>
          </div>
        ),
      },
      {
        key: 'property',
        header: 'Property',
        cell: (c) => (
          <div className="whitespace-nowrap">
            <p className="font-medium text-stone-700">{c.property_project}</p>
            <p className="text-[12px] text-stone-400">
              {c.property_unit} · {c.property_type}
            </p>
          </div>
        ),
      },
      {
        key: 'booking',
        header: 'Booked',
        sortKey: 'booking_date',
        cell: (c) => <span className="whitespace-nowrap text-stone-600">{fmtDate(c.booking_date)}</span>,
      },
      {
        key: 'value',
        header: 'Total value',
        sortKey: 'total_value',
        align: 'right',
        cell: (c) => <span className="num font-semibold whitespace-nowrap text-ink">{inrShort(c.total_value)}</span>,
      },
      {
        key: 'paid',
        header: 'Paid',
        sortKey: 'paid',
        align: 'right',
        cell: (c) => <span className="num whitespace-nowrap text-brand-800">{inrShort(c.paid)}</span>,
      },
      {
        key: 'outstanding',
        header: 'Outstanding',
        sortKey: 'outstanding',
        cell: (c) => (
          <div className="w-32">
            <div className="flex justify-between text-[12.5px]">
              <span className="num font-bold text-ink">{inrShort(c.outstanding)}</span>
              <span className="text-stone-400">{Math.round((c.paid / c.total_value) * 100)}%</span>
            </div>
            <Progress value={(c.paid / c.total_value) * 100} size="sm" className="mt-1" />
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        cell: (c) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge status={c.status} />
            {c.overdue > 0 && <Badge tone="red">{inrShort(c.overdue)} overdue</Badge>}
          </div>
        ),
      },
      {
        key: 'registry',
        header: 'Registry',
        cell: (c) => (c.status === 'Cancelled' ? <span className="text-stone-400">—</span> : <RegistryBadge status={c.registry_status} date={c.registry_date} />),
      },
    ],
    [],
  );

  const exportCsv = async () => {
    const all = await api.get<Resp>('/customers', {
      ...query,
      page: 1,
      limit: 500,
    });
    downloadCsv(`customers-${todayStr()}.csv`, all.data as any, [
      { key: 'code', label: 'Customer ID' },
      { key: 'name', label: 'Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'email', label: 'Email' },
      {
        key: 'property',
        label: 'Property',
        value: (c: Customer) => `${c.property_project} ${c.property_unit}`,
      },
      { key: 'booking_date', label: 'Booking Date' },
      { key: 'total_value', label: 'Total Value' },
      { key: 'paid', label: 'Paid' },
      { key: 'outstanding', label: 'Outstanding' },
      { key: 'overdue', label: 'Overdue' },
      { key: 'status', label: 'Status' },
      { key: 'registry_status', label: 'Registry' },
      { key: 'registry_date', label: 'Registry Date' },
      { key: 'broker_name', label: 'Broker' },
    ]);
    toast.success(`Exported ${all.data.length} customers`);
  };

  const t = data?.meta.totals;
  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Bookings, balances and payment status for every buyer"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Customers' }]}
        actions={
          <>
            <Button icon={<Download />} onClick={exportCsv}>
              Export CSV
            </Button>
            {user.role !== 'accounts' && (
              <Button variant="primary" icon={<Plus />} onClick={() => setBooking(true)}>
                New booking
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Customers" value={t?.customers ?? '—'} icon={<Users />} caption={`${inrShort(t?.value ?? 0)} total booked value`} />
        <StatCard label="Collected" value={inrShort(t?.paid ?? 0)} icon={<IndianRupee />} caption={t ? `${Math.round((t.paid / Math.max(1, t.value)) * 100)}% of booked value` : undefined} />
        <StatCard label="Outstanding" value={inrShort(t?.outstanding ?? 0)} icon={<Wallet />} accent="gold" caption="Balance yet to be received" />
        <StatCard label="Overdue" value={inrShort(t?.overdue ?? 0)} icon={<AlertTriangle />} accent="red" caption="Past due date" onClick={() => setParam('payment', 'overdue')} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, customer ID, unit…" className="sm:w-80" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect value={get('status')} onChange={(v) => setParam('status', v)} placeholder="Any status" options={['Active', 'Completed', 'Cancelled']} />
            <FilterSelect
              value={get('payment')}
              onChange={(v) => setParam('payment', v)}
              placeholder="All payments"
              options={[
                { value: 'overdue', label: 'Has overdue' },
                { value: 'clear', label: 'No overdue' },
              ]}
            />
            <FilterSelect value={get('project')} onChange={(v) => setParam('project', v)} placeholder="All projects" options={projects} />
            <FilterSelect value={get('registry')} onChange={(v) => setParam('registry', v)} placeholder="Any registry" options={REGISTRY_FILTER} />
            {(!!brokers?.length || !!get('broker')) && (
              <FilterSelect
                value={get('broker')}
                onChange={(v) => setParam('broker', v)}
                placeholder="Any broker"
                options={brokers?.length ? brokers.map((b) => ({ value: String(b.id), label: b.name })) : [{ value: get('broker'), label: 'Selected broker' }]}
              />
            )}
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(c) => c.id}
            loading={isLoading}
            onRowClick={(c) => navigate(`/customers/${c.id}`)}
            sort={{ key: query.sort, order: query.order as 'asc' | 'desc' }}
            onSort={(s) => {
              const next = new URLSearchParams(params);
              next.set('sort', s.key);
              next.set('order', s.order);
              setParams(next, { replace: true });
            }}
            mobileCard={(c) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-bold text-ink">{c.name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      {c.property_project} · {c.property_unit}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[12.5px]">
                  <span className="text-stone-500">
                    Paid <b className="text-brand-800">{inrShort(c.paid)}</b> of {inrShort(c.total_value)}
                  </span>
                  <span className={cn('font-bold', c.overdue > 0 ? 'text-red-600' : 'text-ink')}>{c.overdue > 0 ? `${inrShort(c.overdue)} overdue` : `${inrShort(c.outstanding)} due`}</span>
                </div>
                <Progress value={(c.paid / c.total_value) * 100} size="sm" className="mt-1.5" />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-stone-400">{c.next_due_date ? `Next due ${relativeDay(c.next_due_date).toLowerCase()}` : ''}</p>
                  {c.status !== 'Cancelled' && <RegistryBadge status={c.registry_status} date={c.registry_date} />}
                </div>
              </div>
            )}
            empty={<EmptyState icon={<UserRound />} title="No customers found" message="Customers appear here once a lead is converted with a booking." />}
          />
        )}
        {data && <Pagination meta={data.meta} onPage={(p) => setParam('page', String(p))} />}
      </Card>
      {booking && <ConvertLeadModal open onClose={() => setBooking(false)} lead={null} />}
    </div>
  );
}
