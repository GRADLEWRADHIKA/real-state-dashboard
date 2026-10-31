import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Flame, Hourglass, Phone, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { cn, telHref } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Avatar, PageHeader, Segmented } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { DataTable, type Column } from '@/components/ui/Table';
import { StatCard } from '@/components/charts/Charts';
import { ScoreBadge, ScoreBar } from '@/components/domain/LeadHeat';
import type { Lead, LeadInsights as Insights } from '@/types';

const DAYS = ['3', '7', '14', '30'] as const;

function CallButton({ lead }: { lead: Lead }) {
  return (
    <a
      href={telHref(lead.phone)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Call ${lead.name}`}
      className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-brand-50 px-3 text-[13px] font-semibold text-brand-800 hover:bg-brand-100"
    >
      <Phone className="size-3.5" />
      Call
    </a>
  );
}

export default function LeadInsights() {
  const user = useUser();
  const manager = can.manageLeads(user.role);
  const [days, setDays] = useState<(typeof DAYS)[number]>('7');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads', 'insights', Number(days)],
    queryFn: () => api.get<Insights>('/leads/insights', { days: Number(days) }),
  });

  const stuckCols: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Lead',
      cell: (l) => (
        <Link to={`/leads/${l.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Avatar name={l.name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold whitespace-nowrap text-ink hover:text-brand-800">{l.name}</p>
            <p className="text-[12px] text-stone-400">{l.code}</p>
          </div>
        </Link>
      ),
    },
    { key: 'stage', header: 'Stage', cell: (l) => <StatusBadge status={l.status} /> },
    { key: 'agent', header: 'Agent', cell: (l) => (l.agent_name ? <span className="whitespace-nowrap">{l.agent_name}</span> : <span className="font-semibold text-amber-700">Unassigned</span>) },
    {
      key: 'idle',
      header: 'Idle',
      align: 'right',
      cell: (l) => <span className="num font-bold whitespace-nowrap text-amber-700">{l.idle_days} days</span>,
    },
    { key: 'reason', header: 'Reason', cell: (l) => <span className="text-stone-600">{l.score_reason}</span> },
    { key: 'score', header: 'Score', cell: (l) => <ScoreBadge score={l.score} /> },
    { key: 'call', header: '', align: 'right', cell: (l) => <CallButton lead={l} /> },
  ];

  if (isLoading) return <PageSkeleton stats={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const maxAgent = Math.max(1, ...data.byAgent.map((a) => a.stuck));

  return (
    <div>
      <PageHeader
        title="Lead insights"
        subtitle={user.role === 'sales' ? 'Your leads that need a call, and the ones most ready to buy' : 'Leads going cold, and the ones most ready to buy'}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Leads', to: '/leads' }, { label: 'Insights' }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-stone-500">Idle for</span>
            <Segmented value={days} onChange={setDays} options={DAYS.map((d) => ({ value: d, label: `${d} days` }))} />
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Open leads" value={data.open} icon={<Users />} caption="Not booked, closed or lost" />
        <StatCard label="Stuck leads" value={<span className="text-amber-700">{data.stuck.length}</span>} icon={<Hourglass />} accent="gold" caption={`No contact for ${data.days}+ days`} />
        <StatCard label="Hot leads" value={data.hot.filter((l) => (l.score ?? 0) >= 70).length} icon={<Flame />} accent="red" caption="Score 70 or more" />
      </div>

      <div className={cn('grid grid-cols-1 gap-4 sm:gap-5', manager && 'xl:grid-cols-3')}>
        <Card className={cn('overflow-hidden', manager && 'xl:col-span-2')} data-testid="stuck-leads">
          <CardHeader title="Stuck leads" subtitle={`Longest idle first · no call, message or visit for ${data.days}+ days`} icon={<Hourglass />} />
          <DataTable
            rows={data.stuck}
            columns={stuckCols}
            rowKey={(l) => l.id}
            mobileCard={(l) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/leads/${l.id}`} className="block truncate text-[14.5px] font-bold text-ink">
                    {l.name}
                  </Link>
                  <p className="text-[12.5px] text-stone-500">
                    {l.status} · {l.agent_name ?? 'Unassigned'}
                  </p>
                  <p className="mt-1 text-[12.5px] font-semibold text-amber-700">{l.idle_days} days idle</p>
                </div>
                <CallButton lead={l} />
              </div>
            )}
            empty={<EmptyState compact icon={<Hourglass />} title="No stuck leads" message={`Every open lead was contacted in the last ${data.days} days.`} />}
          />
        </Card>

        {manager && (
          <Card>
            <CardHeader title="Stuck by executive" subtitle="Who has the most leads going cold" icon={<Users />} />
            {data.byAgent.length ? (
              <ul className="space-y-3 px-5 pb-5">
                {data.byAgent.map((a) => (
                  <li key={a.agent_id ?? 'none'}>
                    <div className="flex items-center justify-between gap-3 text-[13.5px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <Avatar name={a.agent_name ?? '?'} size="xs" />
                        <span className={cn('truncate font-semibold', a.agent_id ? 'text-ink' : 'text-amber-700')}>{a.agent_name ?? 'Unassigned'}</span>
                      </span>
                      <span className="num font-bold text-ink">{a.stuck}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${(a.stuck / maxAgent) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Users />} title="Nobody has stuck leads" />
            )}
          </Card>
        )}
      </div>

      <Card className="mt-4 sm:mt-5">
        <CardHeader title="Hot leads" subtitle="Top 10 open leads by score, contacted recently" icon={<Flame />} />
        {data.hot.length ? (
          <ol className="divide-y divide-stone-100">
            {data.hot.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                <span className={cn('num w-5 shrink-0 text-[12.5px] font-bold', i === 0 ? 'text-gold-600' : 'text-stone-400')}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <Link to={`/leads/${l.id}`} className="truncate text-[13.5px] font-semibold text-ink hover:text-brand-800">
                      {l.name}
                    </Link>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="truncate text-[12px] text-stone-500">
                    {l.agent_name ?? 'Unassigned'} · {l.score_reason}
                  </p>
                </div>
                <div className="hidden w-40 shrink-0 sm:block">
                  <ScoreBar score={l.score ?? 0} />
                </div>
                <ScoreBadge score={l.score} className="w-16 shrink-0 justify-end" />
                <CallButton lead={l} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState compact icon={<Flame />} title="No hot leads right now" />
        )}
      </Card>
    </div>
  );
}
