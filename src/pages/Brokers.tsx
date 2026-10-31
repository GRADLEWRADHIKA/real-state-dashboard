import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BadgeIndianRupee, CircleCheck, Handshake, Info, MoreHorizontal, Pencil, Plus, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDate, inr, inrShort, todayStr } from '@/lib/format';
import { PAYMENT_METHODS, cn } from '@/lib/utils';
import { useAction, useDebounce, usePagedFilters } from '@/hooks/queries';
import { required, useForm, validPhone } from '@/hooks/useForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, Input, SearchInput, Select, Textarea } from '@/components/ui/Form';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Avatar, Menu, MenuItem, PageHeader, Tabs } from '@/components/ui/Misc';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/charts/Charts';
import type { Broker, BrokerCommission, Paged } from '@/types';

type Tab = 'brokers' | 'commissions';

/** Add or edit a broker (admin, manager). */
export function BrokerFormModal({ open, onClose, broker }: { open: boolean; onClose: () => void; broker?: Broker | null }) {
  const editing = !!broker;
  const f = useForm(
    {
      name: broker?.name ?? '',
      phone: broker?.phone ?? '',
      firm: broker?.firm ?? '',
      commission_pct: broker ? String(broker.commission_pct) : '1',
      status: (broker?.status ?? 'Active') as 'Active' | 'Inactive',
      notes: broker?.notes ?? '',
    },
    (v) => {
      const pct = Number(v.commission_pct);
      return {
        name: required(v.name),
        phone: v.phone ? validPhone(v.phone) : undefined,
        commission_pct: v.commission_pct === '' || Number.isNaN(pct) || pct < 0 || pct > 20 ? 'Enter a rate between 0 and 20%' : undefined,
      };
    },
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, broker?.id]);
  const save = useAction(
    (v: typeof f.values) => {
      const body = { ...v, commission_pct: Number(v.commission_pct), phone: v.phone || null, firm: v.firm || null, notes: v.notes || null };
      return editing ? api.put(`/brokers/${broker!.id}`, body) : api.post('/brokers', body);
    },
    { success: editing ? 'Broker updated' : 'Broker added', invalidate: [['brokers']], onSuccess: onClose },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${broker!.name}` : 'Add broker'}
      description="Commission is worked out on every payment from the broker’s customers"
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save' : 'Add broker'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" required error={f.errors.name}>
          {(id) => <Input id={id} autoFocus {...f.bind('name')} />}
        </Field>
        <Field label="Phone" error={f.errors.phone}>
          {(id) => <Input id={id} inputMode="tel" {...f.bind('phone')} />}
        </Field>
        <Field label="Firm">{(id) => <Input id={id} placeholder="e.g. Sharma Properties" {...f.bind('firm')} />}</Field>
        <Field label="Commission %" required error={f.errors.commission_pct} hint={editing ? 'A new rate applies to payments from now on' : '0 to 20% of each payment received'}>
          {(id) => <Input id={id} type="number" min={0} max={20} step="0.1" inputMode="decimal" {...f.bind('commission_pct')} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} {...f.bind('status')}>
              <option>Active</option>
              <option>Inactive</option>
            </Select>
          )}
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} {...f.bind('notes')} />}
        </Field>
      </div>
    </Modal>
  );
}

/** Records that a broker's commission was paid out (admin, accounts). */
export function PayCommissionModal({ commission, onClose }: { commission: BrokerCommission | null; onClose: () => void }) {
  const f = useForm({ paid_on: todayStr(), method: 'Bank Transfer' }, (v) => ({
    paid_on: required(v.paid_on) ?? (v.paid_on > todayStr() ? 'Cannot be in the future' : undefined),
  }));
  useEffect(() => {
    if (commission) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commission?.id]);
  const pay = useAction((v: typeof f.values) => api.post(`/brokers/commissions/${commission!.id}/pay`, v), {
    success: 'Commission marked paid',
    invalidate: [['brokers']],
    onSuccess: onClose,
  });
  return (
    <Modal
      open={!!commission}
      onClose={onClose}
      size="sm"
      title="Mark commission paid"
      description={commission ? `${inr(commission.amount)} to ${commission.broker_name}` : ''}
      onSubmit={() => f.submit((v) => pay.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy} icon={<CircleCheck />}>
            Mark paid
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {commission && (
          <p className="rounded-xl bg-stone-50 p-3 text-[13px] text-stone-600">
            {commission.pct}% of {inr(commission.payment_amount)} paid by <b className="text-ink">{commission.customer_name}</b>
            {commission.receipt_number ? ` (${commission.receipt_number})` : ''} on {fmtDate(commission.payment_date)}.
          </p>
        )}
        <Field label="Paid on" required error={f.errors.paid_on}>
          {(id) => <Input id={id} type="date" max={todayStr()} {...f.bind('paid_on')} />}
        </Field>
        <Field label="Method">
          {(id) => (
            <Select id={id} {...f.bind('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

/** Commission rows, shared by the Brokers page and the broker detail page. */
export function useCommissionColumns(onPay: ((c: BrokerCommission) => void) | null, showBroker = true): Column<BrokerCommission>[] {
  return useMemo<Column<BrokerCommission>[]>(
    () => [
      ...(showBroker
        ? [
            {
              key: 'broker',
              header: 'Broker',
              cell: (c: BrokerCommission) => (
                <Link to={`/brokers/${c.broker_id}`} className="font-semibold whitespace-nowrap text-ink hover:text-brand-800">
                  {c.broker_name}
                </Link>
              ),
            },
          ]
        : []),
      {
        key: 'customer',
        header: 'Customer',
        cell: (c) => (
          <Link to={`/customers/${c.customer_id}`} className="whitespace-nowrap hover:text-brand-800">
            <p className="font-semibold text-ink">{c.customer_name}</p>
            <p className="text-[12px] text-stone-400">{c.customer_code}</p>
          </Link>
        ),
      },
      {
        key: 'payment',
        header: 'Payment',
        cell: (c) => (
          <div className="whitespace-nowrap">
            <p className="num text-stone-700">{inr(c.payment_amount)}</p>
            <p className="text-[12px] text-stone-400">
              {c.receipt_number ?? '—'} · {fmtDate(c.payment_date)}
            </p>
          </div>
        ),
      },
      { key: 'pct', header: 'Rate', align: 'right', cell: (c) => <span className="num text-stone-600">{c.pct}%</span> },
      { key: 'amount', header: 'Commission', align: 'right', cell: (c) => <span className="num font-bold whitespace-nowrap text-ink">{inr(c.amount)}</span> },
      {
        key: 'status',
        header: 'Status',
        cell: (c) => (
          <div className="whitespace-nowrap">
            <Badge tone={c.status === 'Paid' ? 'green' : 'amber'}>{c.status}</Badge>
            {c.status === 'Paid' && (
              <p className="mt-0.5 text-[11.5px] text-stone-400">
                {fmtDate(c.paid_on)} · {c.paid_method}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (c) =>
          onPay && c.status === 'Due' ? (
            <Button size="sm" variant="subtle" icon={<CircleCheck />} onClick={() => onPay(c)}>
              Mark paid
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showBroker, !!onPay],
  );
}

export default function Brokers() {
  const me = useUser();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'commissions' ? 'commissions' : 'brokers';
  const canEdit = me.role === 'admin' || me.role === 'manager';
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader
        title="Brokers"
        subtitle="Channel partners who bring customers, and the commission they earn"
        crumbs={[{ label: 'Sales' }, { label: 'Brokers' }]}
        actions={
          canEdit && tab === 'brokers' ? (
            <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
              Add broker
            </Button>
          ) : undefined
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(v) => setParams(v === 'commissions' ? { tab: v } : {}, { replace: true })}
        tabs={[
          { value: 'brokers', label: 'Brokers' },
          { value: 'commissions', label: 'Commissions' },
        ]}
      />
      {tab === 'brokers' ? <BrokersTab canEdit={canEdit} /> : <CommissionsTab />}
      <BrokerFormModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function BrokersTab({ canEdit }: { canEdit: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [status, setStatus] = useState('');
  const [edit, setEdit] = useState<Broker | null>(null);
  const query = { q: dq, status };
  const [page, setPage] = usePagedFilters(query);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['brokers', query, page],
    queryFn: () => api.get<Paged<Broker>>('/brokers', { ...query, page, limit: 50 }),
    placeholderData: keepPreviousData,
  });
  const columns: Column<Broker>[] = [
    {
      key: 'name',
      header: 'Broker',
      cell: (b) => (
        <div className="flex items-center gap-3">
          <Avatar name={b.name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold whitespace-nowrap text-ink">{b.name}</p>
            <p className="text-[12px] text-stone-400">{b.firm ?? '—'}</p>
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone', cell: (b) => <span className="num whitespace-nowrap">{b.phone ?? '—'}</span> },
    { key: 'pct', header: 'Commission', align: 'right', cell: (b) => <span className="num font-semibold text-ink">{b.commission_pct}%</span> },
    { key: 'customers', header: 'Customers', align: 'right', cell: (b) => <span className="num">{b.customers_count ?? 0}</span> },
    { key: 'due', header: 'Due', align: 'right', cell: (b) => <span className={cn('num font-semibold whitespace-nowrap', b.commission_due ? 'text-amber-700' : 'text-stone-400')}>{inr(b.commission_due ?? 0)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', cell: (b) => <span className="num whitespace-nowrap text-stone-600">{inr(b.commission_paid ?? 0)}</span> },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (b) =>
        canEdit ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${b.name}`} icon={<MoreHorizontal />} />}>
              <MenuItem icon={<UserRound />} onSelect={() => navigate(`/brokers/${b.id}`)}>
                Open
              </MenuItem>
              <MenuItem icon={<Pencil />} onSelect={() => setEdit(b)}>
                Edit
              </MenuItem>
            </Menu>
          </div>
        ) : null,
    },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, firm or phone…" className="sm:w-80" />
        <FilterSelect value={status} onChange={setStatus} placeholder="Any status" options={['Active', 'Inactive']} className="sm:w-40" />
        {data && <p className="text-[13px] text-stone-500 sm:ml-auto">{data.meta.total} brokers</p>}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <DataTable
          rows={data?.data ?? []}
          columns={columns}
          rowKey={(b) => b.id}
          loading={isLoading}
          onRowClick={(b) => navigate(`/brokers/${b.id}`)}
          rowClassName={(b) => (b.status === 'Inactive' ? 'opacity-60' : undefined)}
          mobileCard={(b) => (
            <div className="flex items-center gap-3">
              <Avatar name={b.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold text-ink">{b.name}</p>
                <p className="truncate text-[12.5px] text-stone-500">
                  {b.commission_pct}% · {b.customers_count ?? 0} customers
                </p>
              </div>
              <div className="text-right">
                <p className="num text-[13.5px] font-bold text-amber-700">{inrShort(b.commission_due ?? 0)}</p>
                <p className="text-[11.5px] text-stone-400">due</p>
              </div>
            </div>
          )}
          empty={<EmptyState icon={<Handshake />} title="No brokers yet" message="Add the channel partners who bring you buyers, then pick the broker on each customer." />}
        />
      )}
      {data && <Pagination meta={data.meta} onPage={setPage} />}
      <BrokerFormModal open={!!edit} onClose={() => setEdit(null)} broker={edit} />
    </Card>
  );
}

