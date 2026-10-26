import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, Check, CheckCheck, Download, FileText, FileUp, FolderOpen, Home, Inbox, IndianRupee, KeyRound, LogOut, Mail, MessageCircle, Phone, Plus, Receipt, UserRound } from 'lucide-react';
import { CONSTRUCTION_STAGES, CUSTOMER_REQUEST_TYPES, CUSTOMER_UPLOAD_TYPES, DOCUMENT_SECTIONS, documentSection, telHref, waHref, type NotificationItem, type PortalData, type User } from '@estateflow/shared';
import { api, auth } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { daysLeft } from '@/lib/whatsapp';
import { firstName, fmtDate, greeting, inr, inrShort, timeAgo, todayStr } from '@/lib/format';
import { required, useForm } from '@/hooks/useForm';
import { useAction } from '@/hooks/queries';
import { Badge, RegistryBadge, StatusBadge } from '@/components/ui/Badge';
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader, InfoRow } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Avatar, PageHeader, Progress } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Modal';
import { BrandLockup, BRAND, PoweredBy } from '@/components/layout/Brand';
import { NotificationBell } from '@/components/layout/Topbar';
import { InstallmentTable } from '@/components/domain/FinanceViews';
import { DocumentList, UploadDocumentModal } from '@/components/domain/Documents';
import { GalleryImage } from '@/components/domain/PropertyGallery';

type Portal = Omit<PortalData, 'documents'> & { documents: (PortalData['documents'][number] & { mine?: boolean })[] };
export const usePortal = () => useQuery({ queryKey: ['portal'], queryFn: () => api.get<Portal>('/portal') });

