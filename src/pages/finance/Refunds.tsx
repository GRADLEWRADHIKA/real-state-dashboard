import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, Inbox, ReceiptText, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDate, inr, inrShort } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Misc';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { StatCard } from '@/components/charts/Charts';
import { RecordRefundModal, canRecordRefund, downloadRefundReceipt } from '@/components/domain/RefundForms';
import type { PendingRefund, Refund, RefundsResponse } from '@/types';

export default function Refunds() {
  const user = useUser();
  const canRecord = canRecordRefund(user.role);
  const [recording, setRecording] = useState<PendingRefund | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['refunds', 'list', page],
    queryFn: () => api.get<RefundsResponse>('/refunds', { page, limit: 50 }),
    placeholderData: keepPreviousData,
  });
  const pending = data?.meta.pending ?? [];
  const openTotal = pending.reduce((s, p) => s + p.open, 0);

  const queueCols: Column<PendingRefund>[] = [
    {
      key: 'customer',
      header: 'Customer',
      cell: (c) => (
        <Link to={`/customers/${c.id}`} className="block" onClick={(e) => e.stopPropagation()}>
          <p className="font-semibold whitespace-nowrap text-ink hover:text-brand-800">{c.name}</p>
          <p className="text-[12px] text-stone-400">{c.code}</p>
        </Link>
      ),
    },
    { key: 'unit', header: 'Unit', cell: (c) => <span className="whitespace-nowrap">{c.property_project ? `${c.property_project} · ${c.property_unit ?? ''}` : '—'}</span> },
    {
      key: 'cancelled',
      header: 'Cancelled',
      cell: (c) => (
        <div>
          <p className="whitespace-nowrap">{c.cancelled_at ? fmtDate(c.cancelled_at) : '—'}</p>
          {c.cancel_reason && <p className="max-w-[220px] truncate text-[12px] text-stone-400">{c.cancel_reason}</p>}
        </div>
      ),
    },
    { key: 'paid', header: 'Paid', align: 'right', cell: (c) => <span className="num whitespace-nowrap">{inr(c.paid)}</span> },
    { key: 'settled', header: 'Settled', align: 'right', cell: (c) => <span className="num whitespace-nowrap text-stone-500">{inr(c.settled)}</span> },
    { key: 'open', header: 'To refund', align: 'right', cell: (c) => <span className="num font-bold whitespace-nowrap text-amber-700">{inr(c.open)}</span> },
    ...(canRecord
      ? [
          {
            key: 'act',
            header: '',
            align: 'right' as const,
            cell: (c: PendingRefund) => (
              <Button size="sm" variant="primary" icon={<Undo2 />} onClick={() => setRecording(c)}>
                Record refund
              </Button>
            ),
          },
        ]
      : []),
  ];

  const ledgerCols: Column<Refund>[] = [
    { key: 'no', header: 'Receipt', cell: (r) => <span className="num font-semibold whitespace-nowrap text-ink">{r.receipt_number}</span> },
    { key: 'date', header: 'Date', cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.refund_date)}</span> },
    {
      key: 'customer',
      header: 'Customer',
      cell: (r) => (
        <Link to={`/customers/${r.customer_id}`} className="font-semibold whitespace-nowrap text-ink hover:text-brand-800">
          {r.customer_name}
        </Link>
      ),
    },
    { key: 'unit', header: 'Unit', cell: (r) => <span className="whitespace-nowrap text-stone-600">{r.property_project ? `${r.property_project} · ${r.property_unit ?? ''}` : '—'}</span> },
    {
      key: 'deduction',
      header: 'Deduction',
      align: 'right',
      cell: (r) => (r.deduction ? <span className="num whitespace-nowrap" title={r.deduction_reason ?? undefined}>{inr(r.deduction)}</span> : <span className="text-stone-400">—</span>),
    },
    { key: 'amount', header: 'Refunded', align: 'right', cell: (r) => <span className="num font-bold whitespace-nowrap text-ink">{inr(r.refund_amount)}</span> },
    { key: 'method', header: 'Method', cell: (r) => <span className="whitespace-nowrap text-stone-600">{r.method}</span> },
    {
      key: 'pdf',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button size="sm" variant="ghost" icon={<Download />} onClick={() => downloadRefundReceipt(r)} aria-label={`Download receipt ${r.receipt_number}`}>
          PDF
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Refunds" subtitle="Money returned on cancelled bookings, with a receipt for each refund" crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Refunds' }]} />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <StatCard label="Waiting for refund" value={inrShort(openTotal)} icon={<Inbox />} accent="gold" caption={`${pending.length} cancelled booking${pending.length === 1 ? '' : 's'}`} />
            <StatCard label="Refunded" value={inrShort(data?.meta.totals.refunded ?? 0)} icon={<Undo2 />} caption={`${data?.meta.total ?? 0} refunds`} />
            <StatCard label="Deductions kept" value={inrShort(data?.meta.totals.deducted ?? 0)} icon={<ReceiptText />} caption="Cancellation charges" />
          </div>

          <Card className="overflow-hidden" data-testid="refund-queue">
            <CardHeader title="Refund queue" subtitle="Cancelled bookings with money still to return" icon={<Inbox />} />
            <DataTable
              rows={pending}
              columns={queueCols}
              rowKey={(c) => c.id}
              loading={isLoading}
              mobileCard={(c) => (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/customers/${c.id}`} className="text-[14px] font-bold text-ink">
                      {c.name}
                    </Link>
                    <span className="num font-bold text-amber-700">{inr(c.open)}</span>
                  </div>
                  <p className="text-[12.5px] text-stone-500">
                    {c.property_project} {c.property_unit} · paid {inr(c.paid)}
                  </p>
                  {canRecord && (
                    <Button size="sm" variant="primary" className="mt-2" icon={<Undo2 />} onClick={() => setRecording(c)}>
                      Record refund
                    </Button>
                  )}
                </div>
              )}
              empty={<EmptyState compact icon={<Inbox />} title="Nothing to refund" message="Cancelled bookings with money paid appear here." />}
            />
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Refund ledger" subtitle="Newest first" icon={<ReceiptText />} />
            <DataTable
              rows={data?.data ?? []}
              columns={ledgerCols}
              rowKey={(r) => r.id}
              loading={isLoading}
              mobileCard={(r) => (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-bold text-ink">{r.customer_name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      {r.receipt_number} · {fmtDate(r.refund_date)} · {r.method}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num font-bold text-ink">{inr(r.refund_amount)}</p>
                    <button className="text-[12.5px] font-semibold text-brand-800" onClick={() => downloadRefundReceipt(r)}>
                      PDF
                    </button>
                  </div>
                </div>
              )}
              empty={<EmptyState compact icon={<ReceiptText />} title="No refunds recorded yet" />}
            />
            {data && <Pagination meta={data.meta} onPage={setPage} />}
          </Card>
        </div>
      )}
      {canRecord && <RecordRefundModal open={!!recording} onClose={() => setRecording(null)} customer={recording} />}
    </div>
  );
}
