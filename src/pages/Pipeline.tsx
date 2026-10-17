import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, pointerWithin, rectIntersection, type CollisionDetection, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CalendarClock, GripVertical, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { inrShort, relativeDay, timeAgo, todayStr } from '@/lib/format';
import { LEAD_STATUSES, cn } from '@/lib/utils';
import { useAgents, useDebounce } from '@/hooks/queries';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FilterSelect, SearchInput, Field, Select } from '@/components/ui/Form';
import { Avatar, PageHeader } from '@/components/ui/Misc';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { ConvertLeadModal } from '@/components/domain/FinanceForms';
import type { Lead } from '@/types';

const COLUMN_LABEL: Record<string, string> = { New: 'New lead' };
const COLUMN_ACCENT: Record<string, string> = {
  New: 'bg-sky-500',
  Contacted: 'bg-indigo-500',
  Qualified: 'bg-violet-500',
  'Site Visit': 'bg-amber-500',
  Negotiation: 'bg-orange-500',
  Booked: 'bg-emerald-500',
  Closed: 'bg-brand-700',
  Lost: 'bg-stone-400',
};

/** Drop where the pointer is; fall back to overlap when the pointer sits in a gap between columns. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function LeadCard({ lead, overlay }: { lead: Lead; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    data: lead,
  });
  const overdue = lead.next_followup && lead.next_followup.slice(0, 10) < todayStr();
  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={cn(
        'group touch-none rounded-xl border bg-white p-3 shadow-card transition-shadow select-none',
        overlay ? 'rotate-[1.5deg] cursor-grabbing border-brand-300 shadow-pop' : 'cursor-grab border-stone-200/80 hover:border-stone-300 hover:shadow-md',
        isDragging && !overlay && 'opacity-30',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link to={`/leads/${lead.id}`} onPointerDown={(e) => e.stopPropagation()} className="block truncate text-[13.5px] font-bold text-ink hover:text-brand-800">
            {lead.name}
          </Link>
          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-stone-500">
            <MapPin className="size-3 shrink-0" />
            {lead.property_project ? `${lead.property_project.replace('Green Valley ', 'GV ')} · ${lead.property_unit}` : 'No unit selected'}
          </p>
        </div>
        <GripVertical className="size-4 shrink-0 text-stone-300 group-hover:text-stone-400" />
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[14px] font-extrabold text-ink">{inrShort(lead.budget)}</span>
        {lead.priority === 'Hot' && <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold text-red-600">HOT</span>}
      </div>
      {lead.last_activity && (
        <p className="mt-2 truncate text-[11.5px] text-stone-500" title={lead.last_activity}>
          {lead.last_activity} · {timeAgo(lead.last_activity_at)}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-stone-600">
          <Avatar name={lead.agent_name ?? '?'} size="xs" />
          <span className="truncate">{lead.agent_name?.split(' ')[0] ?? 'Unassigned'}</span>
        </span>
        {lead.next_followup ? (
          <span className={cn('flex items-center gap-1 text-[11.5px] font-semibold', overdue ? 'text-red-600' : 'text-stone-500')}>
            <CalendarClock className="size-3.5" />
            {relativeDay(lead.next_followup)}
          </span>
        ) : (
          <span className="text-[11.5px] text-stone-300">No follow-up</span>
        )}
      </div>
    </div>
  );
}

function Column({ stage, leads }: { stage: string; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const value = leads.reduce((s, l) => s + (l.budget ?? 0), 0);
  return (
    <section className="flex w-[272px] shrink-0 flex-col sm:w-[284px]">
      <header className="mb-2.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', COLUMN_ACCENT[stage])} />
          <h2 className="text-[13.5px] font-bold text-ink">{COLUMN_LABEL[stage] ?? stage}</h2>
          <span className="rounded-full bg-stone-200/70 px-1.5 text-[11.5px] leading-5 font-bold text-stone-600">{leads.length}</span>
        </div>
        <span className="text-[12px] font-semibold text-stone-500">{inrShort(value)}</span>
      </header>
      <div ref={setNodeRef} className={cn('scroll-thin flex min-h-[160px] flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-dashed p-2 transition-colors', isOver ? 'border-brand-400 bg-brand-50/70' : 'border-transparent bg-stone-200/40')}>
        {leads.map((l) => (
          <LeadCard key={l.id} lead={l} />
        ))}
        {!leads.length && <p className="py-8 text-center text-[12.5px] text-stone-400">Drop leads here</p>}
      </div>
    </section>
  );
}

export default function Pipeline() {
  const user = useUser();
  const qc = useQueryClient();
  const agents = useAgents();
  const [agent, setAgent] = useState('');
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('');
  const dq = useDebounce(q, 150);
  const [active, setActive] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [reason, setReason] = useState('');
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['leads', 'board'],
    queryFn: () => api.get<{ data: Lead[] }>('/leads/board').then((r) => r.data),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const filtered = useMemo(
    () => (data ?? []).filter((l) => (!agent || String(l.assigned_to) === agent) && (!priority || l.priority === priority) && (!dq || `${l.name} ${l.phone} ${l.property_project ?? ''} ${l.property_unit ?? ''}`.toLowerCase().includes(dq.toLowerCase()))),
    [data, agent, priority, dq],
  );
  const byStage = useMemo(() => Object.fromEntries(LEAD_STATUSES.map((s) => [s, filtered.filter((l) => l.status === s)])), [filtered]);

  const move = async (lead: Lead, status: string, reasonText?: string) => {
    const prev = qc.getQueryData<Lead[]>(['leads', 'board']);
    qc.setQueryData<Lead[]>(['leads', 'board'], (old) => old?.map((l) => (l.id === lead.id ? { ...l, status } : l)));
    try {
      await api.patch(`/leads/${lead.id}/status`, {
        status,
        reason: reasonText,
      });
      toast.success(`${lead.name} moved to ${status}`);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['lead', String(lead.id)] });
    } catch (e: any) {
      qc.setQueryData(['leads', 'board'], prev);
      toast.error(e.message);
    }
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActive(null);
    const lead = e.active.data.current as Lead | undefined;
    const to = e.over?.id as string | undefined;
    if (!lead || !to || to === lead.status) return;
    if ((to === 'Booked' || to === 'Closed') && !lead.customer_id) {
      if (to === 'Closed') return toast.error('Book the unit first — move the lead to Booked to convert it.');
      try {
        setConvertLead(await api.get<Lead>(`/leads/${lead.id}`));
      } catch (err: any) {
        toast.error(err.message);
      }
      return;
    }
    if (to === 'Lost') {
      setReason('');
      setLostLead(lead);
      return;
    }
    move(lead, to);
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Sales pipeline"
        subtitle={`${filtered.length} leads · ${inrShort(filtered.filter((l) => !['Lost', 'Closed'].includes(l.status)).reduce((s, l) => s + (l.budget ?? 0), 0))} open pipeline value. Drag cards between stages.`}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Pipeline' }]}
        actions={
          <ButtonLink to="/leads?new=1" variant="primary" icon={<Plus />}>
            New lead
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Filter by name, phone, unit…" className="sm:w-72" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
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
          <FilterSelect value={priority} onChange={setPriority} placeholder="Any priority" options={['Hot', 'Warm', 'Cold']} />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-[284px] shrink-0 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-[420px] rounded-2xl" />
            </div>
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e) => setActive(e.active.data.current as Lead)} onDragCancel={() => setActive(null)} onDragEnd={onDragEnd}>
          <div className="scroll-thin -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ height: 'calc(100dvh - 260px)', minHeight: 480 }}>
            {LEAD_STATUSES.map((s) => (
              <Column key={s} stage={s} leads={byStage[s] ?? []} />
            ))}
          </div>
          <DragOverlay
            dropAnimation={{
              duration: 180,
              easing: 'cubic-bezier(0.2,0.8,0.2,1)',
            }}
          >
            {active ? (
              <div className="w-[260px]">
                <LeadCard lead={active} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {convertLead && <ConvertLeadModal open onClose={() => setConvertLead(null)} lead={convertLead} />}
      <Modal
        open={!!lostLead}
        onClose={() => setLostLead(null)}
        size="sm"
        title={`Mark ${lostLead?.name ?? ''} as lost`}
        onSubmit={() => {
          if (lostLead) move(lostLead, 'Lost', reason);
          setLostLead(null);
        }}
        footer={
          <>
            <Button onClick={() => setLostLead(null)}>Cancel</Button>
            <Button type="submit" variant="danger">
              Mark as lost
            </Button>
          </>
        }
      >
        <Field label="Reason">
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Select a reason</option>
              {['Budget mismatch', 'Bought elsewhere', 'Location not suitable', 'Not reachable', 'Purchase postponed', 'Loan not approved', 'Other'].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          )}
        </Field>
      </Modal>
    </div>
  );
}
