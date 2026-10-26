import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Ban, Camera, CheckCircle2, CircleUserRound, Download, Handshake, Inbox, IndianRupee, Landmark, Mail, MessageCircle, MessageSquareText, MoreHorizontal, Pencil, Phone, Receipt, Send, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, inr, inrShort, timeAgo } from '@/lib/format';
import { DEAL_STAGES, cn, smsHref, telHref, waHref } from '@/lib/utils';
import { REGISTRY_STATUSES, type RegistryStatus } from '@estateflow/shared';
import { daysLeft, installmentReminder, receiptMessage, registryReminder, useCompanyName } from '@/lib/whatsapp';
import { useAction } from '@/hooks/queries';
import { required, useForm, validEmail, validPhone } from '@/hooks/useForm';
import { Card, CardHeader, InfoRow } from '@/components/ui/Card';
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/Button';
import { PropertyStatusBadge, RegistryBadge, StatusBadge } from '@/components/ui/Badge';
import { Avatar, Menu, MenuItem, MenuSeparator, PageHeader, Tabs, Tooltip } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/domain/Timeline';
import { FinancialSummary, InstallmentTable } from '@/components/domain/FinanceViews';
import { RecordPaymentModal } from '@/components/domain/FinanceForms';
import { DocumentSections, UploadDocumentModal } from '@/components/domain/Documents';
import { PropertyThumb } from '@/components/domain/PropertyGallery';
import type { Activity, Broker, Customer, CustomerRequest, Deal, DocumentItem, Financials, Installment, Property, Transaction } from '@/types';

type Detail = Customer & {
  property: Property | null;
  deal: (Deal & { agent_name?: string }) | null;
  installments: Installment[];
  transactions: Transaction[];
  documents: DocumentItem[];
  /** True for staff who may not open customer papers (only administrators and accounts may). */
  documents_hidden?: boolean;
  activities: Activity[];
  lead: { id: number; code: string; source: string; created_at: string } | null;
  portalUser: {
    id: number;
    email: string;
    last_login?: string;
    status: string;
  } | null;
  financials: Financials;
  requests: CustomerRequest[];
};

