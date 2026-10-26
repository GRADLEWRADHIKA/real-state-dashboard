import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CheckCheck, Download, Eye, FileUp, FolderOpen, Home, Inbox, IndianRupee, LogOut, MessageCircle, Phone, Plus, UserRound } from 'lucide-react';
import { CONSTRUCTION_STAGES, CUSTOMER_REQUEST_TYPES, CUSTOMER_UPLOAD_TYPES, DOCUMENT_SECTIONS, documentSection, telHref, waHref, type Installment, type NotificationItem, type PortalData, type User } from '@estateflow/shared';
import { api, auth } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { daysLeft } from '@/lib/whatsapp';
import { fileSize, firstName, fmtDate, inr, timeAgo, todayStr } from '@/lib/format';
import { required, useForm } from '@/hooks/useForm';
import { useAction } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { BrandMark, BRAND, PoweredBy } from '@/components/layout/Brand';
import { NotificationBell } from '@/components/layout/Topbar';
import { UploadDocumentModal } from '@/components/domain/Documents';
import { GalleryImage } from '@/components/domain/PropertyGallery';

/*
 * The buyer's portal. Style: an achromatic ledger on a stone ground. Money and counts are set in ink;
 * the brand green marks only what is paid (the one data hue) and gold marks the one thing due next.
 * Every screen first answers "what do I pay next, and how far along is my home?". The signature element
 * is the stage ledger: the instalment plan drawn as one bar, each segment as wide as its amount and
 * named after the construction stage it is tied to, so payments and building read as one story.
 *
 * Desktop grid: 240px sidebar + a fluid canvas with 40px gutters, max 1120px; blocks on a 12-column
 * grid with a 20px gap (8 + 4 spans), so every row lands on the same two edges.
 */

type Portal = Omit<PortalData, 'documents'> & { documents: (PortalData['documents'][number] & { mine?: boolean })[] };
export const usePortal = () => useQuery({ queryKey: ['portal'], queryFn: () => api.get<Portal>('/portal') });

function Loadable({ children }: { children: (p: Portal) => ReactNode }) {
  const q = usePortal();
  if (q.isPending) return <PageSkeleton stats={3} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

// ─── Building blocks ────────────────────────────────────────────────────────

function Panel({ children, className, labelledBy }: { children: ReactNode; className?: string; labelledBy?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={cn('rounded-lg border border-[#e6e3de] bg-white', className)}>
      {children}
    </section>
  );
}

function PanelHead({ id, title, meta, action }: { id: string; title: string; meta?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[14px] font-semibold text-ink">
          {title}
        </h2>
        {meta && <p className="mt-0.5 text-[13px] text-stone-500">{meta}</p>}
      </div>
      {action}
    </header>
  );
}

function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="shrink-0 rounded text-[13px] font-semibold text-ink underline decoration-stone-300 underline-offset-4 hover:decoration-ink">
      {children}
    </Link>
  );
}

const when = (date: string) => {
  const d = daysLeft(date) ?? 0;
  return d > 1 ? `in ${d} days` : d === 1 ? 'tomorrow' : d === 0 ? 'today' : `${-d} days overdue`;
};

/** "On Ground Floor Slab" → "Ground slab", "Booking Amount" → "Booking": names short enough to sit under a segment. */
const shortStage = (label: string) =>
  label
    .replace(/^On /, '')
    .replace(/^Booking Amount$/, 'Booking')
    .replace(/ Floor Slab$/, ' slab')
    .replace(/^Possession$/, 'Possession');

/** The first instalment with money still to pay: the one the buyer acts on next. */
const nextOf = (rows: Installment[]) => rows.find((i) => i.balance > 0) ?? null;

/**
 * The stage ledger: one bar for the whole price, a segment per instalment, sized by amount.
 * Paid in green, the next one in gold, the rest in stone; a partly paid segment fills in green from the left.
 */
