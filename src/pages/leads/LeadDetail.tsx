import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Copy, GitMerge, MapPin, MessageSquareText, CalendarCheck2, CalendarPlus, Check, CircleX, FileText, ListChecks, Mail, MessageCircle, MoreHorizontal, Pencil, Phone, PhoneCall, Send, Sparkles, Star, StickyNote, Trash2, Upload, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, fmtDateTime, fmtTime, inr, inrShort, relativeDay, timeAgo, todayStr } from '@/lib/format';
import { CONTACT_CHANNELS, LEAD_STATUSES, cn, smsHref, telHref, waHref } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { Card, CardHeader, InfoRow } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PriorityBadge, PropertyStatusBadge, StatusBadge, TaskPriorityBadge } from '@/components/ui/Badge';
import { Avatar, Menu, MenuItem, MenuSeparator, PageHeader, Tabs, Tooltip } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { Field, Select, Textarea } from '@/components/ui/Form';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { ActivityTimeline } from '@/components/domain/Timeline';
import { LeadFormModal } from '@/components/domain/LeadForms';
import { FollowupFormModal, OutcomeModal, SiteVisitFormModal, TaskFormModal } from '@/components/domain/ScheduleForms';
import { ConvertLeadModal } from '@/components/domain/FinanceForms';
import { DocumentList, UploadDocumentModal } from '@/components/domain/Documents';
import { PropertyThumb } from '@/components/domain/PropertyGallery';
import { IdleMarker, ScoreBadge, ScoreBar } from '@/components/domain/LeadHeat';
import { VisitRatingModal } from '@/components/domain/FeedbackForms';
import type { Activity, DocumentItem, Followup, Lead, Property, SiteVisit, Task } from '@/types';

type LeadDetailData = Lead & {
  activities: Activity[];
  followups: Followup[];
  siteVisits: SiteVisit[];
  documents: DocumentItem[];
  tasks: Task[];
  property: Property | null;
  customer: { id: number; code: string; name: string } | null;
};

const STAGES = LEAD_STATUSES.filter((s) => s !== 'Lost');

function StageTrack({ lead, onChange }: { lead: Lead; onChange: (s: string) => void }) {
  const idx = STAGES.indexOf(lead.status as (typeof STAGES)[number]);
  const lost = lead.status === 'Lost';
  return (
    <div className="scroll-thin -mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-[640px] gap-1">
        {STAGES.map((s, i) => {
          const done = !lost && i < idx;
          const current = !lost && i === idx;
          const locked = (s === 'Booked' || s === 'Closed') && !lead.customer_id;
          return (
            <li key={s} className="flex-1">
              <button
                disabled={current || locked}
                onClick={() => onChange(s)}
                title={locked ? 'Convert to customer to book' : `Move to ${s}`}
                className={cn(
                  'group flex h-9 w-full items-center justify-center gap-1.5 text-[12px] font-bold transition-colors [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%,10px_50%)] first:rounded-l-lg first:[clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)]',
                  current ? 'bg-brand-800 text-white' : done ? 'bg-brand-100 text-brand-800 hover:bg-brand-200' : 'bg-stone-100 text-stone-500 hover:bg-stone-200 disabled:hover:bg-stone-100',
                  locked && 'cursor-not-allowed opacity-60',
                )}
              >
                {done && <Check className="size-3.5" />}
                {s}
              </button>
            </li>
          );
        })}
      </ol>
      {lost && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-red-600">
          <CircleX className="size-4" /> Marked as lost
          {lead.lost_reason ? ` — ${lead.lost_reason}` : ''}
        </p>
      )}
    </div>
  );
}

interface DuplicateLead {
  id: number;
  code: string;
  name?: string;
  phone?: string;
  status: string;
  source?: string;
  agent_name?: string | null;
  customer_id?: number | null;
  created_at?: string;
  accessible: boolean;
}

