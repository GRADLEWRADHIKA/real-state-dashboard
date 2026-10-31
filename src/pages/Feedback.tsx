import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareHeart, Star, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/Card';
import { FilterSelect } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { Avatar, PageHeader } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Stars } from '@/components/domain/FeedbackForms';
import type { FeedbackItem, FeedbackResponse } from '@/types';

const KIND_LABEL: Record<FeedbackItem['kind'], string> = {
  site_visit: 'Site visits',
  possession: 'Possession',
  general: 'General',
};
const KINDS = Object.keys(KIND_LABEL) as FeedbackItem['kind'][];

export default function Feedback() {
  const [kind, setKind] = useState('');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['feedback', kind],
    queryFn: () => api.get<FeedbackResponse>('/feedback', { kind: kind || undefined, limit: 100 }),
  });
  if (isLoading) return <PageSkeleton stats={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const summary = new Map(data.meta.summary.map((s) => [s.kind, s]));
  const dist = [5, 4, 3, 2, 1].map((r) => ({ rating: r, n: data.meta.distribution.find((d) => d.rating === r)?.n ?? 0 }));
  const distMax = Math.max(1, ...dist.map((d) => d.n));
  const distTotal = dist.reduce((s, d) => s + d.n, 0);

  return (
    <div>
      <PageHeader
        title="Feedback"
        subtitle="How visitors and customers rate their experience"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Feedback' }]}
        actions={<FilterSelect value={kind} onChange={setKind} placeholder="All kinds" options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} className="w-44" />}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {KINDS.map((k) => {
          const s = summary.get(k);
          return (
            <div key={k} className="card p-4 sm:p-5" data-testid={`feedback-kind-${k}`}>
              <p className="text-[12.5px] font-semibold text-stone-500">{KIND_LABEL[k]}</p>
              <div className="mt-2 flex items-end gap-2">
                <p className="text-[28px] leading-none font-extrabold tracking-[-0.02em] text-ink">{s?.average != null ? s.average.toFixed(1) : '—'}</p>
                <span className="pb-0.5 text-[13px] text-stone-400">/ 5</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-stone-500">
                {s?.average != null && <Stars rating={Math.round(s.average)} />}
                <span>
                  {s?.n ?? 0} rating{s?.n === 1 ? '' : 's'}
                </span>
                {!!s?.low && <span className="font-semibold text-red-600">· {s.low} low (1–2)</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Rating distribution" subtitle={kind ? KIND_LABEL[kind as FeedbackItem['kind']] : 'All feedback'} icon={<Star />} />
          <ul className="space-y-2.5 px-5 pb-5">
            {dist.map((d) => (
              <li key={d.rating} className="flex items-center gap-3 text-[13px]">
                <span className="flex w-10 shrink-0 items-center gap-1 font-semibold text-stone-700">
                  {d.rating} <Star className="size-3.5 fill-gold-400 text-gold-500" />
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${(d.n / distMax) * 100}%` }} />
                </div>
                <span className="num w-16 shrink-0 text-right text-stone-600">
                  {d.n} <span className="text-stone-400">{distTotal ? `(${Math.round((d.n / distTotal) * 100)}%)` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Site visits by executive" subtitle="Average visitor rating" icon={<Users />} />
          {data.meta.byAgent.length ? (
            <ul className="divide-y divide-stone-100 border-t border-stone-100">
              {data.meta.byAgent.map((a) => (
                <li key={a.agent_id ?? 'none'} className="flex items-center gap-3 px-5 py-2.5">
                  <Avatar name={a.agent_name ?? '?'} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">{a.agent_name}</span>
                  <Stars rating={Math.round(a.average ?? 0)} />
                  <span className={cn('num w-10 text-right text-[13.5px] font-bold', (a.average ?? 0) < 3 ? 'text-red-600' : 'text-ink')}>{a.average?.toFixed(1)}</span>
                  <span className="w-16 text-right text-[12px] text-stone-400">
                    {a.n} visit{a.n === 1 ? '' : 's'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<Users />} title="No visit ratings yet" message="Executives record ratings from a completed site visit." />
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="All feedback" subtitle="Newest first" icon={<MessageSquareHeart />} />
        {data.data.length ? (
          <ul className="divide-y divide-stone-100 border-t border-stone-100" data-testid="feedback-list">
            {data.data.map((f) => {
              const who = f.customer_id ? { to: `/customers/${f.customer_id}`, name: f.customer_name } : f.lead_id ? { to: `/leads/${f.lead_id}`, name: f.lead_name } : null;
              return (
                <li key={f.id} className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-4">
                  <div className="flex shrink-0 items-center gap-2 sm:w-36 sm:flex-col sm:items-start sm:gap-1">
                    <Stars rating={f.rating} />
                    <span className="text-[12px] text-stone-400">{fmtDate(f.created_at)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {who ? (
                        <Link to={who.to} className="text-[13.5px] font-semibold text-ink hover:text-brand-800">
                          {who.name ?? 'Unknown'}
                        </Link>
                      ) : (
                        <span className="text-[13.5px] font-semibold text-ink">Anonymous</span>
                      )}
                      <Badge tone={f.kind === 'site_visit' ? 'blue' : f.kind === 'possession' ? 'brand' : 'gray'} dot={false}>
                        {KIND_LABEL[f.kind]}
                      </Badge>
                      {f.rating <= 2 && <Badge tone="red">Low</Badge>}
                    </div>
                    {f.comment ? <p className="mt-1 text-[13px] leading-relaxed text-stone-700">“{f.comment}”</p> : <p className="mt-1 text-[12.5px] text-stone-400">No comment</p>}
                    {f.agent_name && <p className="mt-1 text-[12px] text-stone-500">Executive: {f.agent_name}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<MessageSquareHeart />} title="No feedback yet" message="Visitor ratings and customer feedback from the portal appear here." />
        )}
      </Card>
    </div>
  );
}