function CancelBookingModal({ open, onClose, c }: { open: boolean; onClose: () => void; c: Detail }) {
  const [reason, setReason] = useState('');
  const cancel = useAction(() => api.post(`/customers/${c.id}/cancel`, { reason: reason.trim() }), {
    success: 'Booking cancelled. The unit is available again.',
    onSuccess: onClose,
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Cancel booking for ${c.name}?`}
      description={`${c.property_project ?? ''} ${c.property_unit ?? ''}`}
      onSubmit={() => (reason.trim().length >= 3 ? cancel.mutate(undefined) : toast.error('Enter the reason for cancelling'))}
      footer={
        <>
          <Button onClick={onClose}>Keep booking</Button>
          <Button type="submit" variant="danger" loading={cancel.isPending}>
            Cancel booking
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-stone-600">
          <li>The unit goes back to Available and the deal is closed as cancelled.</li>
          <li>Unpaid installments are removed. Payments already received ({inr(c.financials.paid)}) stay on the ledger for any refund.</li>
          <li>The original lead is marked Lost with this reason.</li>
        </ul>
        <Field label="Reason" required>
          {(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer relocating; refund of booking amount approved" />}
        </Field>
      </div>
    </Modal>
  );
}

function EditCustomerModal({ open, onClose, c }: { open: boolean; onClose: () => void; c: Detail }) {
  const f = useForm(
    {
      name: c.name,
      phone: c.phone,
      email: c.email ?? '',
      address: c.address ?? '',
      city: c.city ?? '',
      occupation: c.occupation ?? '',
      pan: c.pan ?? '',
      aadhaar: c.aadhaar?.startsWith('X') ? '' : (c.aadhaar ?? ''),
    },
    (v) => ({ email: validEmail(v.email) }),
  );
  const save = useAction((v: typeof f.values) => api.put(`/customers/${c.id}`, { ...v, aadhaar: v.aadhaar || undefined }), { success: 'Customer updated', onSuccess: onClose });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit customer"
      size="lg"
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">{(id) => <Input id={id} {...f.bind('name')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} {...f.bind('phone')} />}</Field>
        <Field label="Email" error={f.errors.email}>
          {(id) => <Input id={id} {...f.bind('email')} />}
        </Field>
        <Field label="Occupation">{(id) => <Input id={id} {...f.bind('occupation')} />}</Field>
        <Field label="Address" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} {...f.bind('address')} />}
        </Field>
        <Field label="City">{(id) => <Input id={id} {...f.bind('city')} />}</Field>
        <Field label="PAN">{(id) => <Input id={id} className="uppercase" {...f.bind('pan')} />}</Field>
        <Field label="Aadhaar" hint={c.aadhaar ? `On file: ${c.aadhaar}` : undefined}>
          {(id) => <Input id={id} placeholder="Leave blank to keep" {...f.bind('aadhaar')} />}
        </Field>
      </div>
    </Modal>
  );
}

/** The customer's latest "Photo" document, fetched with auth as a blob and shown through an object URL. */
function CustomerPhoto({ c, onUpload }: { c: Detail; onUpload: () => void }) {
  const photoId = c.photo_document_id;
  const { data: blob } = useQuery({
    queryKey: ['document-blob', photoId],
    queryFn: () => api.blob(`/documents/${photoId}/download`, { inline: 1 }),
    enabled: !!photoId,
    staleTime: Infinity,
  });
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob || !photoId) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob, photoId]);
  return (
    <button
      type="button"
      onClick={onUpload}
      aria-label={photoId ? 'Change photo' : 'Upload photo'}
      title={photoId ? 'Change photo' : 'Upload photo'}
      className="group relative size-20 shrink-0 overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200 sm:size-24"
    >
      {url ? <img src={url} alt={c.name} className="size-full object-cover" /> : <Avatar name={c.name} size="xl" className="size-full rounded-none text-[26px]" />}
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <Camera className="size-3" /> {photoId ? 'Change' : 'Add photo'}
      </span>
    </button>
  );
}

function RegistryModal({ open, onClose, c }: { open: boolean; onClose: () => void; c: Detail }) {
  const f = useForm(
    {
      registry_status: (c.registry_status ?? 'Not done') as RegistryStatus,
      registry_date: c.registry_date ?? '',
      registry_number: c.registry_number ?? '',
    },
    (v) => ({
      registry_date: v.registry_status !== 'Not done' ? required(v.registry_date) : undefined,
      registry_number: v.registry_status === 'Done' ? required(v.registry_number) : undefined,
    }),
  );
  const save = useAction(
    (v: typeof f.values) =>
      api.put(`/customers/${c.id}`, {
        registry_status: v.registry_status,
        registry_date: v.registry_status === 'Not done' ? null : v.registry_date || null,
        registry_number: v.registry_status === 'Done' ? v.registry_number.trim() : null,
      }),
    { success: 'Registry updated', onSuccess: onClose },
  );
  const st = f.values.registry_status;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registry"
      description={`${c.name} · ${[c.property_project, c.property_unit].filter(Boolean).join(' ')}`}
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status" error={f.errors.registry_status} className="sm:col-span-2">
          {(id) => (
            <Select id={id} {...f.bind('registry_status')}>
              {REGISTRY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        {st !== 'Not done' && (
          <Field label="Registry date" required error={f.errors.registry_date} hint={st === 'Date fixed' ? 'The customer is reminded 15, 7 and 1 day before' : undefined}>
            {(id) => <Input id={id} type="date" {...f.bind('registry_date')} />}
          </Field>
        )}
        {st === 'Done' && (
          <Field label="Registry number" required error={f.errors.registry_number}>
            {(id) => <Input id={id} placeholder="e.g. 2026/LKO/12345" {...f.bind('registry_number')} />}
          </Field>
        )}
      </div>
    </Modal>
  );
}

function NomineeModal({ open, onClose, c }: { open: boolean; onClose: () => void; c: Detail }) {
  const f = useForm(
    {
      nominee_name: c.nominee_name ?? '',
      nominee_relation: c.nominee_relation ?? '',
      nominee_phone: c.nominee_phone ?? '',
      nominee_aadhaar: c.nominee_aadhaar?.startsWith('X') ? '' : (c.nominee_aadhaar ?? ''),
    },
    (v) => ({ nominee_phone: v.nominee_phone.trim() ? validPhone(v.nominee_phone) : undefined }),
  );
  const save = useAction(
    (v: typeof f.values) =>
      api.put(`/customers/${c.id}`, {
        nominee_name: v.nominee_name.trim() || null,
        nominee_relation: v.nominee_relation.trim() || null,
        nominee_phone: v.nominee_phone.trim() || null,
        nominee_aadhaar: v.nominee_aadhaar.trim() || undefined,
      }),
    { success: 'Nominee updated', onSuccess: onClose },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nominee"
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nominee name" error={f.errors.nominee_name}>
          {(id) => <Input id={id} {...f.bind('nominee_name')} />}
        </Field>
        <Field label="Relation" error={f.errors.nominee_relation}>
          {(id) => <Input id={id} list="nominee-relations" placeholder="e.g. Wife, Son" {...f.bind('nominee_relation')} />}
        </Field>
        <datalist id="nominee-relations">
          {['Wife', 'Husband', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister'].map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <Field label="Phone" error={f.errors.nominee_phone}>
          {(id) => <Input id={id} type="tel" inputMode="tel" {...f.bind('nominee_phone')} />}
        </Field>
        <Field label="Aadhaar" error={f.errors.nominee_aadhaar} hint={c.nominee_aadhaar ? `On file: ${c.nominee_aadhaar}` : undefined}>
          {(id) => <Input id={id} inputMode="numeric" placeholder={c.nominee_aadhaar ? 'Leave blank to keep' : '12 digits'} {...f.bind('nominee_aadhaar')} />}
        </Field>
      </div>
    </Modal>
  );
}

function BrokerModal({ open, onClose, c }: { open: boolean; onClose: () => void; c: Detail }) {
  const brokers = useQuery({
    queryKey: ['brokers', 'options'],
    queryFn: () => api.get<{ data: Broker[] }>('/brokers', { status: 'Active', limit: 100 }).then((r) => r.data),
    enabled: open,
    staleTime: 60_000,
  });
  const f = useForm({ broker_id: c.broker_id ? String(c.broker_id) : '' });
  const save = useAction((v: typeof f.values) => api.put<Customer>(`/customers/${c.id}`, { broker_id: v.broker_id ? Number(v.broker_id) : null }), {
    success: (r) => (r?.broker_name ? `Broker set to ${r.broker_name}` : 'Broker updated'),
    onSuccess: onClose,
  });
  const list = brokers.data ?? [];
  const current = c.broker_id && !list.some((b) => b.id === c.broker_id) ? { id: c.broker_id, name: c.broker_name ?? 'Current broker' } : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broker"
      description="Commission is worked out automatically on every payment."
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            Save
          </Button>
        </>
      }
    >
      <Field label="Broker" error={f.errors.broker_id} hint={brokers.isLoading ? 'Loading brokers…' : !list.length ? 'No active brokers yet' : undefined}>
        {(id) => (
          <Select id={id} {...f.bind('broker_id')}>
            <option value="">No broker (direct sale)</option>
            {current && <option value={current.id}>{current.name}</option>}
            {list.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.firm ? ` · ${b.firm}` : ''} · {b.commission_pct}%
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const user = useUser();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const finance = can.finance(user.role);
  const [tab, setTab] = useState<'schedule' | 'payments' | 'documents' | 'requests' | 'communication'>('schedule');
  const [payFor, setPayFor] = useState<Installment | null>(null);
  const [modal, setModal] = useState<null | 'edit' | 'upload' | 'cancel' | 'photo' | 'registry' | 'nominee' | 'broker'>(null);
  const company = useCompanyName();
  const [note, setNote] = useState('');
  const [channel, setChannel] = useState('call');
  const {
    data: c,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Detail>(`/customers/${id}`),
  });
  const addNote = useAction(() => api.post(`/customers/${id}/notes`, { note, channel }), { success: 'Added to communication history', onSuccess: () => setNote('') });
  const setStage = useAction((stage: string) => api.patch(`/deals/${c!.deal!.id}`, { stage }), { success: (r: any) => `Deal moved to ${r.stage}` });
  const setTxnStatus = useAction((v: { id: number; status: string }) => api.patch(`/transactions/${v.id}/status`, { status: v.status }), {
    success: (r: any) => (r.status === 'Completed' ? 'Payment cleared — balance updated' : `Payment marked ${r.status.toLowerCase()}`),
  });

  if (isLoading) return <PageSkeleton stats={0} />;
  if (error || !c) return <ErrorState error={error} onRetry={refetch} />;
  const fin = c.financials;
  const next = c.installments.find((i) => i.balance > 0);
  const comms = c.activities.filter((a) => ['call', 'whatsapp', 'sms', 'email', 'meeting', 'note', 'site_visit', 'followup'].includes(a.type));
  const cancelled = c.status === 'Cancelled';
  const area = c.property?.area_sqft ?? 0;
  const rate = c.property?.rate_per_sqft || (area ? Math.round(c.total_value / area) : 0);
  const emiPaid = fin.paid_installments;
  const emiLeft = Math.max(0, fin.installments - fin.paid_installments);
  const registry = c.registry_status ?? 'Not done';
  const regLeft = registry === 'Date fixed' ? daysLeft(c.registry_date) : null;
  const remindHref = (i: Installment) => (cancelled ? undefined : waHref(c.phone, installmentReminder({ name: c.name, label: i.label, balance: i.balance, due_date: i.due_date, company })));
  const downloadLedger = () => api.download(`/customers/${c.id}/ledger.csv`, `${c.code}-ledger.csv`).catch((e) => toast.error(e.message));

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Customers', to: '/customers' }, { label: c.name }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name} <StatusBadge status={c.status} className="text-[12px]" />
          </span>
        }
        subtitle={
          <span>
            {c.code} · {c.property_project} {c.property_unit} · Booked {fmtDate(c.booking_date)}
            {c.agent_name ? ` · ${c.agent_name}` : ''}
          </span>
        }
        actions={
          <>
            <div className="flex gap-1.5">
              <Tooltip content={c.phone}>
                <a href={telHref(c.phone)} aria-label="Call" className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-stone-700 shadow-card hover:bg-stone-50 sm:size-9">
                  <Phone className="size-4" />
                </a>
              </Tooltip>
              <Tooltip content="SMS">
                <a href={smsHref(c.phone)} aria-label="SMS" className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-stone-700 shadow-card hover:bg-stone-50 sm:size-9">
                  <MessageSquareText className="size-4" />
                </a>
              </Tooltip>
              <Tooltip content="WhatsApp">
                <a href={waHref(c.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-emerald-700 shadow-card hover:bg-emerald-50 sm:size-9">
                  <MessageCircle className="size-4" />
                </a>
              </Tooltip>
              {c.email && (
                <Tooltip content={c.email}>
                  <a href={`mailto:${c.email}`} aria-label="Email" className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-stone-700 shadow-card hover:bg-stone-50 sm:size-9">
                    <Mail className="size-4" />
                  </a>
                </Tooltip>
              )}
            </div>
            {!c.documents_hidden && (
              <Button icon={<Upload />} onClick={() => setModal('upload')}>
                Upload
              </Button>
            )}
            {finance && next && !cancelled && (
              <Button variant="primary" icon={<IndianRupee />} onClick={() => setPayFor(next)}>
                Record payment
              </Button>
            )}
            <Menu trigger={<Button size="icon" aria-label="More" icon={<MoreHorizontal />} />}>
              <MenuItem icon={<Pencil />} onSelect={() => setModal('edit')}>
                Edit customer
              </MenuItem>
              {c.lead && (
                <MenuItem icon={<ArrowUpRight />} onSelect={() => navigate(`/leads/${c.lead!.id}`)}>
                  Open original lead
                </MenuItem>
              )}
              <MenuItem icon={<Download />} onSelect={downloadLedger}>
                Download ledger (CSV)
              </MenuItem>
              {can.assignLeads(user.role) && !cancelled && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<XCircle />} danger onSelect={() => setModal('cancel')}>
                    Cancel booking
                  </MenuItem>
                </>
              )}
            </Menu>
          </>
        }
      />

      {cancelled && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-800">
          <XCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            Booking cancelled on {fmtDate(c.cancelled_at)}. {c.cancel_reason}
          </p>
        </div>
      )}
      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex items-center gap-4 lg:w-60 lg:shrink-0">
            {c.documents_hidden ? <Avatar name={c.name} size="xl" className="size-20 shrink-0 rounded-2xl text-[26px] sm:size-24" /> : <CustomerPhoto c={c} onUpload={() => setModal('photo')} />}
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-ink">{c.name}</p>
              <p className="text-[12.5px] text-stone-500">{c.code}</p>
              <p className="text-[12.5px] text-stone-500">{c.phone}</p>
              {!c.documents_hidden && (
                <button type="button" onClick={() => setModal('photo')} className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-800 hover:underline">
                  <Camera className="size-3.5" /> {c.photo_document_id ? 'Change photo' : 'Upload photo'}
                </button>
              )}
            </div>
          </div>
          <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3.5 sm:grid-cols-3 xl:grid-cols-5">
            <InfoRow label="Plot number">{c.property_unit}</InfoRow>
            <InfoRow label="Block">{c.property_block}</InfoRow>
            <InfoRow label="Size">{area ? `${area.toLocaleString('en-IN')} sq ft` : null}</InfoRow>
            <InfoRow label="Rate per sq ft">{rate ? `₹${rate.toLocaleString('en-IN')}` : null}</InfoRow>
            <InfoRow label="Total value">{inr(c.total_value)}</InfoRow>
            <InfoRow label="Booking date">{fmtDate(c.booking_date)}</InfoRow>
            <InfoRow label="Booking amount">{inr(fin.booking_amount)}</InfoRow>
            <InfoRow label="Total paid">
              <span className="text-brand-800">{inr(fin.paid)}</span>
            </InfoRow>
            <InfoRow label="Pending">{inr(Math.max(0, fin.outstanding))}</InfoRow>
            <InfoRow label="EMIs paid / left">
              {emiPaid} paid · {emiLeft} left
            </InfoRow>
            <InfoRow label="Aadhaar">{c.aadhaar}</InfoRow>
            <InfoRow label="Registry">
              <RegistryBadge status={registry} date={c.registry_date} />
            </InfoRow>
            <InfoRow label="Broker">{c.broker_name}</InfoRow>
            <InfoRow label="Nominee">{c.nominee_name ? [c.nominee_name, c.nominee_relation && `(${c.nominee_relation})`].filter(Boolean).join(' ') : null}</InfoRow>
            <InfoRow label="Salesperson">{c.agent_name}</InfoRow>
          </dl>
        </div>
      </Card>

      <Card className="mb-5 p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ink">Financial overview</h2>
          {fin.overdue > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-700">{inr(fin.overdue)} overdue</span>}
        </div>
        <FinancialSummary fin={fin} />
      </Card>

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[1fr_360px]">
        <Card className="min-w-0 overflow-hidden">
          <Tabs
            className="px-4 pt-1 sm:px-5"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: 'schedule',
                label: 'Installment schedule',
                count: c.installments.length,
              },
              {
                value: 'payments',
                label: 'Payment history',
                count: c.transactions.length,
              },
              ...(c.documents_hidden
                ? []
                : [
                    {
                      value: 'documents' as const,
                      label: 'Documents',
                      count: c.documents.length,
                    },
                  ]),
              {
                value: 'requests',
                label: 'Requests',
                count: c.requests.length,
              },
              {
                value: 'communication',
                label: 'Communication',
                count: comms.length,
              },
            ]}
          />
          {tab === 'schedule' && <InstallmentTable rows={c.installments} onPay={finance ? setPayFor : undefined} remindHref={remindHref} />}
          {tab === 'payments' &&
            (c.transactions.length ? (
              <ul className="divide-y divide-stone-100">
                {c.transactions.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', t.status === 'Completed' ? 'bg-brand-50 text-brand-700' : t.status === 'Pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600')}>
                      <IndianRupee className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-ink">
                        {inr(t.amount)} <span className="font-medium text-stone-500">· {t.method}</span>
                      </p>
                      <p className="truncate text-[12.5px] text-stone-500">
                        {fmtDate(t.payment_date)} · {t.installment_label} · {t.reference ?? t.code}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                    {t.status === 'Completed' && (
                      <div className="flex gap-1">
                        <ButtonAnchor
                          size="sm"
                          variant="ghost"
                          icon={<MessageCircle />}
                          className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          aria-label="Send receipt on WhatsApp"
                          title="Send receipt on WhatsApp"
                          href={waHref(
                            c.phone,
                            receiptMessage({
                              name: c.name,
                              receipt: t.receipt_number ?? t.code,
                              amount: t.amount,
                              date: t.payment_date,
                              method: t.method,
                              project: c.property_project,
                              unit: c.property_unit,
                              company,
                            }),
                          )}
                        >
                          <span className="hidden sm:inline">Send receipt</span>
                        </ButtonAnchor>
                        <ButtonLink to={`/receipts/${t.id}`} size="sm" variant="ghost" icon={<Receipt />}>
                          Receipt
                        </ButtonLink>
                      </div>
                    )}
                    {t.status === 'Pending' && finance && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="subtle"
                          icon={<CheckCircle2 />}
                          onClick={() =>
                            setTxnStatus.mutate({
                              id: t.id,
                              status: 'Completed',
                            })
                          }
                        >
                          Mark cleared
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Ban />}
                          className="text-red-600"
                          onClick={async () => {
                            if (
                              await confirm({
                                title: 'Mark payment as bounced?',
                                message: `${inr(t.amount)} (${t.reference}) will be marked as failed. The installment stays unpaid.`,
                                confirmLabel: 'Mark failed',
                              })
                            )
                              setTxnStatus.mutate({
                                id: t.id,
                                status: 'Failed',
                              });
                          }}
                        >
                          Bounced
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Receipt />} title="No payments recorded yet" />
            ))}
          {tab === 'documents' && (
            <DocumentSections docs={c.documents} entityType="customer" entityId={c.id} />
          )}
          {tab === 'requests' &&
            (c.requests.length ? (
              <ul className="divide-y divide-stone-100">
                {c.requests.map((r) => (
                  <li key={r.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13.5px] font-bold text-ink">
                        {r.subject} <span className="font-medium text-stone-500">· {r.type}</span>
                      </p>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.message && <p className="mt-1 text-[13px] text-stone-600">{r.message}</p>}
                    {r.response && <p className="mt-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[12.5px] text-brand-900">Reply: {r.response}</p>}
                    <p className="mt-1 text-[12px] text-stone-400">Raised {timeAgo(r.created_at)}</p>
                  </li>
                ))}
                <li className="px-4 py-3 sm:px-5">
                  <Link to="/requests" className="text-[13px] font-semibold text-brand-800 hover:underline">
                    Open the requests inbox →
                  </Link>
                </li>
              </ul>
            ) : (
              <EmptyState compact icon={<Inbox />} title="No requests from this customer" message="Requests raised in the customer app appear here." />
            ))}
          {tab === 'communication' && (
            <div className="p-4 sm:p-5">
              <form
                className="mb-6 rounded-xl border border-stone-200 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate(undefined);
                }}
              >
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, message or meeting with the customer…" className="border-0 px-1 shadow-none focus:ring-0" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="w-40">
                    <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 text-[13px]">
                      <option value="call">Call</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="sms">SMS</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="note">Internal note</option>
                    </Select>
                  </div>
                  <Button size="sm" type="submit" variant="primary" icon={<Send />} disabled={!note.trim()} loading={addNote.isPending}>
                    Log
                  </Button>
                </div>
              </form>
              <ActivityTimeline items={c.activities} />
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 content-start items-start gap-5 md:grid-cols-2 2xl:grid-cols-1">
          <Card className="overflow-hidden">
            <CardHeader title="Property" />
            {c.property && (
              <Link to={`/properties/${c.property.id}`} className="group mx-5 mb-5 block overflow-hidden rounded-xl border border-stone-100">
                <PropertyThumb id={c.property.id} type={c.property.type} project={c.property.project} className="h-32 w-full" />
                <div className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-bold text-ink group-hover:text-brand-800">{c.property.name}</p>
                      <p className="text-[12.5px] text-stone-500">
                        {c.property.project} · {c.property.unit_number}
                      </p>
                    </div>
                    <PropertyStatusBadge status={c.property.status} />
                  </div>
                  <p className="mt-2 text-[12.5px] text-stone-500">
                    {c.property.area_sqft.toLocaleString('en-IN')} sq ft {c.property.facing ? `· ${c.property.facing}` : ''} {c.property.possession ? `· Possession ${c.property.possession}` : ''}
                  </p>
                </div>
              </Link>
            )}
          </Card>

          {c.deal && (
            <Card>
              <CardHeader title="Deal" subtitle={c.deal.code} />
              <div className="px-5 pb-5">
                <Field label="Stage">
                  {(fid) => (
                    <Select id={fid} value={c.deal!.stage} disabled={!can.sales(user.role) || setStage.isPending} onChange={(e) => setStage.mutate(e.target.value)}>
                      {DEAL_STAGES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <dl className="mt-4 grid grid-cols-2 gap-4">
                  <InfoRow label="Deal value">{inrShort(c.deal.value)}</InfoRow>
                  <InfoRow label="Discount">{c.deal.discount ? inr(c.deal.discount) : 'None'}</InfoRow>
                  <InfoRow label="Booking date">{fmtDate(c.deal.booking_date)}</InfoRow>
                  <InfoRow label="Closed by">{c.deal.agent_name}</InfoRow>
                  {c.lead && (
                    <InfoRow label="Lead source" className="col-span-2">
                      {c.lead.source} · {c.lead.code}
                    </InfoRow>
                  )}
                </dl>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Personal information"
              action={
                <Button size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setModal('edit')}>
                  <Pencil />
                </Button>
              }
            />
            <dl className="grid grid-cols-2 gap-4 px-5 pb-5">
              <InfoRow label="Phone">{c.phone}</InfoRow>
              <InfoRow label="Email">{c.email && <span className="break-all">{c.email}</span>}</InfoRow>
              <InfoRow label="Address" className="col-span-2">
                <span className="font-normal">{c.address}</span>
              </InfoRow>
              <InfoRow label="Occupation" className="col-span-2">
                {c.occupation}
              </InfoRow>
              <InfoRow label="PAN">{c.pan}</InfoRow>
              <InfoRow label="Aadhaar">{c.aadhaar}</InfoRow>
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Registry"
              icon={<Landmark />}
              action={
                !cancelled && (
                  <Button size="icon-sm" variant="ghost" aria-label="Edit registry" onClick={() => setModal('registry')}>
                    <Pencil />
                  </Button>
                )
              }
            />
            <div className="px-5 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <RegistryBadge status={registry} />
                {regLeft !== null && (
                  <span className={cn('text-[12.5px] font-semibold', regLeft < 0 ? 'text-red-600' : regLeft <= 15 ? 'text-amber-700' : 'text-stone-500')}>
                    {regLeft === 0 ? 'Today' : regLeft === 1 ? 'Tomorrow' : regLeft > 0 ? `${regLeft} days left` : `${-regLeft} days ago`}
                  </span>
                )}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <InfoRow label="Registry date">{c.registry_date ? fmtDate(c.registry_date) : null}</InfoRow>
                <InfoRow label="Registry number">{c.registry_number}</InfoRow>
              </dl>
              {registry === 'Date fixed' && c.registry_date && !cancelled && (
                <ButtonAnchor
                  size="sm"
                  icon={<MessageCircle />}
                  className="mt-4 w-full text-emerald-700"
                  href={waHref(c.phone, registryReminder({ name: c.name, date: c.registry_date, project: c.property_project, unit: c.property_unit, company }))}
                >
                  Send registry reminder on WhatsApp
                </ButtonAnchor>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Nominee"
              icon={<CircleUserRound />}
              action={
                <Button size="icon-sm" variant="ghost" aria-label="Edit nominee" onClick={() => setModal('nominee')}>
                  <Pencil />
                </Button>
              }
            />
            {c.nominee_name || c.nominee_phone || c.nominee_aadhaar ? (
              <dl className="grid grid-cols-2 gap-4 px-5 pb-5">
                <InfoRow label="Name">{c.nominee_name}</InfoRow>
                <InfoRow label="Relation">{c.nominee_relation}</InfoRow>
                <InfoRow label="Phone">{c.nominee_phone}</InfoRow>
                <InfoRow label="Aadhaar">{c.nominee_aadhaar}</InfoRow>
              </dl>
            ) : (
              <div className="px-5 pb-5">
                <p className="text-[13px] text-stone-500">No nominee added yet.</p>
                <Button size="sm" className="mt-3" icon={<Pencil />} onClick={() => setModal('nominee')}>
                  Add nominee
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Broker"
              icon={<Handshake />}
              action={
                !cancelled && (
                  <Button size="icon-sm" variant="ghost" aria-label="Change broker" onClick={() => setModal('broker')}>
                    <Pencil />
                  </Button>
                )
              }
            />
            <div className="px-5 pb-5">
              <p className="text-[14px] font-semibold text-ink">{c.broker_name ?? <span className="font-normal text-stone-400">No broker (direct sale)</span>}</p>
              <p className="mt-1 text-[12.5px] text-stone-500">Commission is worked out automatically on every payment.</p>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', c.portalUser ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-500')}>
                <ShieldCheck className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-ink">Customer portal</p>
                {c.portalUser ? (
                  <p className="text-[12.5px] text-stone-500">
                    {c.portalUser.email} · {c.portalUser.last_login ? `last seen ${timeAgo(c.portalUser.last_login)}` : 'not signed in yet'}
                  </p>
                ) : (
                  <p className="text-[12.5px] text-stone-500">
                    No portal login yet.{' '}
                    {user.role === 'admin' && (
                      <Link to="/users?new=customer" className="font-semibold text-brand-800 hover:underline">
                        Create access
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <RecordPaymentModal open={!!payFor} onClose={() => setPayFor(null)} installment={payFor} customerName={c.name} />
      <UploadDocumentModal open={modal === 'upload'} onClose={() => setModal(null)} entityType="customer" entityId={c.id} defaultType="Agreement" />
      {modal === 'edit' && <EditCustomerModal open onClose={() => setModal(null)} c={c} />}
      {modal === 'cancel' && <CancelBookingModal open onClose={() => setModal(null)} c={c} />}
      {modal === 'registry' && <RegistryModal open onClose={() => setModal(null)} c={c} />}
      {modal === 'nominee' && <NomineeModal open onClose={() => setModal(null)} c={c} />}
      {modal === 'broker' && <BrokerModal open onClose={() => setModal(null)} c={c} />}
      <UploadDocumentModal
        open={modal === 'photo'}
        onClose={() => setModal(null)}
        entityType="customer"
        entityId={c.id}
        defaultType="Photo"
        types={['Photo']}
        accept="image/jpeg,image/png,image/webp"
        title={c.photo_document_id ? 'Change photo' : 'Upload photo'}
        description="A clear photo of the customer · JPG, PNG or WebP up to 10 MB"
        success="Photo saved"
      />
    </div>
  );
}
