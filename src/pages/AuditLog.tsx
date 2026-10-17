import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/utils';
import { useDebounce, useDirectory } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, Input, SearchInput } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Misc';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import type { AuditEntry, Paged } from '@/types';

const ENTITY_LABEL: Record<string, string> = {
  lead: 'Lead',
  customer: 'Customer',
  property: 'Property',
  deal: 'Deal',
  transaction: 'Payment',
  installment: 'Installment',
  document: 'Document',
  user: 'User',
  setting: 'Setting',
  followup: 'Follow-up',
  site_visit: 'Site visit',
  task: 'Task',
  customer_request: 'Customer request',
};
const label = (t: string | null) => (t ? (ENTITY_LABEL[t] ?? t.replace(/_/g, ' ')) : '—');

/** Who changed what, and when. Every write through the API lands here with its request id. */
export default function AuditLog() {
  const [params, setParams] = useSearchParams();
  const directory = useDirectory();
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const get = (k: string) => params.get(k) ?? '';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const query = {
    q: dq,
    user: get('user'),
    entity_type: get('entity'),
    from: get('from'),
    to: get('to'),
    page: Number(get('page') || 1),
    limit: 25,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit', query],
    queryFn: () => api.get<Paged<AuditEntry, { entityTypes: string[] }>>('/audit', query),
    placeholderData: keepPreviousData,
  });
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      await api.download('/audit/export.csv', 'audit-log.csv', {
        ...query,
        page: undefined,
        limit: undefined,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const columns: Column<AuditEntry>[] = [
    {
      key: 'when',
      header: 'When',
      cell: (a) => (
        <span className="whitespace-nowrap text-stone-500" title={fmtDateTime(a.created_at)}>
          {timeAgo(a.created_at)}
        </span>
      ),
    },
    {
      key: 'who',
      header: 'User',
      cell: (a) => (
        <div>
          <p className="font-semibold whitespace-nowrap text-ink">{a.user_name ?? 'System'}</p>
          {a.user_role && <p className="text-[12px] text-stone-400">{ROLE_LABEL[a.user_role]}</p>}
        </div>
      ),
    },
    {
      key: 'what',
      header: 'Action',
      cell: (a) => (
        <div className="max-w-[520px]">
          <p className="text-ink">{a.title}</p>
          {a.description && <p className="truncate text-[12px] text-stone-400">{a.description}</p>}
        </div>
      ),
    },
    {
      key: 'entity',
      header: 'Record',
      cell: (a) =>
        a.entity_type ? (
          <Badge tone="gray">
            {label(a.entity_type)}
            {a.entity_id ? ` #${a.entity_id}` : ''}
          </Badge>
        ) : (
          '—'
        ),
    },
    {
      key: 'ip',
      header: 'IP / request',
      cell: (a) => (
        <span className="num text-[12px] whitespace-nowrap text-stone-400" title={a.request_id ?? undefined}>
          {a.ip ?? '—'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every change made through EstateFlow, with who made it and from where"
        crumbs={[{ label: 'Administration' }, { label: 'Audit log' }]}
        actions={
          <Button icon={<Download />} loading={exporting} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setParam('page', '');
            }}
            placeholder="Search actions…"
            className="sm:w-64"
          />
          <FilterSelect
            value={get('user')}
            onChange={(v) => setParam('user', v)}
            placeholder="Anyone"
            options={(directory.data ?? []).map((u) => ({
              value: String(u.id),
              label: u.name,
            }))}
            className="sm:w-44"
          />
          <FilterSelect
            value={get('entity')}
            onChange={(v) => setParam('entity', v)}
            placeholder="Any record"
            options={(data?.meta.entityTypes ?? []).map((t) => ({
              value: t,
              label: label(t),
            }))}
            className="sm:w-44"
          />
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="From date" value={get('from')} onChange={(e) => setParam('from', e.target.value)} className="sm:w-40" />
            <span className="text-stone-400">to</span>
            <Input type="date" aria-label="To date" value={get('to')} onChange={(e) => setParam('to', e.target.value)} className="sm:w-40" />
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(a) => a.id}
            loading={isLoading}
            mobileCard={(a) => (
              <div>
                <p className="text-[14px] font-semibold text-ink">{a.title}</p>
                <p className="mt-0.5 text-[12.5px] text-stone-500">
                  {a.user_name ?? 'System'} · {timeAgo(a.created_at)}
                </p>
              </div>
            )}
            empty={<EmptyState icon={<ScrollText />} title="No audit entries" message="Nothing matches these filters." />}
          />
        )}
        {data && <Pagination meta={data.meta} onPage={(p) => setParam('page', String(p))} />}
      </Card>
    </div>
  );
}
