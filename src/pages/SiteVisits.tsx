import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck2, CalendarPlus, Check, MapPin, MoreHorizontal, Pencil, Phone, X } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, fmtTime, relativeDay, todayStr } from '@/lib/format';
import { VISIT_STATUSES, cn, telHref } from '@/lib/utils';
import { useAction, useAgents, useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Form';
import { StatusBadge } from '@/components/ui/Badge';
import { Menu, MenuItem, PageHeader, Segmented } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useConfirm } from '@/components/ui/Modal';
import { OutcomeModal, SiteVisitFormModal } from '@/components/domain/ScheduleForms';
import { CalendarPill, MonthCalendar, currentMonth, monthRange } from '@/components/ui/Calendar';
import type { Paged, SiteVisit } from '@/types';

type Range = 'today' | 'upcoming' | 'past' | 'all' | 'calendar';

export default function SiteVisits() {
  const user = useUser();
  const confirm = useConfirm();
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState<Range>('upcoming');
  const [status, setStatus] = useState('');
  const [agent, setAgent] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [edit, setEdit] = useState<SiteVisit | null>(null);
  const [complete, setComplete] = useState<SiteVisit | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [mFrom, mTo] = monthRange(month);
  const query = range === 'calendar' ? { from: mFrom, to: mTo, status, agent, q: dq } : { range: range === 'all' ? undefined : range, status, agent, q: dq };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['site-visits', query],
    queryFn: () => api.get<Paged<SiteVisit>>('/site-visits', { ...query, limit: 500 }).then((r) => r.data),
  });
  const update = useAction((v: { id: number; body: Record<string, unknown> }) => api.put(`/site-visits/${v.id}`, v.body), { success: (r: any) => `Visit ${r.status.toLowerCase()}` });

  const groups = useMemo(() => {
    const m = new Map<string, SiteVisit[]>();
    (data ?? []).forEach((v) => m.set(v.visit_date, [...(m.get(v.visit_date) ?? []), v]));
    return [...m.entries()];
  }, [data]);

  const newOpen = params.get('new') === '1';
  const closeNew = () => {
    const n = new URLSearchParams(params);
    n.delete('new');
    setParams(n, { replace: true });
  };

  return (
    <div>
      <PageHeader
        title="Site visits"
        subtitle="Plan, run and record every visit to Starwiz Green Valley"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Site visits' }]}
        actions={
          <Button variant="primary" icon={<CalendarPlus />} onClick={() => setParams({ new: '1' }, { replace: true })}>
            Schedule visit
          </Button>
        }
      />
      <div className="mb-4 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'all', label: 'All' },
            { value: 'calendar', label: 'Calendar' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Search lead or project…" className="lg:w-64" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect value={status} onChange={setStatus} placeholder="Any status" options={[...VISIT_STATUSES]} />
          {can.assignLeads(user.role) && (
            <FilterSelect
              value={agent}
              onChange={setAgent}
              placeholder="All executives"
              options={agents.data.map((a) => ({
                value: String(a.id),
                label: a.name,
              }))}
            />
          )}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[14px]" />
          ))}
        </div>
      ) : range === 'calendar' ? (
        <MonthCalendar
          month={month}
          onMonth={setMonth}
          items={data ?? []}
          dateOf={(v) => v.visit_date}
          keyOf={(v) => v.id}
          renderItem={(v) => (
            <CalendarPill tone={v.status === 'Completed' ? 'brand' : v.status === 'Cancelled' ? 'gray' : 'blue'} title={`${fmtTime(v.visit_time)} · ${v.lead_name} · ${v.status}`} onClick={() => setEdit(v)}>
              {fmtTime(v.visit_time)} {v.lead_name}
            </CalendarPill>
          )}
        />
      ) : !groups.length ? (
        <Card>
          <EmptyState icon={<CalendarCheck2 />} title={range === 'today' ? 'No visits today' : 'No site visits found'} message="Schedule a visit from a lead or with the button above." />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, visits]) => (
            <section key={date}>
              <h2 className="mb-2.5 flex items-baseline gap-2 px-1">
                <span className={cn('text-[14px] font-bold', date === todayStr() ? 'text-brand-800' : 'text-ink')}>{relativeDay(date)}</span>
                <span className="text-[12.5px] text-stone-500">
                  {fmtDate(date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </h2>
              <Card className="divide-y divide-stone-100 overflow-hidden">
                {visits.map((v) => (
                  <div key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:px-5">
                    <div className="flex shrink-0 items-center gap-3 sm:w-24 sm:flex-col sm:items-start sm:gap-0">
                      <span className="text-[15px] font-extrabold text-ink">{fmtTime(v.visit_time)}</span>
                      <StatusBadge status={v.status} className="sm:mt-1.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link to={`/leads/${v.lead_id}`} className="text-[14.5px] font-bold text-ink hover:text-brand-800">
                        {v.lead_name}
                      </Link>
                      <p className="mt-0.5 flex items-center gap-1 text-[13px] text-stone-600">
                        <MapPin className="size-3.5 shrink-0 text-stone-400" />
                        {v.property_project ?? 'Township tour'} {v.property_unit ? `· ${v.property_unit}` : ''} {v.property_name ? <span className="text-stone-400">— {v.property_name}</span> : null}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-stone-500">Sales executive: {v.agent_name}</p>
                      {v.feedback && <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-[13px] text-stone-700">“{v.feedback}”</p>}
                      {v.next_action && <p className="mt-1.5 text-[12.5px] font-medium text-stone-600">Next action: {v.next_action}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {v.lead_phone && (
                        <a href={telHref(v.lead_phone)} aria-label={`Call ${v.lead_name}`} className="flex size-9 items-center justify-center rounded-[10px] text-stone-500 hover:bg-stone-100 hover:text-ink">
                          <Phone className="size-4" />
                        </a>
                      )}
                      {(v.status === 'Scheduled' || v.status === 'Rescheduled') && (
                        <Button size="sm" variant="subtle" icon={<Check />} onClick={() => setComplete(v)}>
                          Complete
                        </Button>
                      )}
                      <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label="More" icon={<MoreHorizontal />} />}>
                        <MenuItem icon={<Pencil />} onSelect={() => setEdit(v)}>
                          Edit / reschedule
                        </MenuItem>
                        {v.status !== 'Cancelled' && v.status !== 'Completed' && (
                          <MenuItem
                            icon={<X />}
                            danger
                            onSelect={async () => {
                              if (
                                await confirm({
                                  title: 'Cancel this site visit?',
                                  message: `${v.lead_name} · ${fmtDate(v.visit_date)} at ${fmtTime(v.visit_time)}`,
                                  confirmLabel: 'Cancel visit',
                                })
                              )
                                update.mutate({
                                  id: v.id,
                                  body: { status: 'Cancelled' },
                                });
                            }}
                          >
                            Cancel visit
                          </MenuItem>
                        )}
                      </Menu>
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
      <SiteVisitFormModal open={newOpen} onClose={closeNew} />
      <SiteVisitFormModal open={!!edit} onClose={() => setEdit(null)} visit={edit} />
      <OutcomeModal
        open={!!complete}
        onClose={() => setComplete(null)}
        title="Complete site visit"
        label="Customer feedback"
        busy={update.isPending}
        onSave={(t) =>
          complete &&
          update.mutate(
            {
              id: complete.id,
              body: { status: 'Completed', feedback: t || null },
            },
            { onSuccess: () => setComplete(null) },
          )
        }
      />
    </div>
  );
}
