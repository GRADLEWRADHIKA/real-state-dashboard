import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Plus, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDate, inr, todayStr } from '@/lib/format';
import { PAYMENT_METHODS, cn } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import type { CustomerRefunds, Refund } from '@/types';

export const canRecordRefund = (role: string) => role === 'admin' || role === 'accounts';

export async function downloadRefundReceipt(r: Pick<Refund, 'id' | 'receipt_number'>) {
  try {
    await api.download(`/refunds/${r.id}/receipt.pdf`, `${(r.receipt_number ?? `refund-${r.id}`).replace(/\//g, '-')}.pdf`);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Could not download the receipt');
  }
}

/** Record the refund on a cancelled booking: deduction (with reason), method and date; refund = open − deduction. */
export function RecordRefundModal({ open, onClose, customer }: { open: boolean; onClose: () => void; customer: { id: number; name: string; paid: number; settled: number; open: number } | null }) {
  const f = useForm(
    { deduction: 0 as number | '', deduction_reason: '', method: 'Bank Transfer', reference: '', refund_date: todayStr(), notes: '' },
    (v) => ({
      deduction: customer && Number(v.deduction || 0) > customer.open ? `Cannot be more than ${inr(customer.open)}` : undefined,
      deduction_reason: Number(v.deduction || 0) > 0 ? required(v.deduction_reason) && 'Say why the deduction is kept' : undefined,
      refund_date: required(v.refund_date) ?? (v.refund_date > todayStr() ? 'Cannot be in the future' : undefined),
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(
    (v: typeof f.values) =>
      api.post<Refund>(`/refunds/customer/${customer!.id}`, {
        deduction: Number(v.deduction || 0),
        deduction_reason: v.deduction_reason.trim() || null,
        method: v.method,
        reference: v.reference.trim() || null,
        refund_date: v.refund_date,
        notes: v.notes.trim() || null,
      }),
    {
      success: (r) => `Refund ${r.receipt_number ?? ''} recorded: ${inr(r.refund_amount)}`,
      onSuccess: onClose,
    },
  );
  if (!customer) return null;
  const deduction = Number(f.values.deduction || 0);
  const refund = Math.max(0, customer.open - deduction);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record refund"
      description={`${customer.name} · cancelled booking`}
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy} disabled={customer.open <= 0}>
            Record refund of {inr(refund)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <dl className="grid grid-cols-3 gap-2 rounded-xl border border-stone-100 bg-stone-50/70 p-3.5 text-center">
          <div>
            <dt className="text-[11.5px] font-semibold text-stone-500">Paid</dt>
            <dd className="num text-[14px] font-bold text-ink">{inr(customer.paid)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-semibold text-stone-500">Already settled</dt>
            <dd className="num text-[14px] font-bold text-ink">{inr(customer.settled)}</dd>
          </div>
          <div>
            <dt className="text-[11.5px] font-semibold text-stone-500">Open</dt>
            <dd className="num text-[14px] font-bold text-brand-800">{inr(customer.open)}</dd>
          </div>
        </dl>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Deduction" error={f.errors.deduction} hint="Cancellation charges kept, if any">
            {(id) => <MoneyInput id={id} value={f.values.deduction} onChange={(v) => f.set('deduction', v)} aria-invalid={!!f.errors.deduction} />}
          </Field>
          <Field label="Reason for deduction" required={deduction > 0} error={f.errors.deduction_reason}>
            {(id) => <Input id={id} placeholder="e.g. 10% cancellation charge as per agreement" disabled={deduction <= 0} {...f.bind('deduction_reason')} />}
          </Field>
          <Field label="Method" required>
            {(id) => (
              <Select id={id} {...f.bind('method')}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reference">{(id) => <Input id={id} placeholder="UTR / cheque no." {...f.bind('reference')} />}</Field>
          <Field label="Refund date" required error={f.errors.refund_date}>
            {(id) => <Input id={id} type="date" max={todayStr()} {...f.bind('refund_date')} />}
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} {...f.bind('notes')} />}
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-brand-950 px-4 py-3 text-white" data-testid="refund-amount">
          <span className="text-[13px] font-semibold text-brand-100/80">Refund to customer</span>
          <span className={cn('num text-[20px] font-extrabold', deduction > customer.open && 'text-red-300')}>{inr(refund)}</span>
        </div>
      </div>
    </Modal>
  );
}

export function RefundList({ refunds }: { refunds: Refund[] }) {
  if (!refunds.length) return <EmptyState compact icon={<Undo2 />} title="No refunds yet" />;
  return (
    <ul className="divide-y divide-stone-100 border-t border-stone-100">
      {refunds.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">
              {inr(r.refund_amount)} <span className="font-normal text-stone-500">via {r.method}</span>
            </p>
            <p className="text-[12px] text-stone-500">
              {r.receipt_number} · {fmtDate(r.refund_date)}
              {r.deduction ? ` · ${inr(r.deduction)} deducted (${r.deduction_reason})` : ''}
            </p>
          </div>
          <Button size="sm" variant="ghost" icon={<Download />} onClick={() => downloadRefundReceipt(r)}>
            Receipt
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Customer page card for a cancelled booking: paid / settled / open, refunds and Record refund. */
export function RefundCard({ customer }: { customer: { id: number; name: string } }) {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['refunds', 'customer', customer.id],
    queryFn: () => api.get<CustomerRefunds>(`/refunds/customer/${customer.id}`),
  });
  const m = data?.meta;
  return (
    <Card className="overflow-hidden" data-testid="refund-card">
      <CardHeader
        title="Refund"
        subtitle="Money paid on this cancelled booking"
        icon={<Undo2 />}
        action={
          canRecordRefund(user.role) &&
          m &&
          m.open > 0 && (
            <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
              Record refund
            </Button>
          )
        }
      />
      {isLoading || !m ? (
        <div className="px-5 pb-5">
          <Skeleton className="h-14" />
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3 px-5 pb-4">
            <div>
              <dt className="text-[12px] font-medium text-stone-500">Paid</dt>
              <dd className="num text-[15px] font-bold text-ink">{inr(m.paid)}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium text-stone-500">Settled</dt>
              <dd className="num text-[15px] font-bold text-ink">{inr(m.settled)}</dd>
            </div>
            <div>
              <dt className="text-[12px] font-medium text-stone-500">Open</dt>
              <dd className={cn('num text-[15px] font-bold', m.open > 0 ? 'text-amber-700' : 'text-emerald-700')}>{inr(m.open)}</dd>
            </div>
          </dl>
          <RefundList refunds={data.data} />
        </>
      )}
      <RecordRefundModal open={open} onClose={() => setOpen(false)} customer={m ? { id: customer.id, name: customer.name, ...m } : null} />
    </Card>
  );
}
