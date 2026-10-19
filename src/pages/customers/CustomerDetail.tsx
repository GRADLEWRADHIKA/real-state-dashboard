import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Ban, CheckCircle2, Download, Inbox, IndianRupee, Mail, MessageCircle, MessageSquareText, MoreHorizontal, Pencil, Phone, Receipt, Send, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, inr, inrShort, timeAgo } from '@/lib/format';
import { DEAL_STAGES, cn, smsHref, telHref, waHref } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { useForm, validEmail } from '@/hooks/useForm';
import { Card, CardHeader, InfoRow } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PropertyStatusBadge, StatusBadge } from '@/components/ui/Badge';
import { Menu, MenuItem, MenuSeparator, PageHeader, Tabs, Tooltip } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/domain/Timeline';
import { FinancialSummary, InstallmentTable } from '@/components/domain/FinanceViews';
import { RecordPaymentModal } from '@/components/domain/FinanceForms';
import { DocumentList, UploadDocumentModal } from '@/components/domain/Documents';
import { PropertyThumb } from '@/components/domain/PropertyGallery';
import type { Activity, Customer, CustomerRequest, Deal, DocumentItem, Financials, Installment, Property, Transaction } from '@/types';

type Detail = Customer & {
  property: Property | null;
  deal: (Deal & { agent_name?: string }) | null;
  installments: Installment[];
  transactions: Transaction[];
  documents: DocumentItem[];
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

export default function CustomerDetail() {
  const { id } = useParams();
  const user = useUser();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const finance = can.finance(user.role);
  const [tab, setTab] = useState<'schedule' | 'payments' | 'documents' | 'requests' | 'communication'>('schedule');
  const [payFor, setPayFor] = useState<Installment | null>(null);
  const [modal, setModal] = useState<null | 'edit' | 'upload' | 'cancel'>(null);
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
            <Button icon={<Upload />} onClick={() => setModal('upload')}>
              Upload
            </Button>
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
              {
                value: 'documents',
                label: 'Documents',
                count: c.documents.length,
              },
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
          {tab === 'schedule' && <InstallmentTable rows={c.installments} onPay={finance ? setPayFor : undefined} />}
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
                      <ButtonLink to={`/receipts/${t.id}`} size="sm" variant="ghost" icon={<Receipt />}>
                        Receipt
                      </ButtonLink>
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
            <div>
              <div className="flex justify-end px-5 pt-4">
                <Button size="sm" icon={<Upload />} onClick={() => setModal('upload')}>
                  Upload
                </Button>
              </div>
              <DocumentList docs={c.documents} />
            </div>
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
    </div>
  );
}