function StageLedger({ rows, total }: { rows: Installment[]; total: number }) {
  const next = nextOf(rows);
  return (
    <div>
      <div className="flex h-3.5 gap-[3px]" role="img" aria-label={`Payment plan: ${rows.filter((r) => r.balance <= 0).length} of ${rows.length} instalments paid`}>
        {rows.map((r) => {
          const paidShare = r.amount ? Math.min(1, r.paid_amount / r.amount) : 0;
          const isNext = next?.id === r.id;
          return (
            <span
              key={r.id}
              title={`${r.label} · ${inr(r.amount)} · ${r.balance <= 0 ? 'paid' : isNext ? `due ${fmtDate(r.due_date)}` : `due ${fmtDate(r.due_date)}`}`}
              className={cn('relative h-full overflow-hidden first:rounded-l-[3px] last:rounded-r-[3px]', isNext ? 'bg-gold-300' : 'bg-[#e9e6e0]')}
              style={{ width: `${(r.amount / (total || 1)) * 100}%` }}
            >
              {paidShare > 0 && <span className="absolute inset-y-0 left-0 bg-brand-700" style={{ width: `${paidShare * 100}%` }} />}
            </span>
          );
        })}
      </div>
      <ol className="mt-2 hidden gap-[3px] text-[11.5px] leading-tight text-stone-500 sm:flex" aria-hidden>
        {rows.map((r) => {
          const share = r.amount / (total || 1);
          const isNext = next?.id === r.id;
          return (
            <li key={r.id} className={cn('overflow-visible whitespace-nowrap', isNext && 'font-semibold text-ink')} style={{ width: `${share * 100}%` }}>
              {isNext || share >= 0.1 ? shortStage(r.label) : ''}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatusText({ r, next }: { r: Installment; next: Installment | null }) {
  if (r.balance <= 0) return <span className="text-stone-500">Paid{r.payment_date ? ` ${fmtDate(r.payment_date)}` : ''}</span>;
  if (r.status === 'Overdue') return <span className="font-semibold text-red-700">Overdue · {when(r.due_date)}</span>;
  if (next?.id === r.id)
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
        <span className="size-2 rounded-full bg-gold-500" aria-hidden /> Next · {when(r.due_date)}
      </span>
    );
  if (r.paid_amount > 0) return <span className="text-ink">Part paid</span>;
  return <span className="text-stone-500">Upcoming</span>;
}

// ─── Shell ─────────────────────────────────────────────────────────────────

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/payments', label: 'Payments', icon: IndianRupee },
  { to: '/documents', label: 'Documents', icon: FolderOpen },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

/** The buyer's frame: a sidebar on the page ground (desktop) and a bottom bar with a slim top bar (phone). */
export function CustomerShell() {
  const user = useUser();
  const { logout } = useAuth();
  const location = useLocation();
  const q = usePortal();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  const home = q.data?.property ? `${q.data.property.project} · ${q.data.property.unit_number}` : q.data?.customer.property_project;
  const agent = q.data?.customer;
  return (
    <div className="min-h-dvh bg-[#f4f3f1] md:flex">
      <aside className="no-print sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col px-3 py-6 md:flex" aria-label="Your account">
        <div className="flex items-center gap-2.5 px-2.5">
          <BrandMark className="size-9 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-ink">{BRAND.company}</p>
            <p className="truncate text-[12.5px] text-stone-500">{home ?? 'Your home'}</p>
          </div>
        </div>
        <nav aria-label="Primary" className="mt-8 space-y-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn('flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors', isActive ? 'bg-[#e7e4df] font-semibold text-ink' : 'text-stone-600 hover:bg-[#ece9e4] hover:text-ink')}
            >
              <n.icon className="size-4 text-stone-500" strokeWidth={1.6} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        {agent?.agent_name && (
          <div className="mt-10 px-2.5">
            <p className="text-[12.5px] text-stone-500">Your relationship manager</p>
            <p className="mt-1 text-[14px] font-semibold text-ink">{agent.agent_name}</p>
            {agent.agent_phone && (
              <div className="mt-1.5 flex gap-3 text-[13px]">
                <a href={telHref(agent.agent_phone)} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
                  <Phone className="size-3.5" /> Call
                </a>
                <a href={waHref(agent.agent_phone, `Hello ${firstName(agent.agent_name)}, `)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
                  <MessageCircle className="size-3.5" /> WhatsApp
                </a>
              </div>
            )}
          </div>
        )}
        <div className="mt-auto space-y-3 px-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[12px] text-stone-500">{user.email}</p>
            </div>
            <div className="flex items-center">
              <NotificationBell />
              <button onClick={logout} className="rounded-md p-2 text-stone-500 hover:bg-[#ece9e4] hover:text-ink" aria-label="Sign out" title="Sign out">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
          <PoweredBy />
        </div>
      </aside>

      <header className="no-print sticky top-0 z-30 flex h-12 items-center gap-2.5 border-b border-[#e6e3de] bg-[#f4f3f1] px-4 md:hidden">
        <BrandMark className="size-7 rounded-md" />
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{home ?? BRAND.company}</p>
        <NotificationBell />
      </header>

      <main className="min-w-0 flex-1 px-4 pt-5 pb-24 md:px-10 md:pt-9 md:pb-12">
        <div className="mx-auto max-w-[1120px]">
          <Suspense fallback={<PageSkeleton />}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </Suspense>
        </div>
      </main>

      <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-[#e6e3de] bg-white md:hidden" aria-label="Primary mobile">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end} className={({ isActive }) => cn('flex h-full flex-col items-center justify-center gap-1 text-[11px]', isActive ? 'font-semibold text-ink' : 'text-stone-500')}>
                <n.icon className="size-[19px]" strokeWidth={1.6} />
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Title({ title, meta, actions, serif }: { title: string; meta?: ReactNode; actions?: ReactNode; serif?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className={cn('text-ink', serif ? 'font-display text-[26px] leading-tight font-semibold md:text-[30px]' : 'text-[24px] font-semibold')}>{title}</h1>
        {meta && <p className="mt-1.5 text-[14px] text-stone-600">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const PrimaryLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
    {children}
  </Link>
);
const SecondaryAnchor = ({ href, children, external }: { href: string; children: ReactNode; external?: boolean }) => (
  <a href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#e7e4df] px-3.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-[#dedad3]">
    {children}
  </a>
);

const receipt = (id: number, name: string) => api.download(`/transactions/${id}/receipt.pdf`, `Receipt-${name}.pdf`).catch((e) => toast.error(e.message));

// ─── Home ──────────────────────────────────────────────────────────────────

function ConstructionTrack({ stage, possession }: { stage?: string | null; possession?: string | null }) {
  const idx = Math.max(0, CONSTRUCTION_STAGES.indexOf((stage ?? 'Booking') as (typeof CONSTRUCTION_STAGES)[number]));
  return (
    <div className="px-5 pb-5">
      <ol className="grid gap-2.5 sm:grid-cols-6 sm:gap-0" aria-label="Construction stages">
        {CONSTRUCTION_STAGES.map((s, i) => (
          <li key={s} className="relative flex items-center gap-3 sm:block" aria-current={i === idx ? 'step' : undefined}>
            <div className="flex items-center">
              <span className={cn('relative z-10 size-3 shrink-0 rounded-full', i < idx ? 'bg-brand-700' : i === idx ? 'bg-white ring-[3px] ring-gold-400' : 'bg-[#dcd8d1]')} />
              {i < CONSTRUCTION_STAGES.length - 1 && <span className={cn('hidden h-[3px] flex-1 sm:block', i < idx ? 'bg-brand-700' : 'bg-[#e9e6e0]')} />}
            </div>
            <p className={cn('text-[13px] leading-snug sm:mt-2 sm:pr-2 sm:text-[12.5px]', i === idx ? 'font-semibold text-ink' : i < idx ? 'text-stone-600' : 'text-stone-400')}>{s}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[13.5px] text-stone-600">
        <span className="font-semibold text-ink">{CONSTRUCTION_STAGES[idx]}</span> {idx < CONSTRUCTION_STAGES.length - 1 ? 'is under way' : ''}
        {possession ? ` · possession expected ${possession}` : ''}
      </p>
    </div>
  );
}

function RegistryBlock({ c }: { c: PortalData['customer'] }) {
  const status = c.registry_status ?? 'Not done';
  return (
    <div className="px-5 py-4">
      <h2 id="registry" className="text-[14px] font-semibold text-ink">
        Registry
      </h2>
      {status === 'Done' ? (
        <>
          <p className="mt-1.5 text-[18px] font-semibold text-ink">Done</p>
          <p className="text-[13px] text-stone-600">
            {c.registry_number ? `No. ${c.registry_number}` : ''}
            {c.registry_date ? ` · ${fmtDate(c.registry_date)}` : ''}
          </p>
        </>
      ) : status === 'Date fixed' && c.registry_date ? (
        <>
          <p className="mt-1.5 text-[18px] font-semibold text-ink">{fmtDate(c.registry_date)}</p>
          <p className="text-[13px] text-stone-600">
            <span className="mr-1.5 inline-block size-2 rounded-full bg-gold-500 align-middle" aria-hidden />
            Date fixed, {when(c.registry_date)}. Keep your ID proof, photos and receipts ready.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-[18px] font-semibold text-stone-500">Not scheduled yet</p>
          <p className="text-[13px] text-stone-600">We will fix a date with you once the payments for it are complete.</p>
        </>
      )}
    </div>
  );
}

export function PortalHome() {
  return (
    <Loadable>
      {(p) => {
        const f = p.financials;
        const next = nextOf(p.installments);
        const paidCount = p.installments.filter((i) => i.balance <= 0).length;
        const cover = p.gallery?.find((g) => g.is_cover) ?? p.gallery?.[0] ?? p.property?.cover ?? null;
        const pr = p.property;
        const c = p.customer;
        const docsBySection = DOCUMENT_SECTIONS.map((s) => ({ s, n: p.documents.filter((d) => documentSection(d.doc_type).key === s.key).length }));
        return (
          <>
            <Title
              serif
              title={pr ? `${pr.type} ${pr.unit_number}, ${pr.project}` : (c.property_project ?? 'Your home')}
              meta={
                <>
                  Booked {fmtDate(c.booking_date)}
                  {p.deal ? ` · ${p.deal.code}` : ''}
                  {pr?.possession ? ` · possession expected ${pr.possession}` : ''}
                </>
              }
              actions={
                <>
                  {c.agent_phone && (
                    <SecondaryAnchor href={telHref(c.agent_phone) ?? `tel:${c.agent_phone}`}>
                      <Phone className="size-4" /> Call {firstName(c.agent_name ?? 'us')}
                    </SecondaryAnchor>
                  )}
                  <PrimaryLink to="/requests?new=1">
                    <Plus className="size-4" /> New request
                  </PrimaryLink>
                </>
              }
            />

            <div className="grid gap-5 lg:grid-cols-12">
              <Panel className="lg:col-span-8" labelledBy="next-due">
                <div className="px-5 pt-5">
                  <h2 id="next-due" className="text-[14px] font-semibold text-ink">
                    {f.overdue > 0 ? 'Overdue now' : next ? `Next instalment · ${next.label}` : 'All instalments paid'}
                  </h2>
                  {next ? (
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
                      <div>
                        <p className="num text-[38px] leading-none font-semibold tracking-[-0.01em] text-ink">{inr(f.overdue > 0 ? f.overdue : next.balance)}</p>
                        <p className="mt-2 text-[14px] text-stone-600">
                          <span className={cn('mr-1.5 inline-block size-2 rounded-full align-middle', f.overdue > 0 ? 'bg-red-600' : 'bg-gold-500')} aria-hidden />
                          Due {fmtDate(next.due_date)}, {when(next.due_date)}
                        </p>
                      </div>
                      <dl className="grid grid-cols-3 gap-x-8 text-right">
                        <div>
                          <dt className="text-[12.5px] text-stone-500">Paid</dt>
                          <dd className="num text-[16px] font-semibold text-ink">{inr(f.paid)}</dd>
                        </div>
                        <div>
                          <dt className="text-[12.5px] text-stone-500">Left</dt>
                          <dd className="num text-[16px] font-semibold text-ink">{inr(f.outstanding)}</dd>
                        </div>
                        <div>
                          <dt className="text-[12.5px] text-stone-500">Price</dt>
                          <dd className="num text-[16px] font-semibold text-ink">{inr(f.total_value)}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <p className="mt-2 text-[15px] text-stone-600">Every instalment of {inr(f.total_value)} is paid. Thank you.</p>
                  )}
                </div>
                <div className="px-5 pt-6">
                  <StageLedger rows={p.installments} total={f.total_value} />
                  <p className="mt-3 text-[13px] text-stone-600">
                    {paidCount} of {p.installments.length} instalments paid, each due at a stage of construction.{' '}
                    <span className="inline-flex items-center gap-3 align-middle text-[12.5px] text-stone-500">
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-brand-700" />Paid</span>
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-gold-300" />Next</span>
                      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-[#e9e6e0]" />Later</span>
                    </span>
                  </p>
                </div>
                <table className="mt-4 w-full text-[13.5px]">
                  <caption className="sr-only">Recent and upcoming instalments</caption>
                  <thead>
                    <tr className="text-left text-[12px] text-stone-500">
                      <th className="py-2 pl-5 font-medium">Instalment</th>
                      <th className="hidden py-2 font-medium sm:table-cell">Due</th>
                      <th className="py-2 pr-4 text-right font-medium">Amount</th>
                      <th className="py-2 pr-5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const at = next ? p.installments.findIndex((i) => i.id === next.id) : p.installments.length;
                      return p.installments.slice(Math.max(0, at - 1), Math.max(0, at - 1) + 4);
                    })().map((r) => (
                      <tr key={r.id} className="border-t border-[#efece8]">
                        <td className="py-2.5 pl-5 text-ink">{r.label}</td>
                        <td className="hidden py-2.5 text-stone-600 sm:table-cell">{fmtDate(r.due_date)}</td>
                        <td className="num py-2.5 pr-4 text-right text-ink">{inr(r.amount)}</td>
                        <td className="py-2.5 pr-5">
                          <StatusText r={r} next={next} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-[#efece8] px-5 py-3">
                  <TextLink to="/payments">Full schedule and receipts</TextLink>
                </div>
              </Panel>

              <Panel className="overflow-hidden lg:col-span-4" labelledBy="your-home">
                {pr && <GalleryImage img={cover} fallback={pr} className="aspect-[4/3] w-full" eager />}
                <div className="px-5 py-4">
                  <h2 id="your-home" className="text-[14px] font-semibold text-ink">
                    Your home
                  </h2>
                  {pr ? (
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[13.5px]">
                      <div>
                        <dt className="text-[12.5px] text-stone-500">Block</dt>
                        <dd className="text-ink">{pr.block || '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-stone-500">Size</dt>
                        <dd className="num text-ink">{pr.area_sqft ? `${pr.area_sqft.toLocaleString('en-IN')} sq ft` : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-stone-500">{pr.rate_per_sqft ? 'Rate' : 'Type'}</dt>
                        <dd className="num text-ink">{pr.rate_per_sqft ? `${inr(pr.rate_per_sqft)} / sq ft` : pr.type}</dd>
                      </div>
                      <div>
                        <dt className="text-[12.5px] text-stone-500">Nominee</dt>
                        <dd className="text-ink">{c.nominee_name ? `${c.nominee_name}${c.nominee_relation ? ` (${c.nominee_relation})` : ''}` : '—'}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-[12.5px] text-stone-500">Address</dt>
                        <dd className="text-ink">
                          {pr.location}, {pr.city}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-[13.5px] text-stone-600">Your unit details will appear here.</p>
                  )}
                  {(p.gallery ?? []).some((i) => i.is_ai_generated) && <p className="mt-3 text-[12px] text-stone-500">Artist's impression; the finished home may differ.</p>}
                </div>
              </Panel>

              <Panel className="lg:col-span-8" labelledBy="construction">
                <PanelHead id="construction" title="Construction" meta={pr?.construction_stage ? `Your ${pr.type.toLowerCase()} is at the ${pr.construction_stage.toLowerCase()} stage` : undefined} />
                <ConstructionTrack stage={pr?.construction_stage} possession={pr?.possession} />
              </Panel>

              <Panel className="flex flex-col lg:col-span-4" labelledBy="registry">
                <RegistryBlock c={c} />
                <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#efece8] px-5 py-4 text-[13.5px]">
                  <div>
                    <dt className="text-[12.5px] text-stone-500">Booking amount</dt>
                    <dd className="num text-ink">{inr(f.booking_amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-[12.5px] text-stone-500">RERA</dt>
                    <dd className="text-ink">{pr?.rera_number || p.company.rera || '—'}</dd>
                  </div>
                </dl>
              </Panel>

              <Panel className="lg:col-span-8" labelledBy="receipts">
                <PanelHead id="receipts" title="Recent receipts" meta={`${p.transactions.filter((t) => t.status === 'Completed').length} payments received`} action={<TextLink to="/payments">All receipts</TextLink>} />
                {p.transactions.length ? (
                  <table className="w-full text-[13.5px]">
                    <caption className="sr-only">Recent receipts</caption>
                    <thead>
                      <tr className="text-left text-[12px] text-stone-500">
                        <th className="py-2 pl-5 font-medium">Date</th>
                        <th className="py-2 font-medium">For</th>
                        <th className="hidden py-2 font-medium md:table-cell">Receipt</th>
                        <th className="hidden py-2 font-medium md:table-cell">Paid by</th>
                        <th className="py-2 pr-4 text-right font-medium">Amount</th>
                        <th className="py-2 pr-5 text-right font-medium">
                          <span className="sr-only">Download</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.transactions.slice(0, 3).map((t) => (
                        <tr key={t.id} className="border-t border-[#efece8]">
                          <td className="py-2.5 pl-5 text-stone-600">{fmtDate(t.payment_date)}</td>
                          <td className="py-2.5 text-ink">{t.installment_label ?? t.type}</td>
                          <td className="hidden py-2.5 text-stone-600 md:table-cell">{t.receipt_number ?? t.code}</td>
                          <td className="hidden py-2.5 text-stone-600 md:table-cell">{t.method}</td>
                          <td className="num py-2.5 pr-4 text-right font-semibold text-ink">{inr(t.amount)}</td>
                          <td className="py-2.5 pr-5 text-right">
                            {t.status === 'Completed' ? (
                              <button onClick={() => receipt(t.id, t.receipt_number ?? t.code)} className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-ink hover:underline">
                                <Download className="size-3.5" /> PDF
                              </button>
                            ) : (
                              <span className="text-[13px] text-stone-500">{t.status}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-5 pb-5 text-[13.5px] text-stone-600">No payments recorded yet.</p>
                )}
              </Panel>
              <Panel className="lg:col-span-4" labelledBy="docs-summary">
                <div className="px-5 py-4">
                  <h2 id="docs-summary" className="text-[14px] font-semibold text-ink">
                    Documents
                  </h2>
                  {p.documents.length ? (
                    <ul className="mt-2 space-y-1 text-[13.5px]">
                      {docsBySection.map(({ s, n }) => (
                        <li key={s.key} className="flex justify-between gap-3">
                          <span className={n ? 'text-ink' : 'text-stone-500'}>{s.title}</span>
                          <span className={cn('num', n ? 'text-ink' : 'text-stone-400')}>{n || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 text-[13.5px] text-stone-600">Your agreement and receipts will appear here.</p>
                  )}
                  <div className="mt-3">
                    <TextLink to="/documents">Open documents</TextLink>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        );
      }}
    </Loadable>
  );
}

// ─── Payments ──────────────────────────────────────────────────────────────

export function PortalPayments() {
  const [params] = useSearchParams();
  const highlight = Number(params.get('receipt')) || undefined;
  return (
    <Loadable>
      {(p) => {
        const f = p.financials;
        const next = nextOf(p.installments);
        const paidCount = p.installments.filter((i) => i.balance <= 0).length;
        return (
          <>
            <Title
              title="Payments"
              meta={next ? `${paidCount} of ${p.installments.length} instalments paid · next ${inr(next.balance)} due ${fmtDate(next.due_date)}` : `All ${p.installments.length} instalments paid`}
            />
            <Panel className="mb-5" labelledBy="totals">
              <h2 id="totals" className="sr-only">
                Totals
              </h2>
              <dl className="grid grid-cols-2 divide-[#efece8] sm:grid-cols-4 sm:divide-x">
                {[
                  ['Price', f.total_value, false],
                  ['Paid', f.paid, false],
                  ['Left to pay', f.outstanding, false],
                  ['Overdue', f.overdue, f.overdue > 0],
                ].map(([label, value, warn]) => (
                  <div key={label as string} className="px-5 py-4">
                    <dt className="text-[13px] text-stone-500">{label as string}</dt>
                    <dd className={cn('num mt-1 text-[24px] font-semibold', warn ? 'text-red-700' : value === 0 ? 'text-stone-400' : 'text-ink')}>{inr(value as number)}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel className="mb-5" labelledBy="schedule">
              <PanelHead id="schedule" title="Instalment schedule" meta="Each instalment falls due at a stage of construction" />
              <div className="px-5 pb-4">
                <StageLedger rows={p.installments} total={f.total_value} />
              </div>
              {p.installments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13.5px]">
                    <caption className="sr-only">Instalment schedule</caption>
                    <thead>
                      <tr className="text-left text-[12px] text-stone-500">
                        <th className="w-10 py-2 pl-5 text-right font-medium">No.</th>
                        <th className="py-2 pl-4 font-medium">Instalment</th>
                        <th className="py-2 font-medium">Due</th>
                        <th className="py-2 pr-4 text-right font-medium">Amount</th>
                        <th className="py-2 pr-4 text-right font-medium">Paid</th>
                        <th className="py-2 pr-5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.installments.map((r) => (
                        <tr key={r.id} className={cn('border-t border-[#efece8]', next?.id === r.id && 'bg-[#fbf8ee]')}>
                          <td className="num py-2.5 pl-5 text-right text-stone-500">{r.number}</td>
                          <td className="py-2.5 pl-4 text-ink">{r.label}</td>
                          <td className="py-2.5 text-stone-600">{fmtDate(r.due_date)}</td>
                          <td className="num py-2.5 pr-4 text-right text-ink">{inr(r.amount)}</td>
                          <td className={cn('num py-2.5 pr-4 text-right', r.paid_amount ? 'text-ink' : 'text-stone-400')}>{r.paid_amount ? inr(r.paid_amount) : '—'}</td>
                          <td className="py-2.5 pr-5">
                            <StatusText r={r} next={next} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#e6e3de] text-[13.5px] font-semibold">
                        <td className="py-3 pl-5" colSpan={3}>
                          Total
                        </td>
                        <td className="num py-3 pr-4 text-right text-ink">{inr(p.installments.reduce((s, r) => s + r.amount, 0))}</td>
                        <td className="num py-3 pr-4 text-right text-ink">{inr(p.installments.reduce((s, r) => s + r.paid_amount, 0))}</td>
                        <td className="pr-5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="px-5 pb-5 text-[13.5px] text-stone-600">Your payment schedule will appear here once your booking is confirmed.</p>
              )}
            </Panel>

            <Panel labelledBy="all-receipts">
              <PanelHead id="all-receipts" title="Receipts" meta={`${p.transactions.length} ${p.transactions.length === 1 ? 'payment' : 'payments'} recorded`} />
              {p.transactions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13.5px]">
                    <caption className="sr-only">Receipts</caption>
                    <thead>
                      <tr className="text-left text-[12px] text-stone-500">
                        <th className="py-2 pl-5 font-medium">Date</th>
                        <th className="py-2 font-medium">Receipt</th>
                        <th className="py-2 font-medium">For</th>
                        <th className="py-2 font-medium">Paid by</th>
                        <th className="py-2 pr-4 text-right font-medium">Amount</th>
                        <th className="py-2 pr-5 text-right font-medium">
                          <span className="sr-only">Download</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.transactions.map((t) => (
                        <tr key={t.id} className={cn('border-t border-[#efece8]', highlight === t.id && 'bg-[#fbf8ee]')}>
                          <td className="py-2.5 pl-5 text-stone-600">{fmtDate(t.payment_date)}</td>
                          <td className="py-2.5 text-stone-600">{t.receipt_number ?? t.code}</td>
                          <td className="py-2.5 text-ink">{t.installment_label ?? t.type}</td>
                          <td className="py-2.5 text-stone-600">
                            {t.method}
                            {t.status !== 'Completed' && <span className={cn('ml-1.5', t.status === 'Failed' ? 'text-red-700' : 'text-stone-500')}>· {t.status === 'Pending' ? 'clearing' : t.status.toLowerCase()}</span>}
                          </td>
                          <td className="num py-2.5 pr-4 text-right font-semibold text-ink">{inr(t.amount)}</td>
                          <td className="py-2.5 pr-5 text-right">
                            {t.status === 'Completed' && (
                              <button onClick={() => receipt(t.id, t.receipt_number ?? t.code)} className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-ink hover:underline">
                                <Download className="size-3.5" /> PDF
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 pb-5 text-[13.5px] text-stone-600">No payments recorded yet. Receipts appear here the day a payment is received.</p>
              )}
            </Panel>
          </>
        );
      }}
    </Loadable>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────

function DocRow({ d }: { d: Portal['documents'][number] & { uploader: string } }) {
  const canPreview = /^(application\/pdf|image\/)/.test(d.mime ?? '');
  return (
    <li className="flex items-center gap-4 border-t border-[#efece8] px-5 py-2.5 text-[13.5px]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-ink">{d.name}</p>
        <p className="truncate text-[12.5px] text-stone-500">
          {d.doc_type} · {d.uploader} · {fmtDate(d.created_at)}
        </p>
      </div>
      <span className="num hidden w-16 text-right text-[12.5px] text-stone-500 sm:block">{fileSize(d.size)}</span>
      <div className="flex shrink-0 gap-3">
        {canPreview && (
          <button onClick={() => api.open(`/documents/${d.id}/download?inline=1`, d.name).catch((e) => toast.error(e.message))} className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-ink hover:underline" aria-label={`View ${d.name}`}>
            <Eye className="size-3.5" /> View
          </button>
        )}
        <button onClick={() => api.download(`/documents/${d.id}/download`, d.name).catch((e) => toast.error(e.message))} className="inline-flex items-center gap-1 rounded text-[13px] font-semibold text-ink hover:underline" aria-label={`Download ${d.name}`}>
          <Download className="size-3.5" /> Download
        </button>
      </div>
    </li>
  );
}

export function PortalDocuments() {
  const [uploading, setUploading] = useState(false);
  return (
    <Loadable>
      {(p) => {
        const docs = p.documents.map((d) => ({ ...d, uploader: d.mine ? 'Uploaded by you' : (d.uploaded_by_name ?? p.company.name) }));
        const mineCount = docs.filter((d) => d.mine).length;
        return (
          <>
            <Title
              title="Documents"
              meta={docs.length ? `${docs.length} papers for your home · ${mineCount} uploaded by you` : 'Your agreement, receipts and KYC papers'}
              actions={
                <button onClick={() => setUploading(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13.5px] font-semibold text-white hover:bg-black">
                  <FileUp className="size-4" /> Upload a document
                </button>
              }
            />
            {docs.length ? (
              <div className="grid gap-5 lg:grid-cols-12">
                <Panel className="self-start lg:col-span-4" labelledBy="sections">
                  <PanelHead id="sections" title="Sections" />
                  <ul className="pb-3 text-[13.5px]">
                    {DOCUMENT_SECTIONS.map((s) => {
                      const n = docs.filter((d) => documentSection(d.doc_type).key === s.key).length;
                      return (
                        <li key={s.key}>
                          <a href={`#docs-${s.key}`} className={cn('flex justify-between gap-3 px-5 py-1.5 hover:bg-[#f7f6f3]', n ? 'text-ink' : 'text-stone-400')}>
                            <span>
                              {s.title} <span className="text-stone-400">· {s.hindi}</span>
                            </span>
                            <span className="num">{n || '—'}</span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
                <div className="space-y-5 lg:col-span-8">
                  {DOCUMENT_SECTIONS.map((s) => {
                    const mine = docs.filter((d) => documentSection(d.doc_type).key === s.key);
                    if (!mine.length) return null;
                    return (
                      <Panel key={s.key} labelledBy={`docs-${s.key}`} className="scroll-mt-20">
                        <PanelHead id={`docs-${s.key}`} title={s.title} meta={`${s.hindi} · ${mine.length} ${mine.length === 1 ? 'document' : 'documents'}`} />
                        <ul>
                          {mine.map((d) => (
                            <DocRow key={d.id} d={d} />
                          ))}
                        </ul>
                      </Panel>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyState icon={<FolderOpen />} title="No documents yet" message="Your agreement, receipts and KYC documents appear here. You can upload your Aadhaar, PAN and loan papers yourself." />
            )}
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
      }}
    </Loadable>
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
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('new') === '1');
  const close = () => {
    setCreating(false);
    if (params.has('new')) setParams({}, { replace: true });
  };
  return (
    <Loadable>
      {(p) => {
        const open = p.requests.filter((r) => r.status !== 'Resolved' && r.status !== 'Closed').length;
        return (
          <>
            <Title
              title="Requests"
              meta={p.requests.length ? `${open} open · ${p.requests.length - open} answered or closed` : 'Site visits, questions and concerns'}
              actions={
                <button onClick={() => setCreating(true)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13.5px] font-semibold text-white hover:bg-black">
                  <Plus className="size-4" /> New request
                </button>
              }
            />
            {p.requests.length ? (
              <Panel labelledBy="requests-list">
                <h2 id="requests-list" className="sr-only">
                  Your requests
                </h2>
                <ul>
                  {p.requests.map((r, i) => (
                    <li key={r.id} className={cn('px-5 py-4', i > 0 && 'border-t border-[#efece8]')}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="text-[14.5px] font-semibold text-ink">{r.subject}</p>
                        <p className={cn('text-[13px]', r.status === 'Open' ? 'font-semibold text-ink' : 'text-stone-500')}>{r.status}</p>
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-stone-500">
                        {r.type} · sent {fmtDate(r.created_at)}
                        {r.preferred_date ? ` · preferred ${fmtDate(r.preferred_date)}` : ''}
                      </p>
                      {r.message && <p className="mt-2 text-[13.5px] whitespace-pre-line text-stone-700">{r.message}</p>}
                      {r.response && (
                        <div className="mt-3 border-l-2 border-brand-700 pl-3 text-[13.5px]">
                          <p className="text-[12.5px] text-stone-500">Reply{r.handled_by_name ? ` from ${r.handled_by_name}` : ''}</p>
                          <p className="mt-0.5 whitespace-pre-line text-ink">{r.response}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : (
              <EmptyState icon={<Inbox />} title="No requests yet" message="Book a site visit, ask a question or raise a concern. Your relationship manager replies here." />
            )}
            {creating && <NewRequestModal onClose={close} />}
          </>
        );
      }}
    </Loadable>
  );
}

// ─── Notifications ─────────────────────────────────────────────────────────

export function PortalNotifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ data: NotificationItem[]; meta: { unread: number } }>('/notifications', { limit: 40 }) });
  const readAll = useAction(() => api.post('/notifications/read-all'), { invalidate: [['notifications']] });
  return (
    <>
      <Title
        title="Notifications"
        meta={q.data ? `${q.data.meta.unread} unread` : undefined}
        actions={
          (q.data?.meta.unread ?? 0) > 0 && (
            <button onClick={() => readAll.mutate(undefined)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#e7e4df] px-3.5 text-[13.5px] font-semibold text-ink hover:bg-[#dedad3]">
              <CheckCheck className="size-4" /> Mark all read
            </button>
          )
        }
      />
      {q.isPending ? (
        <PageSkeleton stats={0} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.data.length ? (
        <Panel labelledBy="notes">
          <h2 id="notes" className="sr-only">
            Notifications
          </h2>
          <ul>
            {q.data.data.map((n, i) => (
              <li key={n.id} className={cn('flex gap-3 px-5 py-3.5', i > 0 && 'border-t border-[#efece8]')}>
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.is_read ? 'bg-transparent' : 'bg-gold-500')} aria-label={n.is_read ? undefined : 'Unread'} />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[13.5px] text-ink', !n.is_read && 'font-semibold')}>{n.title}</p>
                  <p className="text-[13px] text-stone-600">{n.message}</p>
                  <p className="mt-1 text-[12px] text-stone-500">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-start gap-3 text-[13px] font-semibold">
                  {!n.is_read && (
                    <button className="rounded text-stone-600 hover:text-ink hover:underline" onClick={() => api.patch(`/notifications/${n.id}/read`, {}).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))}>
                      Mark read
                    </button>
                  )}
                  {n.link && (
                    <Link to={n.link} className="rounded text-ink hover:underline">
                      Open
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
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
      <Title
        title="Profile"
        meta={`Signed in as ${user.email}`}
        actions={
          <button onClick={logout} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#e7e4df] px-3.5 text-[13.5px] font-semibold text-ink hover:bg-[#dedad3]">
            <LogOut className="size-4" /> Sign out
          </button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel labelledBy="details">
          <PanelHead id="details" title="Your details" meta="Used on your receipts and by your relationship manager" />
          <form className="space-y-4 px-5 pb-5" onSubmit={(e) => (e.preventDefault(), profile.submit((v) => saveProfile.mutateAsync(v)))} noValidate>
            <Field label="Full name" error={profile.errors.name}>
              {(id) => <Input id={id} {...profile.bind('name')} />}
            </Field>
            <Field label="Phone">{(id) => <Input id={id} {...profile.bind('phone')} />}</Field>
            <Button type="submit" variant="primary" loading={profile.busy}>
              Save details
            </Button>
          </form>
        </Panel>
        <Panel labelledBy="password">
          <PanelHead id="password" title="Password" meta="At least 8 characters, one uppercase letter and one number" />
          <form className="space-y-4 px-5 pb-5" onSubmit={(e) => (e.preventDefault(), pw.submit((v) => changePw.mutateAsync(v)))} noValidate>
            <Field label="Current password" error={pw.errors.current_password}>
              {(id) => <Input id={id} type="password" autoComplete="current-password" {...pw.bind('current_password')} />}
            </Field>
            <Field label="New password" error={pw.errors.new_password}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" {...pw.bind('new_password')} />}
            </Field>
            <Field label="Confirm new password" error={pw.errors.confirm}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" {...pw.bind('confirm')} />}
            </Field>
            <Button type="submit" variant="primary" loading={pw.busy}>
              Update password
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
