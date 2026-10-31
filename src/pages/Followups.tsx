import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlarmClock, CalendarClock, CalendarPlus, Check, CheckCheck, CircleSlash, MessageCircle, MoreHorizontal, Pencil, Phone, PhoneCall, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, fmtTime, relativeDay, todayStr } from '@/lib/format';
import { FOLLOWUP_TYPES, cn, telHref, waHref } from '@/lib/utils';
import { useAction, useAgents, useDebounce, usePagedFilters } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Form';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Menu, MenuItem, MenuSeparator, PageHeader } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Table';
import { useConfirm } from '@/components/ui/Modal';
import { FollowupFormModal, OutcomeModal } from '@/components/domain/ScheduleForms';
import { CalendarPill, MonthCalendar, currentMonth, monthRange } from '@/components/ui/Calendar';
import type { Followup, Paged } from '@/types';

type Bucket = 'today' | 'overdue' | 'upcoming' | 'completed' | 'all' | 'calendar';
type Resp = Paged<
  Followup,
  {
    summary: {
      today: number;
      overdue: number;
      upcoming: number;
      completed_week: number;
    };
  }
>;

export default function Followups() {
  const user = useUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const [bucket, setBucket] = useState<Bucket>((params.get('bucket') as Bucket) || 'today');
  const [type, setType] = useState('');
  const [agent, setAgent] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [edit, setEdit] = useState<Followup | null>(null);
  const [complete, setComplete] = useState<Followup | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [mFrom, mTo] = monthRange(month);
  const query = {
    ...(bucket === 'calendar' ? { from: mFrom, to: mTo } : {}),
    bucket: ['today', 'overdue', 'upcoming'].includes(bucket) ? bucket : undefined,
    status: bucket === 'completed' ? 'Completed' : undefined,
    type,
    agent,
    q: dq,
  };
  const [page, setPage] = usePagedFilters(query);
  // The calendar shows one whole month; the lists are paged.
  const paging = bucket === 'calendar' ? { limit: 500 } : { page, limit: 50 };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['followups', query, paging],
    queryFn: () => api.get<Resp>('/followups', { ...query, ...paging }),
    placeholderData: keepPreviousData,
  });
  const update = useAction((v: { id: number; body: Record<string, unknown> }) => api.put(`/followups/${v.id}`, v.body), { success: (r: any) => `Follow-up marked ${r.status.toLowerCase()}` });
  const del = useAction((id: number) => api.delete(`/followups/${id}`), {
    success: 'Follow-up deleted',
  });

  const groups = useMemo(() => {
    const m = new Map<string, Followup[]>();
    (data?.data ?? []).forEach((f) => m.set(f.due_date, [...(m.get(f.due_date) ?? []), f]));
    return [...m.entries()];
  }, [data]);

  const s = data?.meta.summary;
  const cards: {
    key: Bucket;
    label: string;
    value?: number;
    icon: typeof Phone;
    tone: string;
  }[] = [
    {
      key: 'today',
      label: 'Due today',
      value: s?.today,
      icon: CalendarClock,
      tone: 'text-brand-700 bg-brand-50',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: s?.overdue,
      icon: AlarmClock,
      tone: 'text-red-600 bg-red-50',
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      value: s?.upcoming,
      icon: CalendarPlus,
      tone: 'text-sky-700 bg-sky-50',
    },
    {
      key: 'completed',
      label: 'Done · 7 days',
      value: s?.completed_week,
      icon: CheckCheck,
      tone: 'text-emerald-700 bg-emerald-50',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Calls, WhatsApp messages, emails and meetings to keep every lead moving"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Follow-ups' }]}
        actions={
          <Button variant="primary" icon={<CalendarPlus />} onClick={() => setParams({ new: '1' }, { replace: true })}>
            Schedule follow-up
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button key={c.key} onClick={() => setBucket(c.key)} className={cn('card flex items-center gap-3.5 p-4 text-left transition-shadow hover:shadow-pop', bucket === c.key && 'ring-2 ring-brand-600/40')}>
            <span className={cn('flex size-10 items-center justify-center rounded-xl', c.tone)}>
              <c.icon className="size-5" />
            </span>
            <span>
              <span className="block text-[24px] leading-none font-extrabold text-ink">{c.value ?? '–'}</span>
              <span className="mt-1 block text-[12.5px] font-semibold text-stone-500">{c.label}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search lead or notes…" className="sm:w-64" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect value={type} onChange={setType} placeholder="All types" options={[...FOLLOWUP_TYPES]} />
          {can.assignLeads(user.role) && (
            <FilterSelect
              value={agent}
              onChange={setAgent}
              placeholder="All agents"
              options={agents.data.map((a) => ({
                value: String(a.id),
                label: a.name,
              }))}
            />
          )}
        </div>
        <div className="flex gap-3 sm:ml-auto">
          <button onClick={() => setBucket('calendar')} className={cn('text-[13px] font-semibold', bucket === 'calendar' ? 'text-brand-800' : 'text-stone-500 hover:text-ink')}>
            Calendar
          </button>
          <button onClick={() => setBucket('all')} className={cn('text-[13px] font-semibold', bucket === 'all' ? 'text-brand-800' : 'text-stone-500 hover:text-ink')}>
            Show all follow-ups
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-[14px]" />
          ))}
        </div>
      ) : bucket === 'calendar' ? (
        <MonthCalendar
          month={month}
          onMonth={setMonth}
          items={data?.data ?? []}
          dateOf={(f) => f.due_date}
          keyOf={(f) => f.id}
          renderItem={(f) => (
            <CalendarPill
              tone={f.status === 'Completed' ? 'brand' : f.status !== 'Pending' ? 'gray' : f.due_date < todayStr() ? 'red' : 'amber'}
              title={`${fmtTime(f.due_time)} · ${f.type} · ${f.lead_name} · ${f.status}`}
              onClick={() => (f.status === 'Pending' ? setEdit(f) : navigate(`/leads/${f.lead_id}`))}
            >
              {fmtTime(f.due_time)} {f.lead_name}
            </CalendarPill>
          )}
        />
      ) : !groups.length ? (
        <Card>
          <EmptyState icon={<PhoneCall />} title={bucket === 'overdue' ? 'Nothing overdue' : 'No follow-ups here'} message={bucket === 'overdue' ? 'Every follow-up is on track.' : 'Schedule follow-ups from a lead or with the button above.'} />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h2 className="mb-2.5 flex items-baseline gap-2 px-1">
                <span className={cn('text-[14px] font-bold', date < todayStr() && bucket !== 'completed' ? 'text-red-600' : date === todayStr() ? 'text-brand-800' : 'text-ink')}>{relativeDay(date)}</span>
                <span className="text-[12.5px] text-stone-500">
                  {fmtDate(date, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              </h2>
              <Card className="divide-y divide-stone-100 overflow-hidden">
                {items.map((f) => {
                  const overdue = f.status === 'Pending' && f.due_date < todayStr();
                  return (
                    <div key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                      <div className="w-[72px] shrink-0">
                        <p className="text-[14px] font-extrabold text-ink">{fmtTime(f.due_time)}</p>
                        <Badge tone="gray" dot={false} className="mt-1">
                          {f.type}
                        </Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/leads/${f.lead_id}`} className="text-[14px] font-bold text-ink hover:text-brand-800">
                            {f.lead_name}
                          </Link>
                          {f.lead_status && <StatusBadge status={f.lead_status} />}
                        </div>
                        <p className="mt-0.5 text-[13px] text-stone-600">{f.outcome ?? f.notes}</p>
                        <p className="mt-0.5 text-[12px] text-stone-400">
                          {f.agent_name} {f.property_project ? `· ${f.property_project}` : ''}
                        </p>
                      </div>
                      <div className="flex w-full items-center justify-end gap-1.5 sm:w-auto">
                        {f.status !== 'Pending' ? (
                          <StatusBadge status={f.status} />
                        ) : (
                          <>
                            {overdue && <StatusBadge status="Overdue" />}
                            {f.lead_phone && (
                              <>
                                <a href={telHref(f.lead_phone)} aria-label="Call" className="flex size-9 items-center justify-center rounded-[10px] text-stone-500 hover:bg-stone-100 hover:text-ink">
                                  <Phone className="size-4" />
                                </a>
                                <a href={waHref(f.lead_phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex size-9 items-center justify-center rounded-[10px] text-emerald-700 hover:bg-emerald-50">
                                  <MessageCircle className="size-4" />
                                </a>
                              </>
                            )}
                            <Button size="sm" variant="subtle" icon={<Check />} onClick={() => setComplete(f)}>
                              Done
                            </Button>
                          </>
                        )}
                        <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label="More" icon={<MoreHorizontal />} />}>
                          <MenuItem icon={<Pencil />} onSelect={() => setEdit(f)}>
                            Edit / reschedule
                          </MenuItem>
                          {f.status === 'Pending' && (
                            <MenuItem
                              icon={<CircleSlash />}
                              onSelect={() =>
                                update.mutate({
                                  id: f.id,
                                  body: { status: 'Missed' },
                                })
                              }
                            >
                              Mark missed
                            </MenuItem>
                          )}
                          <MenuSeparator />
                          <MenuItem
                            icon={<Trash2 />}
                            danger
                            onSelect={async () => {
                              if (
                                await confirm({
                                  title: 'Delete follow-up?',
                                  message: `${f.type} with ${f.lead_name} on ${fmtDate(f.due_date)}`,
                                  confirmLabel: 'Delete',
                                })
                              )
                                del.mutate(f.id);
                            }}
                          >
                            Delete
                          </MenuItem>
                        </Menu>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
          {data && data.meta.total > data.meta.limit && (
            <Card className="overflow-hidden">
              <Pagination meta={data.meta} onPage={setPage} className="border-t-0" />
            </Card>
          )}
        </div>
      )}
      <FollowupFormModal
        open={params.get('new') === '1'}
        onClose={() => {
          const n = new URLSearchParams(params);
          n.delete('new');
          setParams(n, { replace: true });
        }}
      />
      <FollowupFormModal open={!!edit} onClose={() => setEdit(null)} followup={edit} />
      <OutcomeModal
        open={!!complete}
        onClose={() => setComplete(null)}
        title={`Complete ${complete?.type.toLowerCase() ?? ''} with ${complete?.lead_name ?? ''}`}
        label="Outcome"
        busy={update.isPending}
        onSave={(t) =>
          complete &&
          update.mutate(
            {
              id: complete.id,
              body: { status: 'Completed', outcome: t || null },
            },
            { onSuccess: () => setComplete(null) },
          )
        }
      />
    </div>
  );
}
