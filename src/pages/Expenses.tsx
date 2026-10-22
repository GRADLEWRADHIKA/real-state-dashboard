import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, Download, MoreHorizontal, Pencil, Plus, ReceiptIndianRupee, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { EXPENSE_CATEGORIES } from '@estateflow/shared';
import { api } from '@/lib/api';
import { fmtDate, inr, inrShort, todayStr } from '@/lib/format';
import { PAYMENT_METHODS, SERIES, cn } from '@/lib/utils';
import { useAction, useDebounce } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, Input, MoneyInput, SearchInput, Select } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { Menu, MenuItem, PageHeader } from '@/components/ui/Misc';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { StatCard } from '@/components/charts/Charts';
import type { Expense, Paged } from '@/types';

type ExpenseMeta = {
  byCategory: { category: string; count: number; amount: number }[];
  totals: { total: number; today: number; month: number };
};

function ExpenseFormModal({ open, onClose, expense }: { open: boolean; onClose: () => void; expense?: Expense | null }) {
  const editing = !!expense;
  const f = useForm(
    {
      expense_date: expense?.expense_date ?? todayStr(),
      category: (expense?.category ?? 'Site') as string,
      description: expense?.description ?? '',
      amount: (expense?.amount ?? '') as number | '',
      method: expense?.method ?? 'Cash',
      paid_to: expense?.paid_to ?? '',
      reference: expense?.reference ?? '',
    },
    (v) => ({
      expense_date: required(v.expense_date) ?? (v.expense_date > todayStr() ? 'Cannot be in the future' : undefined),
      description: required(v.description),
      amount: !v.amount || Number(v.amount) <= 0 ? 'Enter the amount' : undefined,
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);
  const save = useAction(
    (v: typeof f.values) => {
      const body = { ...v, amount: Number(v.amount), paid_to: v.paid_to || null, reference: v.reference || null };
      return editing ? api.put(`/expenses/${expense!.id}`, body) : api.post('/expenses', body);
    },
    { success: editing ? 'Expense updated' : 'Expense recorded', invalidate: [['expenses']], onSuccess: onClose },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit expense' : 'Record expense'}
      description="Site and office spending"
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save' : 'Record expense'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" required error={f.errors.expense_date}>
          {(id) => <Input id={id} type="date" max={todayStr()} {...f.bind('expense_date')} />}
        </Field>
        <Field label="Category" required>
          {(id) => (
            <Select id={id} {...f.bind('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Description" required error={f.errors.description} className="sm:col-span-2">
          {(id) => <Input id={id} autoFocus placeholder="e.g. Boundary wall cement, 40 bags" {...f.bind('description')} />}
        </Field>
        <Field label="Amount" required error={f.errors.amount}>
          {(id) => <MoneyInput id={id} value={f.values.amount} onChange={(v) => f.set('amount', v)} aria-invalid={!!f.errors.amount} />}
        </Field>
        <Field label="Paid by">
          {(id) => (
            <Select id={id} {...f.bind('method')}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Paid to">{(id) => <Input id={id} placeholder="Vendor or person" {...f.bind('paid_to')} />}</Field>
        <Field label="Reference">{(id) => <Input id={id} placeholder="Bill no., UTR, cheque no." {...f.bind('reference')} />}</Field>
      </div>
    </Modal>
  );
}

export default function Expenses() {
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Expense | null>(null);
  const get = (k: string) => params.get(k) ?? '';
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };
  const filters = { category: get('category'), from: get('from'), to: get('to'), q: dq };
  const query = { ...filters, limit: 100 };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['expenses', query],
    queryFn: () => api.get<Paged<Expense, ExpenseMeta>>('/expenses', query),
    placeholderData: keepPreviousData,
  });
  const remove = useAction((id: number) => api.delete(`/expenses/${id}`), { success: 'Expense deleted', invalidate: [['expenses']] });
  const filtered = !!(filters.category || filters.from || filters.to || filters.q);

  const columns = useMemo<Column<Expense>[]>(
    () => [
      { key: 'date', header: 'Date', cell: (e) => <span className="whitespace-nowrap text-stone-600">{fmtDate(e.expense_date)}</span> },
      { key: 'category', header: 'Category', cell: (e) => <Badge tone="gray">{e.category}</Badge> },
      {
        key: 'description',
        header: 'Description',
        cell: (e) => (
          <div className="max-w-[320px]">
            <p className="truncate font-semibold text-ink">{e.description}</p>
            {e.paid_to && <p className="truncate text-[12px] text-stone-400">to {e.paid_to}</p>}
          </div>
        ),
      },
      { key: 'amount', header: 'Amount', align: 'right', cell: (e) => <span className="num font-bold whitespace-nowrap text-ink">{inr(e.amount)}</span> },
      { key: 'method', header: 'Method', cell: (e) => <span className="whitespace-nowrap">{e.method}</span> },
      { key: 'ref', header: 'Reference', cell: (e) => <span className="block max-w-[160px] truncate text-[12.5px] text-stone-500">{e.reference ?? '—'}</span> },
      { key: 'by', header: 'Recorded by', cell: (e) => <span className="whitespace-nowrap text-[12.5px] text-stone-500">{e.recorded_by_name ?? '—'}</span> },
      {
        key: 'actions',
        header: '',
        align: 'right',
        cell: (e) => (
          <div onClick={(ev) => ev.stopPropagation()}>
            <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label="Actions" icon={<MoreHorizontal />} />}>
              <MenuItem icon={<Pencil />} onSelect={() => setEdit(e)}>
                Edit
              </MenuItem>
              <MenuItem icon={<Trash2 />} danger onSelect={() => askDelete(e)}>
                Delete
              </MenuItem>
            </Menu>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  async function askDelete(e: Expense) {
    if (await confirm({ title: 'Delete this expense?', message: `${inr(e.amount)} · ${e.description} (${fmtDate(e.expense_date)}) will be removed.`, confirmLabel: 'Delete' })) remove.mutate(e.id);
  }

  const exportCsv = () =>
    api
      .download('/expenses/export.csv', `expenses-${todayStr()}.csv`, filters)
      .then(() => toast.success('Expenses exported'))
      .catch((e) => toast.error(e.message));

  const totals = data?.meta.totals;
  const cats = data?.meta.byCategory ?? [];
  const catMax = Math.max(1, ...cats.map((c) => c.amount));

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Site and office spending (kharcha)"
        crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Expenses' }]}
        actions={
          <>
            <Button icon={<Download />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>
              Record expense
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="Today" value={totals ? inrShort(totals.today) : '—'} icon={<CalendarDays />} caption={filtered ? 'Within the filters' : 'Spent today'} />
        <StatCard label="This month" value={totals ? inrShort(totals.month) : '—'} icon={<Wallet />} accent="gold" caption={filtered ? 'Within the filters' : 'Spent this month'} />
        <StatCard label={filtered ? 'Filtered total' : 'All time'} value={totals ? inrShort(totals.total) : '—'} icon={<ReceiptIndianRupee />} caption={`${data?.meta.total ?? 0} entries`} />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_300px]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
            <SearchInput value={q} onChange={setQ} placeholder="Search description, paid to, reference…" className="sm:w-72" />
            <FilterSelect value={get('category')} onChange={(v) => setParam('category', v)} placeholder="All categories" options={[...EXPENSE_CATEGORIES]} />
            <div className="flex items-center gap-2">
              <Input type="date" aria-label="From date" value={get('from')} max={get('to') || undefined} onChange={(e) => setParam('from', e.target.value)} className="h-10 w-auto text-[13px] sm:h-9" />
              <span className="text-[12px] text-stone-400">to</span>
              <Input type="date" aria-label="To date" value={get('to')} min={get('from') || undefined} onChange={(e) => setParam('to', e.target.value)} className="h-10 w-auto text-[13px] sm:h-9" />
            </div>
          </div>
          {error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : (
            <DataTable
              rows={data?.data ?? []}
              columns={columns}
              rowKey={(e) => e.id}
              loading={isLoading}
              onRowClick={setEdit}
              mobileCard={(e) => (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-bold text-ink">{e.description}</p>
                      <p className="text-[12.5px] text-stone-500">
                        {e.category} · {e.method} · {fmtDate(e.expense_date)}
                      </p>
                    </div>
                    <span className="num text-[14.5px] font-extrabold text-ink">{inrShort(e.amount)}</span>
                  </div>
                </div>
              )}
              empty={<EmptyState icon={<ReceiptIndianRupee />} title={filtered ? 'No expenses match' : 'No expenses yet'} message="Record site and office spending to see where the money goes." />}
            />
          )}
          {data && data.meta.total > data.data.length && <p className="border-t border-stone-100 px-5 py-3 text-[12.5px] text-stone-500">Showing the latest {data.data.length} of {data.meta.total}. Narrow the dates or export CSV for all.</p>}
        </Card>
        <Card className="self-start">
          <CardHeader title="By category" subtitle={filtered ? 'Within the filters' : 'All time'} />
          <div className="space-y-3.5 px-5 pb-5">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)
            ) : cats.length ? (
              cats.map((c, i) => (
                <button key={c.category} type="button" onClick={() => setParam('category', get('category') === c.category ? '' : c.category)} className={cn('block w-full rounded-lg text-left', get('category') === c.category && 'ring-2 ring-brand-600/30 ring-offset-4')}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-semibold text-ink">{c.category}</span>
                    <span className="num font-bold text-ink">{inrShort(c.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full" style={{ width: `${(c.amount / catMax) * 100}%`, background: SERIES[i % SERIES.length] }} />
                  </div>
                  <p className="mt-1 text-[11.5px] text-stone-400">
                    {c.count} {c.count === 1 ? 'entry' : 'entries'}
                  </p>
                </button>
              ))
            ) : (
              <p className="text-[13px] text-stone-500">Nothing recorded yet.</p>
            )}
          </div>
        </Card>
      </div>
      <ExpenseFormModal open={adding} onClose={() => setAdding(false)} />
      <ExpenseFormModal open={!!edit} onClose={() => setEdit(null)} expense={edit} />
    </div>
  );
}
