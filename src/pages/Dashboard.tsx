import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, Hourglass, CalendarCheck2, Clock, Flame, Handshake, IndianRupee, Landmark, LayoutGrid, MapPin, Phone, PhoneCall, Plus, Sparkles, Trophy, UserCheck, UserCog, UserPlus, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { firstName, fmtDate, fmtDateTime, fmtTime, greeting, inr, inrShort, relativeDay, timeAgo } from '@/lib/format';
import { LEAD_SOURCES, SERIES, STATUS_COLORS, cn, telHref } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar, Segmented, Tabs } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton, Skeleton } from '@/components/ui/Feedback';
import { Donut, MonthlyBars, SegmentMeter, StageBars, StatCard } from '@/components/charts/Charts';
import { ActivityIcon } from '@/components/domain/Timeline';
import type { Activity, Followup, Lead, LeadInsights, Overview, SiteVisit } from '@/types';

interface Kpi {
  value: number;
  change: number | null;
  sub: string;
  trend: number[];
  amount?: number;
  overdue?: number;
  overdue_count?: number;
}
interface DashboardData {
  kpis: Record<'total_leads' | 'new_leads' | 'active_deals' | 'properties_sold' | 'revenue' | 'outstanding', Kpi>;
  pipeline: { stage: string; count: number; value: number }[];
  revenue: {
    month: string;
    collected: number;
    booked: number;
    deals: number;
    leads: number;
  }[];
  sources: { source: string; count: number; converted: number }[];
  /** Not sent to sales executives. */
  leaderboard:
    | {
        id: number;
        name: string;
        title: string;
        leads: number;
        site_visits: number;
        deals: number;
        revenue: number;
      }[]
    | null;
  collections: { collected: number; pending: number; overdue: number };
  targets: { monthly_collections: number; monthly_bookings: number } | null;
  todayVisits: (SiteVisit & { property_project?: string })[];
  followups: { today: Followup[]; overdue: Followup[]; upcoming: Followup[] };
  recentActivity: Activity[];
  hotLeads: {
    id: number;
    code: string;
    name: string;
    status: string;
    budget: number;
    next_followup?: string;
    property_project?: string;
    property_unit?: string;
    agent_name?: string;
  }[];
}