function CommissionsTab() {
  const me = useUser();
  const canPay = me.role === 'admin' || me.role === 'accounts';
  const [status, setStatus] = useState('Due');
  const [broker, setBroker] = useState('');
  const [paying, setPaying] = useState<BrokerCommission | null>(null);
  const brokers = useQuery({
    queryKey: ['brokers', 'options'],
    queryFn: () => api.get<Paged<Broker>>('/brokers', { limit: 500 }),
  });
  const query = { status, broker };
  const [page, setPage] = usePagedFilters(query);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['brokers', 'commissions', query, page],
    queryFn: () => api.get<Paged<BrokerCommission, { totals: { due: number; paid: number } }>>('/brokers/commissions', { ...query, page, limit: 50 }),
    placeholderData: keepPreviousData,
  });
  const columns = useCommissionColumns(canPay ? setPaying : null);
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="Commission due" value={inrShort(data?.meta.totals.due ?? 0)} icon={<BadgeIndianRupee />} accent="gold" caption="Still to be paid to brokers" />
        <StatCard label="Commission paid" value={inrShort(data?.meta.totals.paid ?? 0)} icon={<CircleCheck />} caption="Paid out so far" />
      </div>
      <p className="mb-4 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3.5 py-2.5 text-[13px] text-brand-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        Commission is created automatically when a broker’s customer pays.
      </p>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect value={status} onChange={setStatus} placeholder="Due & paid" options={['Due', 'Paid']} />
            <FilterSelect value={broker} onChange={setBroker} placeholder="All brokers" options={(brokers.data?.data ?? []).map((b) => ({ value: String(b.id), label: b.name }))} />
          </div>
          {data && <p className="text-[13px] text-stone-500 sm:ml-auto">{data.meta.total} entries</p>}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(c) => c.id}
            loading={isLoading}
            mobileCard={(c) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{c.broker_name}</p>
                    <p className="truncate text-[12.5px] text-stone-500">
                      {c.customer_name} · {fmtDate(c.payment_date)}
                    </p>
                  </div>
                  <span className="num text-[14.5px] font-extrabold text-ink">{inr(c.amount)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <Badge tone={c.status === 'Paid' ? 'green' : 'amber'}>{c.status}</Badge>
                  {canPay && c.status === 'Due' && (
                    <Button size="sm" variant="subtle" onClick={() => setPaying(c)}>
                      Mark paid
                    </Button>
                  )}
                </div>
              </div>
            )}
            empty={<EmptyState icon={<BadgeIndianRupee />} title={status === 'Due' ? 'No commission due' : 'No commission found'} message="Commission is created automatically when a broker’s customer pays." />}
          />
        )}
        {data && <Pagination meta={data.meta} onPage={setPage} />}
      </Card>
      <PayCommissionModal commission={paying} onClose={() => setPaying(null)} />
    </div>
  );
}
