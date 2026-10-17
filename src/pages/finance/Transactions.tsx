import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, CheckCircle2, Download, IndianRupee, MoreHorizontal, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fmtDate, inr, inrShort, todayStr } from '@/lib/format';
import { PAYMENT_METHODS, cn, downloadCsv } from '@/lib/utils';
import { useAction, useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, SearchInput, Select } from '@/components/ui/Form';
import { StatusBadge } from '@/components/ui/Badge';
import { Menu, MenuItem, PageHeader } from '@/components/ui/Misc';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { RecordPaymentModal } from '@/components/domain/FinanceForms';
import type { Customer, Installment, Paged, Transaction } from '@/types';

const PERIODS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

/** Step 1 of recording a payment from the ledger: pick customer and installment. */
function NewPaymentModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (i: Installment, customer: string) => void }) {
  const [customerId, setCustomerId] = useState('');
  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: () =>
      api.get<Paged<Customer>>('/customers', {
        limit: 500,
        sort: 'name',
        order: 'asc',
        status: 'Active',
      }),
    enabled: open,
  });
  const insts = useQuery({
    queryKey: ['installments', 'customer', customerId],
    queryFn: () =>
      api.get<{ data: Installment[] }>('/installments', {
        customer: customerId,
      }),
    enabled: !!customerId,
  });
  const open_ = (insts.data?.data ?? []).filter((i) => i.balance > 0);
  const [instId, setInstId] = useState('');
  const customer = customers.data?.data.find((c) => String(c.id) === customerId);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a payment"
      description="Choose the customer and the installment being paid"
      onSubmit={() => {
        const i = open_.find((x) => String(x.id) === instId) ?? open_[0];
        if (!i || !customer) return toast.error('Select a customer with an outstanding installment');
        onPick(i, customer.name);
      }}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!customerId || !open_.length}>
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Customer">
          {(id) => (
            <Select
              id={id}
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setInstId('');
              }}
            >
              <option value="">Select customer</option>
              {customers.data?.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.property_project} {c.property_unit} ({inrShort(c.outstanding)} due)
                </option>
              ))}
            </Select>
          )}
        </Field>
        {customerId && (
          <Field label="Installment" hint={insts.isLoading ? 'Loading schedule…' : !open_.length ? 'No outstanding installments' : undefined}>
            {(id) => (
              <Select id={id} value={instId || String(open_[0]?.id ?? '')} onChange={(e) => setInstId(e.target.value)}>
                {open_.map((i) => (
                  <option key={i.id} value={i.id}>
                    #{i.number} {i.label} · due {fmtDate(i.due_date)} · balance {inr(i.balance)} {i.status === 'Overdue' ? '(Overdue)' : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
    </Modal>
  );
}

export default function Transactions() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [picker, setPicker] = useState(false);
  const [pay, setPay] = useState<{ inst: Installment; name: string } | null>(null);
  const get = (k: string) => params.get(k) ?? '';
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setParams(n, { replace: true });
  };
  const query = {
    q: dq,
    method: get('method'),
    status: get('status'),
    type: get('type'),
    from: get('period') ? todayStr(-Number(get('period'))) : undefined,
    page: Number(get('page') || 1),
    limit: 15,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', query],
    queryFn: () => api.get<Paged<Transaction, { totals: { completed: number; pending: number; failed: number } }>>('/transactions', query),
    placeholderData: keepPreviousData,
  });
  const setStatus = useAction((v: { id: number; status: string }) => api.patch(`/transactions/${v.id}/status`, { status: v.status }), {
    success: (r: any) => (r.status === 'Completed' ? 'Payment cleared' : `Marked ${r.status.toLowerCase()}`),
  });

  const columns = useMemo<Column<Transaction>[]>(
    () => [
      {
        key: 'id',
        header: 'Transaction',
        cell: (t) => (
          <div className="whitespace-nowrap">
            <p className="font-semibold text-ink">{t.code}</p>
            <p className="text-[12px] text-stone-400">{t.receipt_number ?? 'No receipt'}</p>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer',
        cell: (t) => (
          <Link to={`/customers/${t.customer_id}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap hover:text-brand-800">
            <p className="font-semibold text-ink">{t.customer_name}</p>
            <p className="text-[12px] text-stone-400">
              {t.property_project} · {t.property_unit}
            </p>
          </Link>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        cell: (t) => (
          <div className="whitespace-nowrap">
            <p className="text-stone-700">{t.type}</p>
            <p className="text-[12px] text-stone-400">{t.installment_label}</p>
          </div>
        ),
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right',
        cell: (t) => <span className={cn('num font-bold whitespace-nowrap', t.status === 'Failed' ? 'text-stone-400 line-through' : 'text-ink')}>{inr(t.amount)}</span>,
      },
      {
        key: 'method',
        header: 'Method',
        cell: (t) => <span className="whitespace-nowrap">{t.method}</span>,
      },
      {
        key: 'date',
        header: 'Date',
        cell: (t) => <span className="whitespace-nowrap text-stone-600">{fmtDate(t.payment_date)}</span>,
      },
      {
        key: 'ref',
        header: 'Reference',
        cell: (t) => <span className="block max-w-[180px] truncate text-[12.5px] text-stone-500">{t.reference ?? '—'}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        cell: (t) => <StatusBadge status={t.status} />,
      },
      {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (t) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label="Actions" icon={<MoreHorizontal />} />}>
              {t.status === 'Completed' && (
                <MenuItem icon={<Receipt />} onSelect={() => navigate(`/receipts/${t.id}`)}>
                  View receipt
                </MenuItem>
              )}
              {t.status === 'Pending' && (
                <MenuItem icon={<CheckCircle2 />} onSelect={() => setStatus.mutate({ id: t.id, status: 'Completed' })}>
                  Mark cleared
                </MenuItem>
              )}
              {t.status !== 'Failed' && (
                <MenuItem
                  icon={<Ban />}
                  danger
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: 'Mark payment as failed?',
                        message: `${inr(t.amount)} from ${t.customer_name} will be reversed from the installment balance.`,
                        confirmLabel: 'Mark failed',
                      })
                    )
                      setStatus.mutate({ id: t.id, status: 'Failed' });
                  }}
                >
                  Mark failed / bounced
                </MenuItem>
              )}
            </Menu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const exportCsv = async () => {
    const all = await api.get<Paged<Transaction>>('/transactions', {
      ...query,
      page: 1,
      limit: 500,
    });
    downloadCsv(`transactions-${todayStr()}.csv`, all.data as any, [
      { key: 'code', label: 'Transaction ID' },
      { key: 'receipt_number', label: 'Receipt No' },
      { key: 'customer_name', label: 'Customer' },
      {
        key: 'property',
        label: 'Property',
        value: (t: Transaction) => `${t.property_project} ${t.property_unit}`,
      },
      { key: 'type', label: 'Type' },
      { key: 'installment_label', label: 'Installment' },
      { key: 'amount', label: 'Amount' },
      { key: 'method', label: 'Payment Method' },
      { key: 'payment_date', label: 'Payment Date' },
      { key: 'reference', label: 'Reference Number' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ]);
    toast.success(`Exported ${all.data.length} transactions`);
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Every payment received, pending clearance or failed"
        crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Transactions' }]}
        actions={
          <>
            <Button icon={<Download />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<IndianRupee />} onClick={() => setPicker(true)}>
              Record payment
            </Button>
          </>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search customer, receipt, UTR, unit…" className="sm:w-80" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect value={get('method')} onChange={(v) => setParam('method', v)} placeholder="All methods" options={[...PAYMENT_METHODS]} />
            <FilterSelect value={get('status')} onChange={(v) => setParam('status', v)} placeholder="Any status" options={['Completed', 'Pending', 'Failed']} />
            <FilterSelect value={get('type')} onChange={(v) => setParam('type', v)} placeholder="All types" options={['Booking Amount', 'Installment']} />
            <FilterSelect value={get('period')} onChange={(v) => setParam('period', v)} placeholder="All time" options={PERIODS} />
          </div>
          {data && (
            <p className="text-[13px] text-stone-500 sm:ml-auto">
              <b className="text-ink">{inr(data.meta.totals.completed)}</b> received
              {data.meta.totals.pending > 0 && (
                <>
                  {' · '}
                  <b className="text-amber-700">{inr(data.meta.totals.pending)}</b> pending
                </>
              )}
            </p>
          )}
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(t) => t.id}
            loading={isLoading}
            onRowClick={(t) => navigate(t.status === 'Completed' ? `/receipts/${t.id}` : `/customers/${t.customer_id}`)}
            mobileCard={(t) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{t.customer_name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      {t.method} · {fmtDate(t.payment_date)}
                    </p>
                  </div>
                  <span className="num text-[14.5px] font-extrabold text-ink">{inrShort(t.amount)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="truncate text-[12px] text-stone-400">{t.receipt_number ?? t.code}</span>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            )}
            empty={<EmptyState icon={<Receipt />} title="No transactions found" message="Payments appear here as soon as they are recorded against an installment." />}
          />
        )}
        {data && <Pagination meta={data.meta} onPage={(p) => setParam('page', String(p))} />}
      </Card>
      <NewPaymentModal
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(inst, name) => {
          setPicker(false);
          setPay({ inst, name });
        }}
      />
      <RecordPaymentModal open={!!pay} onClose={() => setPay(null)} installment={pay?.inst ?? null} customerName={pay?.name} />
    </div>
  );
}
