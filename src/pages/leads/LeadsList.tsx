import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, FilterX, Plus, Trash2, Upload, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, inrShort, relativeDay, timeAgo, todayStr } from '@/lib/format';
import { BUDGET_RANGES, LEAD_SOURCES, LEAD_STATUSES, cn } from '@/lib/utils';
import { useAction, useAgents, useDebounce, useProjects } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, Input, SearchInput, Select } from '@/components/ui/Form';
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge';
import { Avatar, PageHeader, Tabs } from '@/components/ui/Misc';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { useConfirm } from '@/components/ui/Modal';
import { LeadFormModal } from '@/components/domain/LeadForms';
import { LeadImportModal } from '@/components/domain/LeadImport';
import { SavedViews } from '@/components/domain/SavedViews';
import type { Lead, Paged } from '@/types';

const CREATED = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
];
const INLINE_STATUSES = LEAD_STATUSES.filter((s) => s !== 'Booked' && s !== 'Closed' && s !== 'Lost');

export default function LeadsList() {
  const user = useUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const agents = useAgents();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assignTo, setAssignTo] = useState('');
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDebounce(q);
  const manage = can.manageLeads(user.role);

  const get = (k: string) => params.get(k) ?? '';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (dq !== get('q')) setParam('q', dq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const budget = BUDGET_RANGES.find((b) => b.label === get('budget'));
  const query = {
    status: get('status'),
    source: get('source'),
    agent: get('agent'),
    project: get('project'),
    priority: get('priority'),
    q: get('q'),
    budget_min: budget?.min,
    budget_max: budget?.max,
    from: get('created') === 'custom' ? get('from') || undefined : get('created') ? todayStr(-Number(get('created'))) : undefined,
    to: get('created') === 'custom' ? get('to') || undefined : undefined,
    sort: get('sort') || 'created_at',
    order: get('order') || 'desc',
    page: Number(get('page') || 1),
    limit: 15,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['leads', query],
    queryFn: () => api.get<Paged<Lead, { statusCounts: Record<string, number> }>>('/leads', query),
    placeholderData: keepPreviousData,
  });
  useEffect(() => setSelected(new Set()), [params]);

  const bulkAssign = useAction((v: { ids: number[]; agent_id: number }) => api.post('/leads/bulk-assign', v), {
    success: (r: any) => `${r.updated} lead${r.updated > 1 ? 's' : ''} reassigned`,
    onSuccess: () => {
      setSelected(new Set());
      setAssignTo('');
    },
  });
  const setStatus = useAction((v: { lead: Lead; status: string }) => api.patch(`/leads/${v.lead.id}/status`, { status: v.status }), { success: (r: any) => `Moved to ${r.status}` });
  const bulkDelete = useAction((ids: number[]) => api.post('/leads/bulk-delete', { ids }), { success: 'Leads deleted', onSuccess: () => setSelected(new Set()) });

  const exportCsv = async () => {
    try {
      const { page: _p, limit: _l, ...filters } = query;
      await api.download('/leads/export.csv', `leads-${todayStr()}.csv`, filters);
      toast.success('Leads exported');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const columns = useMemo<Column<Lead>[]>(
    () => [
      {
        key: 'name',
        header: 'Lead',
        sortKey: 'name',
        cell: (l) => (
          <div className="flex items-center gap-3">
            <Avatar name={l.name} size="sm" />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold whitespace-nowrap text-ink group-hover:text-brand-800">
                {l.name} {l.priority === 'Hot' && <span className="size-1.5 rounded-full bg-red-500" title="Hot lead" />}
              </p>
              <p className="text-[12px] text-stone-400">{l.code}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'contact',
        header: 'Contact',
        cell: (l) => (
          <div className="whitespace-nowrap">
            <p className="num text-stone-700">{l.phone}</p>
            <p className="max-w-[180px] truncate text-[12px] text-stone-400">{l.email ?? '—'}</p>
          </div>
        ),
      },
      {
        key: 'source',
        header: 'Source',
        cell: (l) => <span className="whitespace-nowrap text-stone-600">{l.source}</span>,
      },
      {
        key: 'property',
        header: 'Interested property',
        cell: (l) =>
          l.property_project ? (
            <div className="whitespace-nowrap">
              <p className="font-medium text-stone-700">{l.property_project}</p>
              <p className="text-[12px] text-stone-400">{l.property_unit}</p>
            </div>
          ) : (
            <span className="text-stone-400">{l.property_type ?? 'Open'}</span>
          ),
      },
      {
        key: 'budget',
        header: 'Budget',
        sortKey: 'budget',
        align: 'right',
        cell: (l) => <span className="num font-semibold whitespace-nowrap text-ink">{inrShort(l.budget)}</span>,
      },
      {
        key: 'agent',
        header: 'Assigned',
        cell: (l) => (l.agent_name ? <span className="whitespace-nowrap text-stone-700">{l.agent_name}</span> : <span className="font-semibold text-amber-700">Unassigned</span>),
      },
      {
        key: 'status',
        header: 'Status',
        sortKey: 'status',
        cell: (l) =>
          (INLINE_STATUSES as readonly string[]).includes(l.status) ? (
            <div onClick={(e) => e.stopPropagation()}>
              <select
                aria-label={`Status of ${l.name}`}
                value={l.status}
                onChange={(e) => setStatus.mutate({ lead: l, status: e.target.value })}
                className="h-8 cursor-pointer rounded-lg border border-transparent bg-transparent pr-1 text-[12.5px] font-semibold text-stone-700 hover:border-stone-200 hover:bg-white focus:border-brand-300 focus:outline-none"
              >
                {INLINE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          ) : (
            <StatusBadge status={l.status} />
          ),
      },
      {
        key: 'last_contact',
        header: 'Last contact',
        sortKey: 'last_contact',
        cell: (l) => <span className="whitespace-nowrap text-stone-500">{l.last_contact ? timeAgo(l.last_contact) : 'Never'}</span>,
      },
      {
        key: 'next',
        header: 'Next follow-up',
        sortKey: 'next_followup',
        cell: (l) => (l.next_followup ? <span className={cn('whitespace-nowrap', l.next_followup.slice(0, 10) < todayStr() ? 'font-semibold text-red-600' : 'text-stone-600')}>{relativeDay(l.next_followup)}</span> : <span className="text-stone-300">—</span>),
      },
      {
        key: 'created',
        header: 'Created',
        sortKey: 'created_at',
        cell: (l) => <span className="whitespace-nowrap text-stone-500">{fmtDate(l.created_at)}</span>,
      },
    ],
    [],
  );

  const counts = data?.meta.statusCounts ?? {};
  const totalAll = Object.values(counts).reduce((s, n) => s + n, 0);
  const activeFilters = ['source', 'agent', 'budget', 'project', 'created', 'priority', 'q'].some((k) => get(k));
  const projects = useProjects().data ?? [];

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={user.role === 'sales' ? 'Enquiries assigned to you' : 'Every enquiry across sources, agents and projects'}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Leads' }]}
        actions={
          <>
            {manage && (
              <>
                <Button icon={<Upload />} onClick={() => setImporting(true)}>
                  Import
                </Button>
                <Button icon={<Download />} onClick={exportCsv}>
                  Export CSV
                </Button>
              </>
            )}
            <Button variant="primary" icon={<Plus />} onClick={() => setParam('new', '1')}>
              New lead
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <Tabs
          className="px-4 pt-1 sm:px-5"
          value={get('status') || 'all'}
          onChange={(v) => setParam('status', v === 'all' ? '' : v)}
          tabs={[
            { value: 'all', label: 'All', count: totalAll },
            ...LEAD_STATUSES.map((s) => ({
              value: s,
              label: s,
              count: counts[s] ?? 0,
            })),
          ]}
        />
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:px-5 lg:flex-row lg:flex-wrap lg:items-center">
          <SavedViews
            storageKey={`ef_lead_views_${user.id}`}
            current={params}
            onApply={(qs) => {
              const next = new URLSearchParams(qs);
              setQ(next.get('q') ?? '');
              setParams(next, { replace: true });
            }}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Search name, phone, email, lead ID…" className="lg:w-72" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterSelect value={get('source')} onChange={(v) => setParam('source', v)} placeholder="All sources" options={[...LEAD_SOURCES]} />
            {manage && (
              <FilterSelect
                value={get('agent')}
                onChange={(v) => setParam('agent', v)}
                placeholder="All agents"
                options={[
                  { value: 'unassigned', label: 'Unassigned' },
                  ...agents.data.map((a) => ({
                    value: String(a.id),
                    label: a.name,
                  })),
                ]}
              />
            )}
            <FilterSelect value={get('budget')} onChange={(v) => setParam('budget', v)} placeholder="Any budget" options={BUDGET_RANGES.map((b) => b.label)} />
            <FilterSelect value={get('project')} onChange={(v) => setParam('project', v)} placeholder="All projects" options={projects} />
            <FilterSelect value={get('created')} onChange={(v) => setParam('created', v)} placeholder="Any date" options={CREATED} />
            {get('created') === 'custom' && (
              <>
                <Input type="date" aria-label="Created from" value={get('from')} max={get('to') || todayStr()} onChange={(e) => setParam('from', e.target.value)} className="h-10 sm:h-9 sm:w-38" />
                <Input type="date" aria-label="Created to" value={get('to')} min={get('from')} max={todayStr()} onChange={(e) => setParam('to', e.target.value)} className="h-10 sm:h-9 sm:w-38" />
              </>
            )}
            <FilterSelect value={get('priority')} onChange={(v) => setParam('priority', v)} placeholder="Any priority" options={['Hot', 'Warm', 'Cold']} />
          </div>
          {activeFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<FilterX />}
              onClick={() => {
                setQ('');
                const next = new URLSearchParams();
                if (get('status')) next.set('status', get('status'));
                setParams(next, { replace: true });
              }}
            >
              Clear
            </Button>
          )}
          {isFetching && !isLoading && <span className="ml-auto hidden size-4 animate-spin rounded-full border-2 border-stone-200 border-t-brand-700 lg:block" />}
        </div>

        {selected.size > 0 && manage && (
          <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/70 px-4 py-2.5 sm:px-5">
            <span className="text-[13px] font-bold text-brand-900">{selected.size} selected</span>
            <span className="mx-1 hidden h-4 w-px bg-brand-200 sm:block" />
            <div className="w-48">
              <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="h-9 text-[13px]">
                <option value="">Assign to…</option>
                {agents.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              variant="primary"
              icon={<UserCheck />}
              disabled={!assignTo}
              loading={bulkAssign.isPending}
              onClick={() =>
                bulkAssign.mutate({
                  ids: [...selected],
                  agent_id: Number(assignTo),
                })
              }
            >
              Assign
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 />}
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={async () => {
                if (
                  await confirm({
                    title: `Delete ${selected.size} lead${selected.size > 1 ? 's' : ''}?`,
                    message: 'Their follow-ups, site visits and timeline will also be removed. This cannot be undone.',
                    confirmLabel: 'Delete leads',
                  })
                )
                  bulkDelete.mutate([...selected]);
              }}
            >
              Delete
            </Button>
            <button className="ml-auto text-[12.5px] font-semibold text-brand-800 hover:underline" onClick={() => setSelected(new Set())}>
              Clear selection
            </button>
          </div>
        )}

        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(l) => l.id}
            loading={isLoading}
            onRowClick={(l) => navigate(`/leads/${l.id}`)}
            sort={{ key: query.sort, order: query.order as 'asc' | 'desc' }}
            onSort={(s) => {
              const next = new URLSearchParams(params);
              next.set('sort', s.key);
              next.set('order', s.order);
              setParams(next, { replace: true });
            }}
            selected={manage ? selected : undefined}
            onSelect={manage ? setSelected : undefined}
            selectId={(l) => l.id}
            mobileCard={(l) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-bold text-ink">{l.name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      {l.code} · {l.source}
                    </p>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-stone-600">
                  <span className="font-bold text-ink">{inrShort(l.budget)}</span>
                  {l.property_project && (
                    <span className="truncate">
                      {l.property_project} · {l.property_unit}
                    </span>
                  )}
                  <PriorityBadge priority={l.priority} />
                </div>
                <p className="mt-1.5 text-[12px] text-stone-400">
                  {l.agent_name ?? 'Unassigned'} · {l.next_followup ? `Follow-up ${relativeDay(l.next_followup).toLowerCase()}` : 'No follow-up'}
                </p>
              </div>
            )}
            empty={
              <EmptyState
                icon={<Users />}
                title={activeFilters || get('status') ? 'No leads match these filters' : 'No leads yet'}
                message={activeFilters || get('status') ? 'Try a different search or clear the filters.' : 'Capture your first enquiry to start building the pipeline.'}
                action={
                  <Button variant="primary" icon={<Plus />} onClick={() => setParam('new', '1')}>
                    New lead
                  </Button>
                }
              />
            }
          />
        )}
        {data && <Pagination meta={data.meta} onPage={(p) => setParam('page', String(p))} />}
      </Card>

      <LeadFormModal open={get('new') === '1'} onClose={() => setParam('new', '')} onSaved={(l) => navigate(`/leads/${l.id}`)} />
      {manage && <LeadImportModal open={importing} onClose={() => setImporting(false)} />}
    </div>
  );
}
