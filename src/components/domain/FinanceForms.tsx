import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { CircleCheck, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, inr, inrShort, todayStr } from '@/lib/format';
import { PAYMENT_METHODS, cn } from '@/lib/utils';
import { addMonths, buildSchedule } from '@estateflow/shared';
import { useUser } from '@/lib/auth';
import { useAction, useAgents, usePropertyOptions } from '@/hooks/queries';
import { required, useForm, validPhone } from '@/hooks/useForm';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import type { Installment, Lead } from '@/types';

/**
 * Books a unit: converts a lead, or (with no lead) records a direct booking for a walk-in buyer.
 * Creates the customer, deal and installment schedule in one step.
 */
export function ConvertLeadModal({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead | null }) {
  const navigate = useNavigate();
  const user = useUser();
  const agents = useAgents();
  const props = usePropertyOptions();
  const options = (props.data ?? []).filter((p) => p.status === 'Available' || p.status === 'Reserved');
  const f = useForm(
    {
      name: lead?.name ?? '',
      assigned_to: user.role === 'sales' ? String(user.id) : '',
      property_id: lead?.property_id ? String(lead.property_id) : '',
      total_value: (lead?.property_price ?? lead?.budget ?? '') as number | '',
      booking_amount: (lead?.property_price ? Math.round(lead.property_price * 0.1) : '') as number | '',
      booking_date: todayStr(),
      installments_count: '6',
      frequency_months: '2',
      first_due_date: addMonths(todayStr(), 1),
      phone: lead?.phone ?? '',
      email: lead?.email ?? '',
      address: '',
      city: 'Lucknow',
      occupation: '',
      pan: '',
      aadhaar: '',
      record_booking_payment: true,
      booking_method: 'Bank Transfer',
      booking_reference: '',
    },
    (v) => ({
      name: lead ? undefined : required(v.name),
      phone: lead ? undefined : (required(v.phone) ?? validPhone(v.phone)),
      property_id: required(v.property_id),
      total_value: required(v.total_value),
      booking_amount: required(v.booking_amount) ?? (Number(v.booking_amount) >= Number(v.total_value) ? 'Must be less than the deal value' : undefined),
      first_due_date: v.first_due_date <= v.booking_date ? 'Must be after the booking date' : undefined,
      pan: v.pan && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(v.pan) ? 'Format: ABCDE1234F' : undefined,
      aadhaar: v.aadhaar && !/^[0-9 ]{12,14}$/.test(v.aadhaar) ? 'Enter 12 digits' : undefined,
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const v = f.values;
  const schedule = useMemo(
    () =>
      v.total_value && v.booking_amount && Number(v.booking_amount) < Number(v.total_value)
        ? buildSchedule({
            total_value: Number(v.total_value),
            booking_amount: Number(v.booking_amount),
            installments_count: Number(v.installments_count),
            frequency_months: Number(v.frequency_months),
            first_due_date: v.first_due_date,
            booking_date: v.booking_date,
          })
        : [],
    [v.total_value, v.booking_amount, v.installments_count, v.frequency_months, v.first_due_date, v.booking_date],
  );
  const property = options.find((p) => String(p.id) === v.property_id) ?? props.data?.find((p) => String(p.id) === v.property_id);
  const convert = useAction(
    async ({ name, assigned_to, ...val }: typeof v) => {
      const body = {
        ...val,
        property_id: Number(val.property_id),
        installments_count: Number(val.installments_count),
        frequency_months: Number(val.frequency_months),
        booking_reference: val.booking_reference || null,
      };
      if (lead) return (await api.post<{ customer_id: number }>(`/leads/${lead.id}/convert`, body)).customer_id;
      return (
        await api.post<{ id: number }>('/customers', {
          ...body,
          name,
          assigned_to: assigned_to ? Number(assigned_to) : null,
        })
      ).id;
    },
    {
      success: lead ? `${lead.name} is now a customer` : 'Booking created',
      onSuccess: (id) => {
        onClose();
        navigate(`/customers/${id}`);
      },
    },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-5 text-gold-500" /> {lead ? `Convert ${lead.name} to customer` : 'New booking'}
        </span>
      }
      description={lead ? 'Creates the customer, deal and installment schedule in one step, and marks the unit as booked.' : 'For a buyer who never came in as a lead. Creates the customer, deal and installment schedule, and marks the unit as booked.'}
      onSubmit={() => f.submit((val) => convert.mutateAsync(val))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy} icon={<CircleCheck />}>
            Confirm booking
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section>
            <p className="label-xs mb-3">Booking</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Unit" required error={f.errors.property_id} className="sm:col-span-2">
                {(id) => (
                  <Select
                    id={id}
                    value={v.property_id}
                    aria-invalid={!!f.errors.property_id}
                    onChange={(e) => {
                      f.set('property_id', e.target.value);
                      const p = options.find((x) => String(x.id) === e.target.value);
                      if (p) {
                        f.set('total_value', p.price);
                        f.set('booking_amount', Math.round(p.price * 0.1));
                      }
                    }}
                  >
                    <option value="">Select an available unit</option>
                    {options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project} · {p.unit_number} — {p.name} · {inrShort(p.price)} {p.status === 'Reserved' ? '(Reserved)' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Agreed deal value" required error={f.errors.total_value} hint={property && Number(v.total_value) < property.price ? `Discount ${inr(property.price - Number(v.total_value))} on list price` : undefined}>
                {(id) => <MoneyInput id={id} value={v.total_value} onChange={(x) => f.set('total_value', x)} aria-invalid={!!f.errors.total_value} />}
              </Field>
              <Field label="Booking amount" required error={f.errors.booking_amount} hint={v.total_value && v.booking_amount ? `${((Number(v.booking_amount) / Number(v.total_value)) * 100).toFixed(1)}% of deal value` : undefined}>
                {(id) => <MoneyInput id={id} value={v.booking_amount} onChange={(x) => f.set('booking_amount', x)} aria-invalid={!!f.errors.booking_amount} />}
              </Field>
              <Field label="Booking date">{(id) => <Input id={id} type="date" max={todayStr()} {...f.bind('booking_date')} />}</Field>
            </div>
          </section>

          <section>
            <p className="label-xs mb-3">Payment plan</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Installments">
                {(id) => (
                  <Select id={id} {...f.bind('installments_count')}>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                      <option key={n} value={n}>
                        {n} after booking
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Every">
                {(id) => (
                  <Select id={id} {...f.bind('frequency_months')}>
                    {[1, 2, 3, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} month{n > 1 ? 's' : ''}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="First due" error={f.errors.first_due_date}>
                {(id) => <Input id={id} type="date" {...f.bind('first_due_date')} />}
              </Field>
            </div>
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/60 p-3.5">
              <Checkbox label={<span className="font-semibold">Booking amount received now</span>} checked={v.record_booking_payment} onChange={(e) => f.set('record_booking_payment', e.target.checked)} />
              {v.record_booking_payment && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Payment method">
                    {(id) => (
                      <Select id={id} {...f.bind('booking_method')}>
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Reference / UTR">{(id) => <Input id={id} placeholder="e.g. NEFT/HDFC/N2681204" {...f.bind('booking_reference')} />}</Field>
                </div>
              )}
            </div>
          </section>

          <section>
            <p className="label-xs mb-3">Customer details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!lead && (
                <>
                  <Field label="Full name" required error={f.errors.name}>
                    {(id) => <Input id={id} autoFocus {...f.bind('name')} />}
                  </Field>
                  {user.role !== 'sales' && (
                    <Field label="Sales executive">
                      {(id) => (
                        <Select id={id} {...f.bind('assigned_to')}>
                          <option value="">Unassigned</option>
                          {agents.data.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  )}
                </>
              )}
              <Field label="Phone" required={!lead} error={f.errors.phone}>
                {(id) => <Input id={id} type="tel" {...f.bind('phone')} />}
              </Field>
              <Field label="Email">{(id) => <Input id={id} type="email" {...f.bind('email')} />}</Field>
              <Field label="Address" className="sm:col-span-2">
                {(id) => <Textarea id={id} rows={2} placeholder="House no., locality, city, PIN" {...f.bind('address')} />}
              </Field>
              <Field label="City">{(id) => <Input id={id} {...f.bind('city')} />}</Field>
              <Field label="Occupation">{(id) => <Input id={id} {...f.bind('occupation')} />}</Field>
              <Field label="PAN" error={f.errors.pan}>
                {(id) => <Input id={id} className="uppercase" maxLength={10} placeholder="ABCDE1234F" {...f.bind('pan')} />}
              </Field>
              <Field label="Aadhaar" error={f.errors.aadhaar}>
                {(id) => <Input id={id} inputMode="numeric" maxLength={14} placeholder="1234 5678 9012" {...f.bind('aadhaar')} />}
              </Field>
            </div>
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-brand-100 bg-brand-50/50 p-4 lg:sticky lg:top-0">
          <p className="label-xs text-brand-800/70">Schedule preview</p>
          {property && (
            <p className="mt-2 text-[14px] font-bold text-ink">
              {property.project} · {property.unit_number}
            </p>
          )}
          <p className="text-[24px] font-extrabold tracking-tight text-brand-900">{v.total_value ? inr(Number(v.total_value)) : '—'}</p>
          <ul className="mt-3 divide-y divide-brand-100/80 text-[13px]">
            {schedule.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className={cn('block truncate font-semibold', i === 0 ? 'text-brand-900' : 'text-stone-700')}>
                    {i + 1}. {s.label}
                  </span>
                  <span className="text-[12px] text-stone-500">{fmtDate(s.due_date)}</span>
                </span>
                <span className="num font-bold text-ink">{inr(s.amount)}</span>
              </li>
            ))}
            {!schedule.length && <li className="py-6 text-center text-stone-500">Choose a unit and amounts to preview the schedule</li>}
          </ul>
        </aside>
      </div>
    </Modal>
  );
}

export function RecordPaymentModal({ open, onClose, installment, customerName }: { open: boolean; onClose: () => void; installment: Installment | null; customerName?: string }) {
  const navigate = useNavigate();
  const balance = installment ? installment.amount - installment.paid_amount : 0;
  const f = useForm(
    {
      amount: balance as number | '',
      method: 'Bank Transfer',
      payment_date: todayStr(),
      reference: '',
      notes: '',
      pending: false,
    },
    (v) => ({
      amount: !v.amount ? 'Enter the amount received' : Number(v.amount) > balance ? `Cannot exceed the balance of ${inr(balance)}` : undefined,
      reference: v.method !== 'Cash' && !v.reference.trim() ? 'Add the UTR / cheque / transaction reference' : undefined,
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, installment?.id]);
  const pay = useAction(
    (v: typeof f.values) =>
      api.post<{
        id: number;
        receipt_number: string;
        outstanding_after: number;
      }>(`/installments/${installment!.id}/payment`, {
        amount: Number(v.amount),
        method: v.method,
        payment_date: v.payment_date,
        reference: v.reference || null,
        notes: v.notes || null,
        status: v.pending ? 'Pending' : 'Completed',
      }),
    {
      onSuccess: (r, v) => {
        onClose();
        if (v.pending) toast.success('Payment recorded — awaiting clearance');
        else
          toast.success(`Payment of ${inr(Number(v.amount))} recorded`, {
            description: `Receipt ${r.receipt_number} · Outstanding now ${inr(r.outstanding_after)}`,
            action: {
              label: 'View receipt',
              onClick: () => navigate(`/receipts/${r.id}`),
            },
            duration: 8000,
          });
      },
    },
  );
  if (!installment) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`${customerName ?? installment.customer_name ?? ''} · #${installment.number} ${installment.label}`}
      onSubmit={() => f.submit((v) => pay.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            Record {f.values.amount ? inr(Number(f.values.amount)) : 'payment'}
          </Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-center">
        <div>
          <p className="text-[11.5px] font-semibold text-stone-500">Installment</p>
          <p className="num text-[14px] font-bold text-ink">{inr(installment.amount)}</p>
        </div>
        <div>
          <p className="text-[11.5px] font-semibold text-stone-500">Paid</p>
          <p className="num text-[14px] font-bold text-brand-800">{inr(installment.paid_amount)}</p>
        </div>
        <div>
          <p className="text-[11.5px] font-semibold text-stone-500">Balance</p>
          <p className="num text-[14px] font-bold text-red-600">{inr(balance)}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount received" required error={f.errors.amount}>
          {(id) => <MoneyInput id={id} autoFocus value={f.values.amount} onChange={(x) => f.set('amount', x)} aria-invalid={!!f.errors.amount} />}
        </Field>
        <Field label="Payment date" required>
          {(id) => <Input id={id} type="date" max={todayStr()} {...f.bind('payment_date')} />}
        </Field>
        <Field label="Method" className="sm:col-span-2">
          {() => (
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => f.set('method', m)}
                  className={cn('h-9 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors', f.values.method === m ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label={f.values.method === 'Cheque' ? 'Cheque no. & bank' : 'Reference / UTR'} required={f.values.method !== 'Cash'} error={f.errors.reference} className="sm:col-span-2">
          {(id) => <Input id={id} placeholder={f.values.method === 'Cheque' ? 'CHQ 004512 · HDFC Bank' : 'NEFT/HDFC/N2681204'} {...f.bind('reference')} />}
        </Field>
        {f.values.method === 'Cheque' && <Checkbox className="sm:col-span-2" label="Cheque deposited — mark as awaiting clearance (balance updates once cleared)" checked={f.values.pending} onChange={(e) => f.set('pending', e.target.checked)} />}
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} {...f.bind('notes')} />}
        </Field>
      </div>
    </Modal>
  );
}
