import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, Inbox, Phone } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime, timeAgo } from '@/lib/format';
import { CUSTOMER_REQUEST_STATUSES, CUSTOMER_REQUEST_TYPES, telHref } from '@/lib/utils';
import { useAction, useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, SearchInput, Select, Textarea } from '@/components/ui/Form';
import { Badge, type Tone } from '@/components/ui/Badge';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { DataTable, Pagination, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import type { CustomerRequest, CustomerRequestStatus, Paged } from '@/types';

const STATUS_TONE: Record<CustomerRequestStatus, Tone> = {
  Open: 'amber',
  'In Progress': 'blue',
  Resolved: 'green',
  Closed: 'gray',
};
const TYPE_TONE: Record<string, Tone> = {
  'Site visit': 'brand',
  Query: 'indigo',
  Document: 'violet',
  Payment: 'gold',
  Complaint: 'red',
};

function RequestModal({ request, onClose }: { request: CustomerRequest | null; onClose: () => void }) {
  const [status, setStatus] = useState<CustomerRequestStatus>('Open');
  const [response, setResponse] = useState('');
  useEffect(() => {
    if (request) {
      setStatus(request.status === 'Open' ? 'In Progress' : request.status);
      setResponse(request.response ?? '');
    }
  }, [request]);
  const save = useAction(
    () =>
      api.patch(`/customer-requests/${request!.id}`, {
        status,
        response: response.trim() || null,
      }),
    {
      success: 'Request updated. The customer sees your reply in the app.',
      invalidate: [['customer-requests']],
      onSuccess: onClose,
    },
  );
  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title={request?.subject ?? ''}
      description={request ? `${request.type} · raised ${fmtDateTime(request.created_at)}` : ''}
      onSubmit={() => save.mutate(undefined)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      {request && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-4 py-3">
            <div>
              <Link to={`/customers/${request.customer_id}`} className="text-[14px] font-bold text-brand-800 hover:underline">
                {request.customer_name}
              </Link>
              <p className="text-[12.5px] text-stone-500">
                {request.customer_code}
                {request.agent_name ? ` · Agent: ${request.agent_name}` : ''}
              </p>
            </div>
            {request.customer_phone && (
              <a href={telHref(request.customer_phone)} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-800 hover:underline">
                <Phone className="size-3.5" /> {request.customer_phone}
              </a>
            )}
          </div>
          {request.message && <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink">{request.message}</p>}
          {request.preferred_date && (
            <p className="flex items-center gap-1.5 text-[13px] text-stone-600">
              <CalendarDays className="size-4 text-stone-400" /> Preferred date: <b>{fmtDate(request.preferred_date)}</b>
            </p>
          )}
          <Field label="Status">
            {(id) => (
              <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as CustomerRequestStatus)}>
                {CUSTOMER_REQUEST_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Reply to customer" hint="Shown to the customer in the app with a notification">
            {(id) => <Textarea id={id} rows={4} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="e.g. Your visit is confirmed for Saturday at 11 AM. Rahul will meet you at the site office." />}
          </Field>
          {request.handled_by_name && (
            <p className="text-[12px] text-stone-400">
              Last handled by {request.handled_by_name}
              {request.updated_at ? `, ${timeAgo(request.updated_at)}` : ''}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

type TabValue = 'open' | CustomerRequestStatus | 'all';

/** Requests customers raise in the mobile app: visits, queries, documents, payments and complaints. */
export default function Requests() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabValue) || 'open';
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const page = Number(params.get('page') || 1);
  const [open, setOpen] = useState<CustomerRequest | null>(null);
  const query = {
    status: tab === 'open' || tab === 'all' ? undefined : tab,
    state: tab === 'open' ? 'open' : undefined,
    type,
    q: dq,
    page,
    limit: 20,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-requests', query],
    queryFn: () => api.get<Paged<CustomerRequest, { statusCounts: { status: CustomerRequestStatus; n: number }[] }>>('/customer-requests', query),
    placeholderData: keepPreviousData,
  });
  const counts = Object.fromEntries((data?.meta.statusCounts ?? []).map((c) => [c.status, c.n])) as Record<string, number>;

  const columns: Column<CustomerRequest>[] = [
    {
      key: 'subject',
      header: 'Request',
      cell: (r) => (
        <div className="max-w-[420px]">
          <p className="font-semibold text-ink">{r.subject}</p>
          {r.message && <p className="truncate text-[12px] text-stone-400">{r.message}</p>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (r) => <Badge tone={TYPE_TONE[r.type] ?? 'gray'}>{r.type}</Badge>,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (r) => (
        <div>
          <p className="whitespace-nowrap text-ink">{r.customer_name}</p>
          <p className="text-[12px] text-stone-400">{r.agent_name ?? 'Unassigned'}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Preferred',
      cell: (r) => <span className="whitespace-nowrap text-stone-500">{r.preferred_date ? fmtDate(r.preferred_date) : '—'}</span>,
    },
    {
      key: 'raised',
      header: 'Raised',
      cell: (r) => (
        <span className="whitespace-nowrap text-stone-500" title={fmtDateTime(r.created_at)}>
          {timeAgo(r.created_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader title="Customer requests" subtitle="Visits, queries and documents customers ask for in the app" crumbs={[{ label: 'Home', to: '/' }, { label: 'Customer requests' }]} />
      <Card className="overflow-hidden">
        <Tabs
          className="px-4 pt-1 sm:px-5"
          value={tab}
          onChange={(v) => setParams(v === 'open' ? {} : { tab: v }, { replace: true })}
          tabs={[
            {
              value: 'open',
              label: 'Needs attention',
              count: (counts.Open ?? 0) + (counts['In Progress'] ?? 0),
            },
            ...CUSTOMER_REQUEST_STATUSES.map((s) => ({
              value: s as TabValue,
              label: s,
              count: counts[s] ?? 0,
            })),
            { value: 'all', label: 'All' },
          ]}
        />
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search subject or customer…" className="sm:w-72" />
          <FilterSelect value={type} onChange={setType} placeholder="Any type" options={[...CUSTOMER_REQUEST_TYPES]} className="sm:w-44" />
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            loading={isLoading}
            onRowClick={setOpen}
            mobileCard={(r) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[14px] font-bold text-ink">{r.subject}</p>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </div>
                <p className="mt-0.5 text-[12.5px] text-stone-500">
                  {r.type} · {r.customer_name} · {timeAgo(r.created_at)}
                </p>
              </div>
            )}
            empty={<EmptyState icon={<Inbox />} title={tab === 'open' ? 'Inbox zero' : 'No requests here'} message="Requests customers raise in the EstateFlow app appear here." />}
          />
        )}
        {data && <Pagination meta={data.meta} onPage={(p) => setParams(tab === 'open' ? { page: String(p) } : { tab, page: String(p) }, { replace: true })} />}
      </Card>
      <RequestModal request={open} onClose={() => setOpen(null)} />
    </div>
  );
}