/** Managers' compact view of leads nobody has contacted for a while (from /leads/insights). */
function StuckLeadsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['leads', 'insights', 7],
    queryFn: () => api.get<LeadInsights>('/leads/insights', { days: 7 }),
  });
  const stuck: Lead[] = data?.stuck ?? [];
  return (
    <Card data-testid="stuck-leads-card">
      <CardHeader
        title="Stuck leads"
        subtitle={data ? `${stuck.length} of ${data.open} open leads idle ${data.days}+ days` : 'Open leads nobody has contacted'}
        icon={<Hourglass />}
        action={
          <ButtonLink to="/leads/insights" size="sm" variant="ghost">
            Insights <ArrowRight />
          </ButtonLink>
        }
      />
      {isLoading ? (
        <div className="space-y-2 px-5 pb-5">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : !stuck.length ? (
        <EmptyState compact icon={<Hourglass />} title="No stuck leads" message="Every open lead was contacted recently." />
      ) : (
        <div className="px-5 pb-4">
          <p className="num text-[28px] leading-none font-extrabold text-amber-700">{stuck.length}</p>
          <ul className="mt-3 divide-y divide-stone-100">
            {stuck.slice(0, 3).map((l) => (
              <li key={l.id}>
                <Link to={`/leads/${l.id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand-800">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{l.name}</span>
                    <span className="block truncate text-[12px] text-stone-500">{l.agent_name ?? 'Unassigned'}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-amber-700">{l.idle_days} days idle</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function FollowupList({ items, empty }: { items: Followup[]; empty: string }) {
  if (!items.length) return <EmptyState compact icon={<PhoneCall />} title={empty} />;
  return (
    <ul className="divide-y divide-stone-100">
      {items.slice(0, 6).map((f) => (
        <li key={f.id} className="flex items-center gap-3 px-5 py-3">
          <div className="flex w-14 shrink-0 flex-col">
            <span className="text-[12.5px] font-bold text-ink">{fmtTime(f.due_time)}</span>
            <span className="text-[11px] text-stone-400">{relativeDay(f.due_date)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <Link to={`/leads/${f.lead_id}`} className="block truncate text-[13.5px] font-semibold text-ink hover:text-brand-800">
              {f.lead_name}
            </Link>
            <p className="truncate text-[12.5px] text-stone-500">
              {f.type} · {f.notes}
            </p>
          </div>
          {f.lead_phone && (
            <a href={telHref(f.lead_phone)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-brand-50 hover:text-brand-800" aria-label={`Call ${f.lead_name}`}>
              <Phone className="size-4" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

/** "At a glance" strip: plots, today's collection, pending money, registry and staff attendance. */
function AtAGlance() {
  const user = useUser();
  const navigate = useNavigate();
  const { data: o, isLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: () => api.get<Overview>('/dashboard/overview'),
    refetchInterval: 60_000,
  });
  const finance = can.finance(user.role);
  const cols = o?.attendance ? 'xl:grid-cols-5' : 'xl:grid-cols-4';
  if (isLoading)
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-[14px]" />
        ))}
      </div>
    );
  if (!o) return null;
  const p = o.plots;
  const a = o.attendance;
  return (
    <section aria-labelledby="glance">
      <h2 id="glance" className="label-xs mb-2.5">
        At a glance
      </h2>
      <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3', cols)}>
        <StatCard
          label="Plots sold / available"
          value={
            <span>
              {p.sold + p.booked} <span className="text-stone-400">/</span> <span className="text-brand-800">{p.available}</span>
            </span>
          }
          icon={<LayoutGrid />}
          caption={
            <span>
              {p.sold} sold · {p.booked} booked · <b className="font-semibold text-amber-700">{p.hold} on hold</b> · {p.total} total
            </span>
          }
          onClick={() => navigate('/properties')}
        />
        <StatCard
          label="Today’s collection"
          value={inrShort(o.today_collection)}
          icon={<IndianRupee />}
          caption={`${o.today_count} payment${o.today_count === 1 ? '' : 's'} today`}
          onClick={finance ? () => navigate('/finance/transactions?period=0') : undefined}
        />
        <StatCard
          label="Total pending"
          value={inrShort(o.total_pending)}
          icon={<Wallet />}
          accent="gold"
          caption={
            <span>
              <b className="font-bold text-red-600">{inrShort(o.overdue)}</b> overdue
            </span>
          }
          onClick={finance ? () => navigate('/finance/installments?range=overdue') : undefined}
        />
        <StatCard
          label="Registry pending"
          value={o.registry_pending}
          icon={<Landmark />}
          accent={o.registry_due_15 > 0 ? 'red' : undefined}
          caption={o.registry_due_15 > 0 ? <b className="font-semibold text-amber-700">{o.registry_due_15} in next 15 days</b> : 'None in next 15 days'}
          onClick={() => navigate(o.registry_due_15 > 0 ? '/customers?registry=due15' : '/customers?registry=pending')}
        />
        {a && (
          <StatCard
            label="Staff attendance"
            value={
              <span>
                {a.present} <span className="text-[16px] font-bold text-stone-400">of {a.staff}</span>
              </span>
            }
            icon={<UserCheck />}
            caption={[a.half_day && `${a.half_day} half day`, a.leave && `${a.leave} leave`, a.absent && `${a.absent} absent`, a.not_marked && `${a.not_marked} not marked`].filter(Boolean).join(' · ') || 'Everyone present'}
            onClick={() => navigate('/staff?tab=attendance')}
          />
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const user = useUser();
  const navigate = useNavigate();
  const [revMode, setRevMode] = useState<'collected' | 'booked'>('collected');
  const [fuTab, setFuTab] = useState<'today' | 'overdue' | 'upcoming'>('today');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    refetchInterval: 120_000,
  });

  if (isLoading) return <PageSkeleton stats={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const k = data.kpis;
  const scoped = user.role === 'sales';
  const rev12 = data.revenue.reduce((s, m) => s + m[revMode], 0);
  const target = (revMode === 'collected' ? data.targets?.monthly_collections : data.targets?.monthly_bookings) ?? 0;
  const thisMonth = data.revenue[data.revenue.length - 1]?.[revMode] ?? 0;
  const sources = LEAD_SOURCES.map((s, i) => {
    const row = data.sources.find((x) => x.source === s);
    return { name: s, value: row?.count ?? 0, color: SERIES[i] };
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-stone-500">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="mt-1 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink sm:text-[34px]">
            {greeting()}, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-[14px] text-stone-500">{scoped ? 'Here’s your pipeline, follow-ups and site visits for today.' : 'Here’s what’s happening with your real estate business today.'}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to="/pipeline" icon={<Handshake />}>
            Pipeline
          </ButtonLink>
          <ButtonLink to="/leads?new=1" variant="primary" icon={<Plus />}>
            New lead
          </ButtonLink>
        </div>
      </div>

      <AtAGlance />

      {k.total_leads.value === 0 && user.role !== 'sales' && (
        <Card className="overflow-hidden border-brand-200">
          <div className="flex flex-col gap-5 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-6 lg:flex-row lg:items-center">
            <div className="flex-1">
              <p className="flex items-center gap-2 text-[15px] font-bold text-brand-900">
                <Sparkles className="size-4 text-gold-500" /> Welcome to EstateFlow — let’s set up your workspace
              </p>
              <p className="mt-1 text-[13.5px] text-stone-600">Add your inventory, invite your team and start capturing enquiries. Every chart on this dashboard fills in from your live data.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ButtonLink to="/properties?new=1" icon={<Building2 />}>
                Add property
              </ButtonLink>
              {user.role === 'admin' && (
                <ButtonLink to="/users?new=sales" icon={<UserCog />}>
                  Invite team
                </ButtonLink>
              )}
              <ButtonLink to="/leads?new=1" variant="primary" icon={<UserPlus />}>
                Add first lead
              </ButtonLink>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Total leads" value={k.total_leads.value} icon={<Users />} change={k.total_leads.change} caption="vs prior 30 days" trend={k.total_leads.trend} onClick={() => navigate('/leads')} />
        <StatCard label="New leads · 30 days" value={k.new_leads.value} icon={<UserPlus />} change={k.new_leads.change} caption={k.new_leads.sub} onClick={() => navigate('/leads?status=New')} />
        <StatCard label="Active deals" value={k.active_deals.value} icon={<Handshake />} change={k.active_deals.change} caption={`${inrShort(k.active_deals.amount)} in pipeline`} onClick={() => navigate('/pipeline')} />
        <StatCard label="Properties sold" value={k.properties_sold.value} icon={<Building2 />} change={k.properties_sold.change} caption={k.properties_sold.sub} trend={k.properties_sold.trend} accent="gold" onClick={() => navigate('/deals')} />
        <StatCard label="Revenue collected" value={inrShort(k.revenue.value)} icon={<IndianRupee />} change={k.revenue.change} caption={k.revenue.sub} trend={k.revenue.trend} />
        <StatCard
          label="Outstanding payments"
          value={inrShort(k.outstanding.value)}
          icon={<Wallet />}
          accent="red"
          caption={
            <span>
              <b className="font-bold text-red-600">{inrShort(k.outstanding.overdue)}</b> overdue · {k.outstanding.overdue_count} dues
            </span>
          }
          onClick={user.role === 'admin' ? () => navigate('/finance/installments?range=overdue') : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue overview"
            subtitle={
              <>
                <span className="font-semibold text-ink">{inr(rev12)}</span> {revMode === 'collected' ? 'collected' : 'booked'} in the last 12 months
              </>
            }
            action={
              <Segmented
                value={revMode}
                onChange={setRevMode}
                options={[
                  { value: 'collected', label: 'Collections' },
                  { value: 'booked', label: 'Bookings' },
                ]}
              />
            }
          />
          <div className="px-2 pb-4 sm:px-4">
            <MonthlyBars
              data={data.revenue}
              dataKey={revMode}
              name={revMode === 'collected' ? 'Collected' : 'Booked value'}
              color={revMode === 'collected' ? SERIES[0] : SERIES[1]}
              target={revMode === 'collected' ? data.targets?.monthly_collections : data.targets?.monthly_bookings}
            />
            {target > 0 && (
              <p className="px-2 pt-1 text-[12.5px] text-stone-500">
                This month: <b className="text-ink">{inrShort(thisMonth)}</b> of {inrShort(target)} target ({Math.round((thisMonth / target) * 100)}%)
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payment collection" subtitle="Across all installment schedules" />
          <div className="px-5 pb-5">
            <SegmentMeter
              segments={[
                {
                  label: 'Collected',
                  value: data.collections.collected,
                  color: STATUS_COLORS.good,
                },
                {
                  label: 'Pending',
                  value: data.collections.pending,
                  color: STATUS_COLORS.warning,
                  hint: 'not yet due',
                },
                {
                  label: 'Overdue',
                  value: data.collections.overdue,
                  color: STATUS_COLORS.critical,
                },
              ]}
            />
            <div className="mt-5 rounded-xl bg-stone-50 p-3.5">
              <p className="text-[12px] font-semibold text-stone-500">Collection efficiency</p>
              <p className="mt-0.5 text-[13.5px] text-stone-700">
                <b className="text-ink">{Math.round((data.collections.collected / Math.max(1, data.collections.collected + data.collections.overdue)) * 100)}%</b> of amounts already due have been collected.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Sales pipeline"
            subtitle={`${data.pipeline.reduce((s, p) => s + p.count, 0)} leads by stage`}
            action={
              <ButtonLink to="/pipeline" size="sm" variant="ghost">
                Open board <ArrowRight />
              </ButtonLink>
            }
          />
          <div className="px-3 pb-4 sm:px-4">
            <StageBars data={data.pipeline} height={290} onSelect={(s) => navigate(`/leads?status=${encodeURIComponent(s)}`)} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lead sources" subtitle="Where your enquiries come from" />
          <div className="px-5 pb-5">
            <Donut data={sources} centerValue={sources.reduce((s, x) => s + x.value, 0)} centerLabel="leads" height={190} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Today’s site visits"
            subtitle={fmtDate(new Date().toISOString())}
            icon={<CalendarCheck2 />}
            action={
              <ButtonLink to="/site-visits" size="sm" variant="ghost">
                All
              </ButtonLink>
            }
          />
          {data.todayVisits.length ? (
            <ul className="space-y-2 px-4 pb-4">
              {data.todayVisits.map((v) => (
                <li key={v.id} className="flex gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                  <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-white py-1.5 shadow-card">
                    <span className="text-[13px] font-extrabold text-brand-800">{fmtTime(v.visit_time).replace(/ (AM|PM)/, '')}</span>
                    <span className="text-[10.5px] font-bold text-stone-400">{fmtTime(v.visit_time).slice(-2)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link to={`/leads/${v.lead_id}`} className="truncate text-[13.5px] font-bold text-ink hover:text-brand-800">
                        {v.lead_name}
                      </Link>
                      <StatusBadge status={v.status} />
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-stone-500">
                      <MapPin className="size-3.5 shrink-0" />
                      {v.property_project} · {v.property_unit}
                    </p>
                    <p className="mt-0.5 text-[12px] text-stone-400">with {v.agent_name}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CalendarCheck2 />} title="No site visits today" message="Scheduled visits will appear here." />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Follow-ups"
            icon={<Clock />}
            action={
              <ButtonLink to="/followups" size="sm" variant="ghost">
                All
              </ButtonLink>
            }
            className="pb-1"
          />
          <Tabs
            className="mx-5"
            value={fuTab}
            onChange={setFuTab}
            tabs={[
              {
                value: 'today',
                label: 'Today',
                count: data.followups.today.length,
              },
              {
                value: 'overdue',
                label: 'Overdue',
                count: data.followups.overdue.length,
              },
              {
                value: 'upcoming',
                label: 'Next 7 days',
                count: data.followups.upcoming.length,
              },
            ]}
          />
          <FollowupList items={data.followups[fuTab]} empty={fuTab === 'overdue' ? 'Nothing overdue — great work' : 'No follow-ups here'} />
        </Card>

        <Card>
          <CardHeader title="Hot opportunities" subtitle="High-intent leads in active stages" icon={<Flame />} />
          {data.hotLeads.length ? (
            <ul className="divide-y divide-stone-100">
              {data.hotLeads.map((l) => (
                <li key={l.id}>
                  <Link to={`/leads/${l.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-50">
                    <Avatar name={l.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{l.name}</p>
                      <p className="truncate text-[12px] text-stone-500">
                        {l.property_project ?? 'Any project'} {l.property_unit ? `· ${l.property_unit}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-bold text-ink">{inrShort(l.budget)}</p>
                      <StatusBadge status={l.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<Flame />} title="No hot leads right now" />
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-5">
        {data.leaderboard && (
          <Card className="xl:col-span-3">
            <CardHeader title="Sales performance" subtitle="Team leaderboard by booked value" icon={<Trophy />} />
            {!data.leaderboard.length ? (
              <EmptyState compact icon={<Trophy />} title="No sales executives yet" message="Add your sales team under Users & roles to track performance." />
            ) : (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[520px] text-[13.5px]">
                  <thead>
                    <tr className="border-y border-stone-100 bg-stone-50/70 text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">
                      <th className="py-2.5 pl-5 text-left">Sales executive</th>
                      <th className="px-3 text-right">Leads</th>
                      <th className="px-3 text-right">Site visits</th>
                      <th className="px-3 text-right">Deals</th>
                      <th className="pr-5 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderboard.map((a, i) => {
                      const max = data.leaderboard![0]?.revenue || 1;
                      return (
                        <tr key={a.id} className={cn('border-b border-stone-100 last:border-0', a.id === user.id && 'bg-brand-50/50')}>
                          <td className="py-3 pl-5">
                            <div className="flex items-center gap-3">
                              <span className={cn('num w-4 text-[12px] font-bold', i === 0 ? 'text-gold-600' : 'text-stone-400')}>{i + 1}</span>
                              <Avatar name={a.name} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-ink">{a.name}</p>
                                <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-stone-100">
                                  <div
                                    className="h-full rounded-full bg-brand-600"
                                    style={{
                                      width: `${(a.revenue / max) * 100}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="num px-3 text-right text-stone-600">{a.leads}</td>
                          <td className="num px-3 text-right text-stone-600">{a.site_visits}</td>
                          <td className="num px-3 text-right font-semibold text-ink">{a.deals}</td>
                          <td className="num pr-5 text-right font-bold text-ink">{inrShort(a.revenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
        <div className={cn('space-y-4 sm:space-y-5', data.leaderboard ? 'xl:col-span-2' : 'xl:col-span-5')}>
        {(user.role === 'admin' || user.role === 'manager') && <StuckLeadsCard />}
        <Card>
          <CardHeader title="Recent activity" subtitle="Latest updates across the team" />
          {!data.recentActivity.length && <EmptyState compact icon={<Sparkles />} title="No activity yet" message="Calls, visits, bookings and payments will appear here." />}
          <ul className="space-y-0.5 px-3 pb-3">
            {data.recentActivity.map((a) => (
              <li key={a.id}>
                <Link to={a.customer_id ? `/customers/${a.customer_id}` : `/leads/${a.lead_id}`} className="flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-stone-50">
                  <ActivityIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-stone-700">
                      <b className="font-semibold text-ink">{a.title}</b> · {a.customer_name ?? a.lead_name}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-stone-400" title={fmtDateTime(a.created_at)}>
                      {a.user_name ? `${a.user_name} · ` : ''}
                      {timeAgo(a.created_at)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        </div>
      </div>
    </div>
  );
}