/** Other leads with the same phone number, with a merge action for managers. */
function DuplicatesCard({ lead }: { lead: Lead }) {
  const user = useUser();
  const confirm = useConfirm();
  const { data } = useQuery({
    queryKey: ['lead', String(lead.id), 'duplicates'],
    queryFn: () =>
      api
        .get<{
          data: DuplicateLead[];
        }>('/leads/duplicates', { phone: lead.phone, exclude: lead.id })
        .then((r) => r.data),
  });
  const merge = useAction((d: DuplicateLead) => api.post(`/leads/${lead.id}/merge`, { source_id: d.id }), { success: 'Leads merged. History, follow-ups and visits moved here.' });
  if (!data?.length) return null;
  return (
    <Card className="border-amber-200">
      <CardHeader title="Possible duplicates" subtitle="Same phone number" icon={<Copy />} />
      <ul className="divide-y divide-stone-100 px-5 pb-3">
        {data.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 py-3">
            <div className="min-w-0 flex-1">
              {d.accessible ? (
                <Link to={`/leads/${d.id}`} className="text-[13.5px] font-bold text-ink hover:text-brand-800">
                  {d.name} <span className="font-medium text-stone-400">· {d.code}</span>
                </Link>
              ) : (
                <p className="text-[13.5px] font-bold text-ink">{d.code}</p>
              )}
              <p className="text-[12px] text-stone-500">
                {d.status} · {d.agent_name ?? 'Unassigned'}
                {d.source ? ` · ${d.source}` : ''}
                {d.created_at ? ` · ${fmtDate(d.created_at)}` : ''}
              </p>
            </div>
            {can.manageLeads(user.role) && d.accessible && !d.customer_id && (
              <Button
                size="sm"
                icon={<GitMerge />}
                loading={merge.isPending && merge.variables?.id === d.id}
                onClick={async () =>
                  (await confirm({
                    title: `Merge ${d.code} into this lead?`,
                    message: `Its timeline, follow-ups, site visits, tasks and documents move to ${lead.code}, empty fields here are filled from it, and ${d.code} is deleted.`,
                    confirmLabel: 'Merge',
                  })) && merge.mutate(d)
                }
              >
                Merge here
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function LogContactModal({ open, onClose, leadId }: { open: boolean; onClose: () => void; leadId: number }) {
  const [channel, setChannel] = useState('Call');
  const [summary, setSummary] = useState('');
  const log = useAction(() => api.post(`/leads/${leadId}/log-contact`, { channel, summary }), {
    success: 'Interaction logged',
    onSuccess: () => {
      setSummary('');
      onClose();
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Log interaction"
      description="Adds to the timeline and updates last contact"
      onSubmit={() => log.mutate(undefined)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={log.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Channel">
          {(id) => (
            <Select id={id} value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CONTACT_CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Summary">{(id) => <Textarea id={id} autoFocus rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What was discussed?" />}</Field>
      </div>
    </Modal>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'activity' | 'followups' | 'visits' | 'notes' | 'documents' | 'tasks'>('activity');
  const [modal, setModal] = useState<null | 'edit' | 'followup' | 'visit' | 'convert' | 'log' | 'upload' | 'task' | 'lost'>(null);
  const [note, setNote] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [completeFu, setCompleteFu] = useState<Followup | null>(null);
  const [editVisit, setEditVisit] = useState<SiteVisit | null>(null);
  const [rateVisit, setRateVisit] = useState<SiteVisit | null>(null);
  const {
    data: lead,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<LeadDetailData>(`/leads/${id}`),
  });

  const setStatus = useAction((v: { status: string; reason?: string }) => api.patch(`/leads/${id}/status`, v), { success: (r: any) => `Moved to ${r.status}` });
  const addNote = useAction(() => api.post(`/leads/${id}/notes`, { note }), {
    success: 'Note added',
    onSuccess: () => setNote(''),
  });
  const completeFollowup = useAction(
    (v: { id: number; outcome: string }) =>
      api.put(`/followups/${v.id}`, {
        status: 'Completed',
        outcome: v.outcome || null,
      }),
    { success: 'Follow-up completed', onSuccess: () => setCompleteFu(null) },
  );
  const del = useAction(() => api.delete(`/leads/${id}`), {
    success: 'Lead deleted',
    onSuccess: () => navigate('/leads'),
  });

  if (isLoading) return <PageSkeleton stats={0} />;
  if (error || !lead) return <ErrorState error={error} onRetry={refetch} />;

  const notes = lead.activities.filter((a) => a.type === 'note');
  const pendingFu = lead.followups.filter((f) => f.status === 'Pending');
  const converted = !!lead.customer_id;
  const p = lead.property;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Leads', to: '/leads' }, { label: lead.name }]}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {lead.name}
            <StatusBadge status={lead.status} className="text-[12px]" />
            <PriorityBadge priority={lead.priority} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{lead.code}</span>
            <span className="text-stone-300">•</span>
            <span>
              Assigned to <b className="font-semibold text-stone-700">{lead.agent_name ?? 'nobody yet'}</b>
            </span>
            <span className="text-stone-300">•</span>
            <span>Created {fmtDate(lead.created_at)}</span>
          </span>
        }
        actions={
          <>
            <div className="flex gap-1.5">
              <Tooltip content={`Call ${lead.phone}`}>
                <a href={telHref(lead.phone)} className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-stone-700 shadow-card hover:bg-stone-50 sm:size-9" aria-label="Call">
                  <Phone className="size-4" />
                </a>
              </Tooltip>
              <Tooltip content="SMS">
                <a href={smsHref(lead.phone)} className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-stone-700 shadow-card hover:bg-stone-50 sm:size-9" aria-label="SMS">
                  <MessageSquareText className="size-4" />
                </a>
              </Tooltip>
              <Tooltip content="WhatsApp">
                <a
                  href={waHref(lead.phone, `Hello ${lead.name.split(' ')[0]}, this is ${user.name.split(' ')[0]} from Starwiz Realty.`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-emerald-700 shadow-card hover:bg-emerald-50 sm:size-9"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="size-4" />
                </a>
              </Tooltip>
              {lead.email && (
                <Tooltip content={lead.email}>
                  <a href={`mailto:${lead.email}`} className="flex size-10 items-center justify-center rounded-[10px] border border-stone-200 bg-white text-stone-700 shadow-card hover:bg-stone-50 sm:size-9" aria-label="Email">
                    <Mail className="size-4" />
                  </a>
                </Tooltip>
              )}
            </div>
            <Button icon={<CalendarPlus />} onClick={() => setModal('visit')}>
              Site visit
            </Button>
            {converted ? (
              <ButtonLink to={`/customers/${lead.customer_id}`} variant="primary" icon={<UserRound />}>
                View customer
              </ButtonLink>
            ) : (
              lead.status !== 'Lost' && (
                <Button variant="primary" icon={<Sparkles />} onClick={() => setModal('convert')}>
                  Convert to customer
                </Button>
              )
            )}
            <Menu trigger={<Button size="icon" aria-label="More actions" icon={<MoreHorizontal />} />}>
              <MenuItem icon={<Pencil />} onSelect={() => setModal('edit')}>
                Edit lead
              </MenuItem>
              <MenuItem icon={<PhoneCall />} onSelect={() => setModal('log')}>
                Log call / message
              </MenuItem>
              <MenuItem icon={<CalendarCheck2 />} onSelect={() => setModal('followup')}>
                Schedule follow-up
              </MenuItem>
              <MenuItem icon={<ListChecks />} onSelect={() => setModal('task')}>
                Add task
              </MenuItem>
              <MenuItem icon={<Upload />} onSelect={() => setModal('upload')}>
                Upload document
              </MenuItem>
              {!converted && lead.status !== 'Lost' && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<CircleX />} onSelect={() => setModal('lost')} danger>
                    Mark as lost
                  </MenuItem>
                </>
              )}
              {can.manageLeads(user.role) && !converted && (
                <MenuItem
                  icon={<Trash2 />}
                  danger
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: 'Delete this lead?',
                        message: `${lead.name} and all related follow-ups, visits and notes will be permanently deleted.`,
                        confirmLabel: 'Delete lead',
                      })
                    )
                      del.mutate(undefined);
                  }}
                >
                  Delete lead
                </MenuItem>
              )}
            </Menu>
          </>
        }
      />

      <Card className="mb-5 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="label-xs">Pipeline stage</p>
          {lead.next_followup && <p className={cn('text-[12.5px] font-semibold', lead.next_followup.slice(0, 10) < todayStr() ? 'text-red-600' : 'text-stone-500')}>Next follow-up: {fmtDateTime(lead.next_followup)}</p>}
        </div>
        <StageTrack
          lead={lead}
          onChange={(s) => {
            if (s === 'Booked') setModal('convert');
            else setStatus.mutate({ status: s });
          }}
        />
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <Card className="min-w-0 overflow-hidden">
          <Tabs
            className="px-4 pt-1 sm:px-5"
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: 'activity',
                label: 'Activity',
                count: lead.activities.length,
              },
              {
                value: 'followups',
                label: 'Follow-ups',
                count: pendingFu.length,
              },
              {
                value: 'visits',
                label: 'Site visits',
                count: lead.siteVisits.length,
              },
              { value: 'notes', label: 'Notes', count: notes.length },
              {
                value: 'documents',
                label: 'Documents',
                count: lead.documents.length,
              },
              {
                value: 'tasks',
                label: 'Tasks',
                count: lead.tasks.filter((t) => t.status !== 'Completed').length,
              },
            ]}
          />
          <div className="p-4 sm:p-5">
            {(tab === 'activity' || tab === 'notes') && (
              <form
                className="mb-6 flex gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate(undefined);
                }}
              >
                <Avatar name={user.name} size="md" className="hidden sm:inline-flex" />
                <div className="flex-1">
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note — visible to your team only" />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" icon={<PhoneCall />} onClick={() => setModal('log')}>
                      Log call
                    </Button>
                    <Button size="sm" type="submit" variant="primary" icon={<Send />} disabled={!note.trim()} loading={addNote.isPending}>
                      Add note
                    </Button>
                  </div>
                </div>
              </form>
            )}
            {tab === 'activity' && <ActivityTimeline items={lead.activities} />}
            {tab === 'notes' && <ActivityTimeline items={notes} emptyText="No notes yet" />}
            {tab === 'followups' && (
              <div>
                <div className="mb-3 flex justify-end">
                  <Button size="sm" icon={<CalendarPlus />} onClick={() => setModal('followup')}>
                    Schedule follow-up
                  </Button>
                </div>
                {lead.followups.length ? (
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100">
                    {lead.followups.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <div className="w-24 shrink-0">
                          <p className="text-[13px] font-bold text-ink">
                            {fmtDate(f.due_date, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                          <p className="text-[12px] text-stone-500">{fmtTime(f.due_time)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold text-ink">
                            {f.type} <span className="font-normal text-stone-400">· {f.agent_name}</span>
                          </p>
                          <p className="text-[12.5px] text-stone-500">{f.outcome ?? f.notes}</p>
                        </div>
                        <StatusBadge status={f.status === 'Pending' && f.due_date < todayStr() ? 'Overdue' : f.status} />
                        {f.status === 'Pending' && (
                          <Button size="sm" variant="subtle" icon={<Check />} onClick={() => setCompleteFu(f)}>
                            Done
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact icon={<CalendarCheck2 />} title="No follow-ups scheduled" />
                )}
              </div>
            )}
            {tab === 'visits' && (
              <div>
                <div className="mb-3 flex justify-end">
                  <Button size="sm" icon={<CalendarPlus />} onClick={() => setModal('visit')}>
                    Schedule site visit
                  </Button>
                </div>
                {lead.siteVisits.length ? (
                  <ul className="space-y-2">
                    {lead.siteVisits.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-start gap-3 rounded-xl border border-stone-100 p-3.5">
                        <div className="w-24 shrink-0">
                          <p className="text-[13px] font-bold text-ink">
                            {fmtDate(v.visit_date, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                          <p className="text-[12px] text-stone-500">{fmtTime(v.visit_time)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-semibold text-ink">
                            {v.property_project ?? 'Township tour'} {v.property_unit ? `· ${v.property_unit}` : ''}
                          </p>
                          <p className="text-[12.5px] text-stone-500">with {v.agent_name}</p>
                          {v.checked_in_at && (
                            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] text-stone-500">
                              <MapPin className="size-3.5 text-brand-700" />
                              Checked in {fmtDateTime(v.checked_in_at)}
                              {v.checkin_lat != null && v.checkin_lng != null && (
                                <span className="num text-stone-400">
                                  ({v.checkin_lat.toFixed(5)}, {v.checkin_lng.toFixed(5)})
                                </span>
                              )}
                              {v.checked_out_at && <span>· out {fmtDateTime(v.checked_out_at)}</span>}
                              {!!v.photos && (
                                <span>
                                  · {v.photos} photo{v.photos > 1 ? 's' : ''}
                                </span>
                              )}
                            </p>
                          )}
                          {v.feedback && <p className="mt-1.5 text-[13px] text-stone-700">“{v.feedback}”</p>}
                          {v.next_action && <p className="mt-1 text-[12.5px] text-stone-500">Next: {v.next_action}</p>}
                        </div>
                        <StatusBadge status={v.status} />
                        {v.status === 'Completed' && (
                          <Button size="icon-sm" variant="ghost" aria-label="Record visitor rating" title="Record visitor rating" onClick={() => setRateVisit(v)}>
                            <Star />
                          </Button>
                        )}
                        <Button size="icon-sm" variant="ghost" aria-label="Update visit" onClick={() => setEditVisit(v)}>
                          <Pencil />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    compact
                    icon={<CalendarCheck2 />}
                    title="No site visits yet"
                    action={
                      <Button variant="primary" size="sm" onClick={() => setModal('visit')}>
                        Schedule visit
                      </Button>
                    }
                  />
                )}
              </div>
            )}
            {tab === 'documents' && (
              <div>
                <div className="mb-3 flex justify-end">
                  <Button size="sm" icon={<Upload />} onClick={() => setModal('upload')}>
                    Upload
                  </Button>
                </div>
                <div className="overflow-hidden rounded-xl border border-stone-100">
                  <DocumentList docs={lead.documents} />
                </div>
              </div>
            )}
            {tab === 'tasks' && (
              <div>
                <div className="mb-3 flex justify-end">
                  <Button size="sm" icon={<ListChecks />} onClick={() => setModal('task')}>
                    Add task
                  </Button>
                </div>
                {lead.tasks.length ? (
                  <ul className="divide-y divide-stone-100 rounded-xl border border-stone-100">
                    {lead.tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={cn('size-2 rounded-full', t.status === 'Completed' ? 'bg-brand-500' : 'bg-amber-400')} />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-[13.5px] font-semibold', t.status === 'Completed' ? 'text-stone-400 line-through' : 'text-ink')}>{t.title}</p>
                          <p className="text-[12px] text-stone-500">
                            {t.assignee_name} · {t.due_date ? `Due ${relativeDay(t.due_date).toLowerCase()}` : 'No due date'}
                          </p>
                        </div>
                        <TaskPriorityBadge priority={t.priority} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState compact icon={<ListChecks />} title="No tasks for this lead" />
                )}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          <DuplicatesCard lead={lead} />
          <Card>
            <CardHeader
              title="Lead information"
              action={
                <Button size="icon-sm" variant="ghost" aria-label="Edit lead" onClick={() => setModal('edit')}>
                  <Pencil />
                </Button>
              }
            />
            {lead.score !== undefined && lead.score !== null && (
              <div className="mx-5 mb-4 rounded-xl border border-stone-100 bg-stone-50/70 px-3.5 py-3" data-testid="lead-score">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-medium text-stone-500">Lead score</span>
                  <ScoreBadge score={lead.score} />
                </div>
                <ScoreBar score={lead.score} className="mt-2" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12.5px] text-stone-600">{lead.score_reason}</p>
                  <IdleMarker lead={lead} />
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 pb-5">
              <InfoRow label="Phone">
                <a href={telHref(lead.phone)} className="hover:text-brand-800">
                  {lead.phone}
                </a>
              </InfoRow>
              <InfoRow label="Email">{lead.email && <span className="break-all">{lead.email}</span>}</InfoRow>
              <InfoRow label="Location">{lead.location}</InfoRow>
              <InfoRow label="Budget">{lead.budget ? inr(lead.budget) : null}</InfoRow>
              <InfoRow label="Source">{lead.source}</InfoRow>
              {lead.referred_by_name && (
                <InfoRow label="Referred by">
                  {lead.referred_by_customer_id ? (
                    <Link to={`/customers/${lead.referred_by_customer_id}`} className="text-brand-800 hover:underline">
                      {lead.referred_by_name}
                    </Link>
                  ) : (
                    lead.referred_by_name
                  )}
                </InfoRow>
              )}
              <InfoRow label="Looking for">{lead.property_type}</InfoRow>
              <InfoRow label="Last contact">{lead.last_contact ? timeAgo(lead.last_contact) : 'Never'}</InfoRow>
              <InfoRow label="Assigned to">{lead.agent_name}</InfoRow>
              <InfoRow label="Requirement" className="col-span-2">
                <span className="font-normal leading-relaxed text-stone-700">{lead.requirement}</span>
              </InfoRow>
            </dl>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Interested property" />
            {p ? (
              <div className="px-5 pb-5">
                <Link to={`/properties/${p.id}`} className="group block overflow-hidden rounded-xl border border-stone-100">
                  <PropertyThumb id={p.id} type={p.type} project={p.project} className="h-36 w-full" />
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-bold text-ink group-hover:text-brand-800">{p.name}</p>
                        <p className="text-[12.5px] text-stone-500">
                          {p.project} · {p.unit_number}
                        </p>
                      </div>
                      <PropertyStatusBadge status={p.status} />
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-[18px] font-extrabold text-ink">{inrShort(p.price)}</p>
                      <p className="text-[12.5px] text-stone-500">
                        {p.area_sqft.toLocaleString('en-IN')} sq ft {p.facing ? `· ${p.facing}` : ''}
                      </p>
                    </div>
                  </div>
                </Link>
                {lead.budget && p.price > lead.budget * 1.1 && <p className="mt-2.5 text-[12.5px] font-medium text-amber-700">List price is {Math.round((p.price / lead.budget - 1) * 100)}% above the stated budget.</p>}
              </div>
            ) : (
              <EmptyState
                compact
                icon={<FileText />}
                title="No property selected"
                action={
                  <Button size="sm" onClick={() => setModal('edit')}>
                    Choose property
                  </Button>
                }
              />
            )}
          </Card>

          {lead.customer && (
            <Card className="border-brand-200 bg-brand-50/50 p-4">
              <p className="label-xs text-brand-800/70">Converted</p>
              <Link to={`/customers/${lead.customer.id}`} className="mt-1 flex items-center justify-between text-[14px] font-bold text-brand-900 hover:underline">
                {lead.customer.name} · {lead.customer.code} <ArrowUpRight className="size-4" />
              </Link>
            </Card>
          )}

          {pendingFu.length > 0 && (
            <Card>
              <CardHeader title="Upcoming follow-ups" icon={<StickyNote />} />
              <ul className="px-5 pb-4">
                {pendingFu.slice(0, 3).map((f) => (
                  <li key={f.id} className="flex items-center justify-between border-t border-stone-100 py-2.5 text-[13px] first:border-0">
                    <span className="font-semibold text-ink">
                      {f.type} · {relativeDay(f.due_date)}
                    </span>
                    <span className="text-stone-500">{fmtTime(f.due_time)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <LeadFormModal open={modal === 'edit'} onClose={() => setModal(null)} lead={lead} />
      <FollowupFormModal open={modal === 'followup'} onClose={() => setModal(null)} lead={lead} />
      <SiteVisitFormModal open={modal === 'visit'} onClose={() => setModal(null)} lead={lead} />
      <SiteVisitFormModal open={!!editVisit} onClose={() => setEditVisit(null)} visit={editVisit} />
      <VisitRatingModal visit={rateVisit} onClose={() => setRateVisit(null)} />
      <TaskFormModal open={modal === 'task'} onClose={() => setModal(null)} lead={lead} />
      <LogContactModal open={modal === 'log'} onClose={() => setModal(null)} leadId={lead.id} />
      <UploadDocumentModal open={modal === 'upload'} onClose={() => setModal(null)} entityType="lead" entityId={lead.id} defaultType="ID Proof" />
      {!converted && <ConvertLeadModal open={modal === 'convert'} onClose={() => setModal(null)} lead={lead} />}
      <OutcomeModal open={!!completeFu} onClose={() => setCompleteFu(null)} title="Complete follow-up" label="Outcome" busy={completeFollowup.isPending} onSave={(t) => completeFu && completeFollowup.mutate({ id: completeFu.id, outcome: t })} />
      <Modal
        open={modal === 'lost'}
        onClose={() => setModal(null)}
        size="sm"
        title="Mark lead as lost"
        onSubmit={() => setStatus.mutate({ status: 'Lost', reason: lostReason }, { onSuccess: () => setModal(null) })}
        footer={
          <>
            <Button onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={setStatus.isPending}>
              Mark as lost
            </Button>
          </>
        }
      >
        <Field label="Reason">
          {(id) => (
            <Select id={id} value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
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