function Loadable({ children }: { children: (p: Portal) => React.ReactNode }) {
  const q = usePortal();
  if (q.isPending) return <PageSkeleton stats={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

// ─── Shell ─────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/payments', label: 'Payments', icon: IndianRupee },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

/** The customer portal frame: top bar with section links (desktop), bottom bar (phone). */
export function CustomerShell() {
  const user = useUser();
  const { logout } = useAuth();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl bg-brand-950 px-2 py-1">
            <BrandLockup />
          </div>
          <nav aria-label="Primary" className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors', isActive ? 'bg-brand-50 text-brand-800' : 'text-stone-600 hover:bg-stone-100 hover:text-ink')}>
                <n.icon className="size-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <NotificationBell />
            <div className="ml-1 hidden items-center gap-2 sm:flex">
              <Avatar name={user.name} size="sm" />
              <span className="max-w-[140px] truncate text-[13px] font-semibold text-ink">{user.name}</span>
            </div>
            <button onClick={logout} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100 hover:text-ink" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-7 lg:px-8 md:pb-10">
        <Suspense fallback={<PageSkeleton />}>
          <div key={location.pathname} className="page-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
      <footer className="no-print hidden items-center justify-between border-t border-stone-200/70 px-8 py-4 text-[12px] text-stone-400 md:flex">
        <span>
          © {new Date().getFullYear()} {BRAND.company}
        </span>
        <PoweredBy />
      </footer>
      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md md:hidden" aria-label="Primary mobile">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end} className={({ isActive }) => cn('flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold', isActive ? 'text-brand-800' : 'text-stone-500')}>
                <n.icon className="size-[19px]" />
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// ─── Home ──────────────────────────────────────────────────────────────────

function StageTrack({ stage }: { stage?: string | null }) {
  const idx = Math.max(0, CONSTRUCTION_STAGES.indexOf((stage ?? 'Booking') as (typeof CONSTRUCTION_STAGES)[number]));
  return (
    <ol aria-label="Construction progress">
      {CONSTRUCTION_STAGES.map((s, i) => (
        <li key={s} className="relative flex items-center gap-3 py-1.5" aria-current={i === idx ? 'step' : undefined}>
          {i < CONSTRUCTION_STAGES.length - 1 && <span className={cn('absolute top-6 left-[11px] h-full w-0.5', i < idx ? 'bg-brand-600' : 'bg-stone-200')} />}
          <span className={cn('relative grid size-6 shrink-0 place-items-center rounded-full border-2', i < idx ? 'border-brand-600 bg-brand-600 text-white' : i === idx ? 'border-gold-400 bg-gold-50' : 'border-stone-300 bg-white')}>
            {i < idx && <Check className="size-3.5" />}
            {i === idx && <span className="size-2 rounded-full bg-gold-500" />}
          </span>
          <span className={cn('text-[14px]', i === idx ? 'font-semibold text-ink' : i < idx ? 'text-stone-600' : 'text-stone-400')}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

const daysLeftLabel = (date: string) => {
  const d = daysLeft(date) ?? 0;
  return d > 1 ? `${d} days left` : d === 1 ? 'Tomorrow' : d === 0 ? 'Today' : `${-d} days ago`;
};

function RegistryCard({ c }: { c: PortalData['customer'] }) {
  const status = c.registry_status ?? 'Not done';
  const line = status === 'Done' ? `Done${c.registry_number ? ` – No. ${c.registry_number}` : ''}${c.registry_date ? ` · ${fmtDate(c.registry_date)}` : ''}` : status === 'Date fixed' ? `Date fixed – ${fmtDate(c.registry_date)}` : 'Not done yet';
  return (
    <Card className={cn('flex items-center gap-3 p-5', status === 'Date fixed' && 'border-gold-200')}>
      <FileText className="size-5 shrink-0 text-brand-700" />
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">Registry</p>
        <p className="mt-0.5 font-semibold text-ink">{line}</p>
        {status === 'Date fixed' && c.registry_date && <p className="text-[13px] text-stone-500">{daysLeftLabel(c.registry_date)} · Please keep your documents ready.</p>}
      </div>
      <RegistryBadge status={status} />
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">{label}</p>
      <p className={cn('num mt-1 font-display text-[20px] font-semibold text-ink', tone)}>{value}</p>
    </Card>
  );
}

export function PortalHome() {
  const user = useUser();
  return (
    <>
      <PageHeader title={`${greeting()}, ${firstName(user.name)}`} subtitle="Your property, payments and paperwork in one place" />
      <Loadable>
        {(p) => {
          const f = p.financials;
          const cover = p.gallery?.find((g) => g.is_cover) ?? p.gallery?.[0] ?? p.property?.cover ?? null;
          return (
            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-5">
                <Card className="overflow-hidden">
                  {p.property && <GalleryImage img={cover} fallback={p.property} className="aspect-[16/7] w-full" eager />}
                  <div className="p-5">
                    <p className="text-[12px] font-semibold text-stone-500">Your property</p>
                    <h2 className="font-display text-[22px] font-semibold text-ink">{p.property ? `${p.property.project} · ${p.property.unit_number}` : (p.customer.property_project ?? 'Your booking')}</h2>
                    {p.property && (
                      <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                        <InfoRow label="Type">{p.property.type}</InfoRow>
                        <InfoRow label="Block">{p.property.block || '—'}</InfoRow>
                        <InfoRow label="Size">{p.property.area_sqft ? `${p.property.area_sqft} sq ft` : '—'}</InfoRow>
                        <InfoRow label="Rate">{p.property.rate_per_sqft ? `${inr(p.property.rate_per_sqft)}/sq ft` : '—'}</InfoRow>
                        <InfoRow label="Price">{inr(p.property.price)}</InfoRow>
                        <InfoRow label="Location">{p.property.location}</InfoRow>
                      </div>
                    )}
                    {(p.gallery ?? []).some((i) => i.is_ai_generated) && <p className="mt-2 text-[12px] text-stone-500">Artist's impressions are illustrations; the finished home may differ.</p>}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Payment summary" action={<ButtonLink to="/payments" size="sm">View payments</ButtonLink>} />
                  <div className="px-5 pb-5">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="Total" value={inrShort(f.total_value)} />
                      <Stat label="Paid" value={inrShort(f.paid)} tone="text-brand-800" />
                      <Stat label="Pending" value={inrShort(f.outstanding)} />
                      <Stat label={f.overdue ? 'Overdue' : 'Next due'} value={f.overdue ? inrShort(f.overdue) : f.next_installment ? fmtDate(f.next_installment.due_date) : '—'} tone={f.overdue ? 'text-red-700' : undefined} />
                    </div>
                    <Progress value={f.progress} className="mt-4" />
                    {f.next_installment && (
                      <p className="mt-2 text-[13px] text-stone-600">
                        Next: {f.next_installment.label} · {inr(f.next_installment.balance)} due {fmtDate(f.next_installment.due_date)}
                      </p>
                    )}
                  </div>
                </Card>

                {p.property && (
                  <Card>
                    <CardHeader title="Construction progress" />
                    <div className="px-5 pb-5">
                      <StageTrack stage={p.property.construction_stage} />
                      {p.property.possession && <p className="mt-2 text-[13px] text-stone-500">Expected possession: {p.property.possession}</p>}
                    </div>
                  </Card>
                )}
              </div>

              <div className="space-y-5">
                <RegistryCard c={p.customer} />
                {p.customer.agent_name && (
                  <Card className="p-5">
                    <p className="text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">Your relationship manager</p>
                    <div className="mt-3 flex items-center gap-3">
                      <Avatar name={p.customer.agent_name} />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{p.customer.agent_name}</p>
                        {p.customer.agent_email && (
                          <a href={`mailto:${p.customer.agent_email}`} className="inline-flex items-center gap-1 text-[13px] text-brand-800">
                            <Mail className="size-3.5" /> {p.customer.agent_email}
                          </a>
                        )}
                      </div>
                    </div>
                    {p.customer.agent_phone && (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <ButtonAnchor href={telHref(p.customer.agent_phone)} icon={<Phone />}>
                          Call
                        </ButtonAnchor>
                        <ButtonAnchor href={waHref(p.customer.agent_phone, `Hello ${firstName(p.customer.agent_name)}, `)} target="_blank" rel="noreferrer" icon={<MessageCircle />}>
                          WhatsApp
                        </ButtonAnchor>
                      </div>
                    )}
                  </Card>
                )}
                <Card className="px-5 py-2">
                  {p.deal && <InfoRow label="Booking">{p.deal.code}</InfoRow>}
                  <InfoRow label="Booked on">{fmtDate(p.customer.booking_date)}</InfoRow>
                  <InfoRow label="Nominee">{p.customer.nominee_name ? `${p.customer.nominee_name}${p.customer.nominee_relation ? ` (${p.customer.nominee_relation})` : ''}` : 'Not added'}</InfoRow>
                  {p.property?.rera_number && <InfoRow label="RERA">{p.property.rera_number}</InfoRow>}
                </Card>
                {p.property && p.property.amenities.length > 0 && (
                  <Card className="p-5">
                    <p className="mb-2 text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">Amenities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.property.amenities.map((a) => (
                        <Badge key={a} tone="green">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
                {p.company.phone && (
                  <p className="text-center text-[13px] text-stone-500">
                    {p.company.name} ·{' '}
                    <a href={telHref(p.company.phone)} className="font-semibold text-brand-800">
                      {p.company.phone}
                    </a>
                  </p>
                )}
              </div>
            </div>
          );
        }}
      </Loadable>
    </>
  );
}

// ─── Payments ──────────────────────────────────────────────────────────────

export function PortalPayments() {
  const [params] = useSearchParams();
  const highlight = Number(params.get('receipt')) || undefined;
  return (
    <>
      <PageHeader title="Payments" subtitle="Your instalment schedule and receipts" />
      <Loadable>
        {(p) => {
          const f = p.financials;
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Total" value={inr(f.total_value)} />
                <Stat label="Paid" value={inr(f.paid)} tone="text-brand-800" />
                <Stat label="Pending" value={inr(f.outstanding)} />
                <Stat label="Overdue" value={inr(f.overdue)} tone={f.overdue ? 'text-red-700' : undefined} />
              </div>
              <Card>
                <CardHeader title="Instalment schedule" subtitle={`${f.paid_installments} of ${f.installments} paid · ${f.installments - f.paid_installments} left`} />
                {p.installments.length ? <InstallmentTable rows={p.installments} /> : <EmptyState compact icon={<Receipt />} title="No payment schedule yet" />}
              </Card>
              <Card>
                <CardHeader title="Receipts" subtitle={`${p.transactions.length} payments received`} />
                {p.transactions.length ? (
                  <ul className="divide-y divide-stone-100">
                    {p.transactions.map((t) => (
                      <li key={t.id} className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', highlight === t.id && 'bg-gold-50')}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                          <Receipt className="size-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="num text-[14px] font-bold text-ink">{inr(t.amount)}</p>
                          <p className="truncate text-[12.5px] text-stone-500">
                            {t.receipt_number ?? t.code} · {t.installment_label ?? t.type} · {t.method} · {fmtDate(t.payment_date)}
                          </p>
                        </div>
                        <StatusBadge status={t.status} />
                        <Button size="sm" icon={<Download />} onClick={() => api.download(`/transactions/${t.id}/receipt.pdf`, `Receipt-${t.receipt_number ?? t.code}.pdf`).catch((e) => toast.error(e.message))}>
                          PDF
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact icon={<Receipt />} title="No payments yet" />
                )}
              </Card>
            </div>
          );
        }}
      </Loadable>
    </>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────

export function PortalDocuments() {
  const [uploading, setUploading] = useState(false);
  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Your agreement, receipts and KYC papers"
        actions={
          <Button variant="primary" icon={<FileUp />} onClick={() => setUploading(true)}>
            Upload document
          </Button>
        }
      />
      <Loadable>
        {(p) => {
          const docs = p.documents.map((d) => ({ ...d, entity_type: 'customer' as const, entity_id: p.customer.id, uploaded_by_name: d.mine ? 'You' : (d.uploaded_by_name ?? p.company.name) }));
          if (!docs.length) return <EmptyState icon={<FolderOpen />} title="No documents yet" message="Your agreement, receipts and KYC documents appear here." />;
          return (
            <Card className="divide-y divide-stone-100">
              {DOCUMENT_SECTIONS.map((s) => {
                const mine = docs.filter((d) => documentSection(d.doc_type).key === s.key);
                if (!mine.length) return null;
                return (
                  <section key={s.key} aria-labelledby={`docs-${s.key}`} className="py-1">
                    <h3 id={`docs-${s.key}`} className="px-4 pt-3 text-[14px] font-bold text-ink sm:px-5">
                      {s.title} <span className="font-medium text-stone-400">· {s.hindi}</span>
                    </h3>
                    <DocumentList docs={mine} canDelete={false} />
                  </section>
                );
              })}
            </Card>
          );
        }}
      </Loadable>
      {uploading && (
        <UploadDocumentModal
          open
          onClose={() => setUploading(false)}
          entityType="customer"
          entityId={0}
          endpoint="/portal/documents"
          types={CUSTOMER_UPLOAD_TYPES}
          defaultType="Aadhaar"
          success="Uploaded. Your relationship manager has been told."
        />
      )}
    </>
  );
}

// ─── Requests ──────────────────────────────────────────────────────────────

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<(typeof CUSTOMER_REQUEST_TYPES)[number]>('Query');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const send = useAction(() => api.post('/portal/requests', { type, subject: subject.trim(), message: message.trim() || null, preferred_date: date || null }), { success: 'Request sent', invalidate: [['portal']], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="New request"
      description="Your relationship manager replies here."
      onSubmit={() => (subject.trim().length < 3 ? toast.error('Add a short subject') : send.mutate(undefined))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={send.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {CUSTOMER_REQUEST_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Subject" required>
          {(id) => <Input id={id} value={subject} maxLength={140} onChange={(e) => setSubject(e.target.value)} />}
        </Field>
        <Field label="Details" hint="Optional">
          {(id) => <Textarea id={id} rows={4} value={message} maxLength={2000} onChange={(e) => setMessage(e.target.value)} />}
        </Field>
        {(type === 'Site visit' || type === 'Document') && (
          <Field label="Preferred date" hint="Optional">
            {(id) => <Input id={id} type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function PortalRequests() {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        title="Requests"
        subtitle="Site visits, questions and concerns"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
            New request
          </Button>
        }
      />
      <Loadable>
        {(p) =>
          p.requests.length ? (
            <div className="space-y-3">
              {p.requests.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-stone-500">
                        {r.type} · {fmtDate(r.created_at)}
                        {r.preferred_date ? ` · preferred ${fmtDate(r.preferred_date)}` : ''}
                      </p>
                      <p className="mt-0.5 font-semibold text-ink">{r.subject}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.message && <p className="mt-2 text-[13.5px] whitespace-pre-line text-stone-600">{r.message}</p>}
                  {r.response && (
                    <div className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-[13.5px]">
                      <p className="text-[12px] font-semibold text-brand-800">Reply{r.handled_by_name ? ` from ${r.handled_by_name}` : ''}</p>
                      <p className="mt-0.5 whitespace-pre-line text-ink">{r.response}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Inbox />} title="No requests yet" message="Book a site visit, ask a question or raise a concern. Your relationship manager replies here." />
          )
        }
      </Loadable>
      {creating && <NewRequestModal onClose={() => setCreating(false)} />}
    </>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────────

export function PortalNotifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ data: NotificationItem[]; meta: { unread: number } }>('/notifications', { limit: 40 }) });
  const readAll = useAction(() => api.post('/notifications/read-all'), { invalidate: [['notifications']] });
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          (q.data?.meta.unread ?? 0) > 0 && (
            <Button icon={<CheckCheck />} onClick={() => readAll.mutate(undefined)}>
              Mark all read
            </Button>
          )
        }
      />
      {q.isPending ? (
        <PageSkeleton stats={0} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.data.length ? (
        <Card className="divide-y divide-stone-100">
          {q.data.data.map((n) => (
            <div key={n.id} className={cn('flex gap-3 px-5 py-3.5', !n.is_read && 'bg-brand-50/40')}>
              <Bell className="mt-0.5 size-4 shrink-0 text-stone-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-ink">{n.title}</p>
                <p className="text-[13px] text-stone-600">{n.message}</p>
                <p className="mt-1 text-[11.5px] text-stone-400">{timeAgo(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <Button size="sm" variant="ghost" onClick={() => api.patch(`/notifications/${n.id}/read`, {}).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))}>
                  Mark read
                </Button>
              )}
              {n.link && (
                <Link to={n.link} className="self-center text-[12.5px] font-semibold text-brand-800">
                  Open
                </Link>
              )}
            </div>
          ))}
        </Card>
      ) : (
        <EmptyState icon={<Bell />} title="No notifications yet" />
      )}
    </>
  );
}

// ─── Profile ───────────────────────────────────────────────────────────────

export function PortalProfile() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const profile = useForm({ name: user.name, phone: user.phone ?? '' }, (v) => ({ name: required(v.name) }));
  const saveProfile = useAction((v: typeof profile.values) => api.put<{ user: User }>('/auth/profile', v), { success: 'Profile saved', invalidate: [['portal']], onSuccess: (r) => setUser(r.user) });
  const pw = useForm({ current_password: '', new_password: '', confirm: '' }, (v) => ({
    current_password: required(v.current_password),
    new_password: v.new_password.length < 8 || !/[A-Z]/.test(v.new_password) || !/[0-9]/.test(v.new_password) ? 'Min 8 characters with an uppercase letter and a number' : undefined,
    confirm: v.confirm !== v.new_password ? 'Passwords do not match' : undefined,
  }));
  const changePw = useAction((v: typeof pw.values) => auth.changePassword(v.current_password, v.new_password), { success: (m) => m, invalidate: [], onSuccess: () => pw.reset() });
  return (
    <>
      <PageHeader title="Profile" subtitle={user.email} actions={<Button icon={<LogOut />} onClick={logout}>Sign out</Button>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="My details" icon={<UserRound />} />
          <form className="space-y-4 px-5 pb-5" onSubmit={(e) => (e.preventDefault(), profile.submit((v) => saveProfile.mutateAsync(v)))} noValidate>
            <Field label="Full name" error={profile.errors.name}>
              {(id) => <Input id={id} {...profile.bind('name')} />}
            </Field>
            <Field label="Phone">{(id) => <Input id={id} {...profile.bind('phone')} />}</Field>
            <Button type="submit" variant="primary" loading={profile.busy}>
              Save profile
            </Button>
          </form>
        </Card>
        <Card>
          <CardHeader title="Change password" icon={<KeyRound />} />
          <form className="space-y-4 px-5 pb-5" onSubmit={(e) => (e.preventDefault(), pw.submit((v) => changePw.mutateAsync(v)))} noValidate>
            <Field label="Current password" error={pw.errors.current_password}>
              {(id) => <Input id={id} type="password" autoComplete="current-password" {...pw.bind('current_password')} />}
            </Field>
            <Field label="New password" error={pw.errors.new_password} hint="At least 8 characters, one uppercase letter and one number">
              {(id) => <Input id={id} type="password" autoComplete="new-password" {...pw.bind('new_password')} />}
            </Field>
            <Field label="Confirm new password" error={pw.errors.confirm}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" {...pw.bind('confirm')} />}
            </Field>
            <Button type="submit" variant="primary" loading={pw.busy}>
              Update password
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
