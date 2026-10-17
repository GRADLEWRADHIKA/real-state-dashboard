import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { todayStr } from '@/lib/format';
import { FOLLOWUP_TYPES, TASK_PRIORITIES, TASK_STATUSES, VISIT_STATUSES, cn } from '@/lib/utils';
import { useAction, useAgents, useDirectory, usePropertyOptions } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { LeadSelect } from './LeadForms';
import type { Followup, SiteVisit, Task } from '@/types';

type LeadRef = {
  id: number;
  name: string;
  property_id?: number | null;
  assigned_to?: number | null;
} | null;

const TIME_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'];

export function FollowupFormModal({ open, onClose, lead, followup }: { open: boolean; onClose: () => void; lead?: LeadRef; followup?: Followup | null }) {
  const user = useUser();
  const agents = useAgents();
  const [picked, setPicked] = useState<LeadRef>(lead ?? null);
  const editing = !!followup;
  const f = useForm(
    {
      due_date: followup?.due_date ?? todayStr(1),
      due_time: followup?.due_time ?? '11:00',
      type: followup?.type ?? 'Call',
      notes: followup?.notes ?? '',
      agent_id: followup?.agent_id ? String(followup.agent_id) : '',
    },
    (v) => ({ due_date: required(v.due_date), due_time: required(v.due_time) }),
  );
  useEffect(() => {
    if (open) {
      f.reset();
      setPicked(lead ?? (followup ? { id: followup.lead_id, name: followup.lead_name } : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(
    (v: typeof f.values) => {
      const body = {
        ...v,
        agent_id: v.agent_id ? Number(v.agent_id) : undefined,
        lead_id: picked!.id,
      };
      return editing ? api.put(`/followups/${followup!.id}`, body) : api.post('/followups', body);
    },
    {
      success: editing ? 'Follow-up updated' : 'Follow-up scheduled',
      onSuccess: onClose,
    },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit follow-up' : 'Schedule follow-up'}
      description={picked ? `With ${picked.name}` : 'Pick a lead and a time'}
      onSubmit={() => {
        if (!picked) return f.setErrors({ form: 'Select a lead' });
        f.submit((v) => save.mutateAsync(v));
      }}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save' : 'Schedule'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!lead && !editing && (
          <Field label="Lead" required error={f.errors.form} className="sm:col-span-2">
            {() => <LeadSelect value={picked} onChange={(l) => setPicked(l)} invalid={!!f.errors.form} />}
          </Field>
        )}
        <Field label="Type" className="sm:col-span-2">
          {() => (
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => f.set('type', t)}
                  className={cn('h-9 rounded-[10px] border px-3 text-[13px] font-semibold transition-colors', f.values.type === t ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-stone-200 text-stone-600 hover:bg-stone-50')}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </Field>
        <Field label="Date" required error={f.errors.due_date}>
          {(id) => <Input id={id} type="date" {...f.bind('due_date')} />}
        </Field>
        <Field label="Time" required error={f.errors.due_time}>
          {(id) => (
            <Select id={id} {...f.bind('due_time')}>
              {[...new Set([...TIME_SLOTS, f.values.due_time])].sort().map((t) => (
                <option key={t} value={t}>
                  {new Date(`2000-01-01T${t}`)
                    .toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                    .toUpperCase()}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {can.assignLeads(user.role) && (
          <Field label="Owner" hint="Defaults to the lead’s assigned executive" className="sm:col-span-2">
            {(id) => (
              <Select id={id} {...f.bind('agent_id')}>
                <option value="">Lead owner</option>
                {agents.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Notes" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} placeholder="What should be discussed?" {...f.bind('notes')} />}
        </Field>
      </div>
    </Modal>
  );
}

export function SiteVisitFormModal({ open, onClose, lead, visit }: { open: boolean; onClose: () => void; lead?: LeadRef; visit?: SiteVisit | null }) {
  const user = useUser();
  const agents = useAgents();
  const props = usePropertyOptions();
  const [picked, setPicked] = useState<LeadRef>(lead ?? null);
  const editing = !!visit;
  const f = useForm(
    {
      property_id: String(visit?.property_id ?? lead?.property_id ?? ''),
      visit_date: visit?.visit_date ?? todayStr(1),
      visit_time: visit?.visit_time ?? '11:00',
      agent_id: visit?.agent_id ? String(visit.agent_id) : '',
      status: visit?.status ?? 'Scheduled',
      feedback: visit?.feedback ?? '',
      next_action: visit?.next_action ?? '',
    },
    (v) => ({
      visit_date: required(v.visit_date),
      visit_time: required(v.visit_time),
    }),
  );
  useEffect(() => {
    if (open) {
      f.reset();
      setPicked(lead ?? (visit ? { id: visit.lead_id, name: visit.lead_name } : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(
    (v: typeof f.values) => {
      const body = {
        ...v,
        property_id: v.property_id ? Number(v.property_id) : null,
        agent_id: v.agent_id ? Number(v.agent_id) : undefined,
        lead_id: picked!.id,
      };
      return editing ? api.put(`/site-visits/${visit!.id}`, body) : api.post('/site-visits', body);
    },
    {
      success: editing ? 'Site visit updated' : 'Site visit scheduled',
      onSuccess: onClose,
    },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Update site visit' : 'Schedule site visit'}
      description={picked ? `With ${picked.name}` : 'Pick a lead, unit and time'}
      onSubmit={() => {
        if (!picked) return f.setErrors({ form: 'Select a lead' });
        f.submit((v) => save.mutateAsync(v));
      }}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save' : 'Schedule visit'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!lead && !editing && (
          <Field label="Lead" required error={f.errors.form} className="sm:col-span-2">
            {() => (
              <LeadSelect
                value={picked}
                onChange={(l) => {
                  setPicked(l);
                  if (l?.property_id && !f.values.property_id) f.set('property_id', String(l.property_id));
                }}
                invalid={!!f.errors.form}
              />
            )}
          </Field>
        )}
        <Field label="Property" className="sm:col-span-2">
          {(id) => (
            <Select id={id} {...f.bind('property_id')}>
              <option value="">Township tour (no specific unit)</option>
              {props.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project} · {p.unit_number} — {p.name} ({p.status})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date" required error={f.errors.visit_date}>
          {(id) => <Input id={id} type="date" {...f.bind('visit_date')} />}
        </Field>
        <Field label="Time" required>
          {(id) => (
            <Select id={id} {...f.bind('visit_time')}>
              {[...new Set([...TIME_SLOTS, f.values.visit_time])].sort().map((t) => (
                <option key={t} value={t}>
                  {new Date(`2000-01-01T${t}`)
                    .toLocaleTimeString('en-IN', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                    .toUpperCase()}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {can.assignLeads(user.role) && (
          <Field label="Sales executive">
            {(id) => (
              <Select id={id} {...f.bind('agent_id')}>
                <option value="">Lead owner</option>
                {agents.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {editing && (
          <Field label="Status">
            {(id) => (
              <Select id={id} {...f.bind('status')}>
                {VISIT_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {editing && (
          <Field label="Feedback" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} placeholder="How did the visit go?" {...f.bind('feedback')} />}
          </Field>
        )}
        <Field label="Next action" className="sm:col-span-2">
          {(id) => <Input id={id} placeholder="e.g. Share cost sheet, arrange pick-up" {...f.bind('next_action')} />}
        </Field>
      </div>
    </Modal>
  );
}

/** Quick outcome capture when completing a follow-up or a visit. */
export function OutcomeModal({ open, onClose, title, label, onSave, busy }: { open: boolean; onClose: () => void; title: string; label: string; onSave: (text: string) => void; busy?: boolean }) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (open) setText('');
  }, [open]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      onSubmit={() => onSave(text)}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Mark completed
          </Button>
        </>
      }
    >
      <Field label={label} hint="Optional — added to the lead timeline">
        {(id) => <Textarea id={id} autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
    </Modal>
  );
}

export function TaskFormModal({ open, onClose, task, lead }: { open: boolean; onClose: () => void; task?: Task | null; lead?: LeadRef }) {
  const user = useUser();
  const dir = useDirectory();
  const [picked, setPicked] = useState<LeadRef>(lead ?? null);
  const editing = !!task;
  const f = useForm(
    {
      title: task?.title ?? '',
      description: task?.description ?? '',
      assigned_to: String(task?.assigned_to ?? user.id),
      priority: task?.priority ?? 'Medium',
      due_date: task?.due_date ?? todayStr(1),
      status: task?.status ?? 'Todo',
    },
    (v) => ({
      title: required(v.title) ?? (v.title.trim().length < 3 ? 'Too short' : undefined),
    }),
  );
  useEffect(() => {
    if (open) {
      f.reset();
      setPicked(lead ?? (task?.lead_id ? { id: task.lead_id, name: task.lead_name ?? 'Lead' } : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(
    (v: typeof f.values) => {
      const body = {
        ...v,
        assigned_to: Number(v.assigned_to),
        due_date: v.due_date || null,
        lead_id: picked?.id ?? null,
        customer_id: task?.customer_id ?? null,
      };
      return editing ? api.put(`/tasks/${task!.id}`, body) : api.post('/tasks', body);
    },
    { success: editing ? 'Task updated' : 'Task created', onSuccess: onClose },
  );
  const staff = dir.data?.filter((u) => u.role !== 'customer') ?? [];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit task' : 'New task'}
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save' : 'Create task'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Task" required error={f.errors.title} className="sm:col-span-2">
          {(id) => <Input id={id} autoFocus placeholder="e.g. Prepare cost sheet for villa V-22" {...f.bind('title')} />}
        </Field>
        <Field label="Assigned to">
          {(id) => (
            <Select id={id} {...f.bind('assigned_to')}>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === user.id ? ' (me)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} {...f.bind('priority')}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Due date">{(id) => <Input id={id} type="date" {...f.bind('due_date')} />}</Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} {...f.bind('status')}>
              {TASK_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        {can.sales(user.role) && (
          <Field label="Related lead" className="sm:col-span-2">
            {() => <LeadSelect value={picked} onChange={setPicked} />}
          </Field>
        )}
        <Field label="Details" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} {...f.bind('description')} />}
        </Field>
      </div>
    </Modal>
  );
}
