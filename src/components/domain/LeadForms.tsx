import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Check, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser, can } from '@/lib/auth';
import { inrShort } from '@/lib/format';
import { LEAD_SOURCES, LEAD_STATUSES, PROPERTY_TYPES, cn } from '@/lib/utils';
import { useAction, useAgents, useDebounce, usePropertyOptions } from '@/hooks/queries';
import { required, useForm, validEmail, validPhone } from '@/hooks/useForm';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import type { Lead, Paged } from '@/types';

export function LeadFormModal({ open, onClose, lead, onSaved }: { open: boolean; onClose: () => void; lead?: Lead | null; onSaved?: (l: Lead) => void }) {
  const user = useUser();
  const agents = useAgents();
  const props = usePropertyOptions();
  const editing = !!lead;
  const f = useForm(
    {
      name: lead?.name ?? '',
      phone: lead?.phone ?? '',
      email: lead?.email ?? '',
      location: lead?.location ?? '',
      source: lead?.source ?? 'Website',
      property_id: lead?.property_id ? String(lead.property_id) : '',
      property_type: lead?.property_type ?? '',
      budget: (lead?.budget ?? '') as number | '',
      requirement: lead?.requirement ?? '',
      priority: lead?.priority ?? 'Warm',
      assigned_to: lead?.assigned_to ? String(lead.assigned_to) : user.role === 'sales' ? String(user.id) : '',
      status: lead?.status ?? 'New',
      notes: '',
    },
    (v) => ({
      name: required(v.name),
      phone: required(v.phone) ?? validPhone(v.phone),
      email: validEmail(v.email),
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id]);

  const save = useAction(
    (v: typeof f.values) => {
      const body = {
        ...v,
        property_id: v.property_id ? Number(v.property_id) : null,
        assigned_to: v.assigned_to ? Number(v.assigned_to) : null,
        budget: v.budget === '' ? null : v.budget,
        property_type: v.property_type || null,
        email: v.email || null,
        notes: v.notes || undefined,
        status: editing ? (v.status === lead!.status ? undefined : v.status) : v.status,
      };
      return editing ? api.put<Lead>(`/leads/${lead!.id}`, body) : api.post<Lead>('/leads', body);
    },
    {
      success: editing ? 'Lead updated' : (l: Lead) => `Lead ${l.code} created`,
      onSuccess: (l) => {
        onClose();
        onSaved?.(l);
      },
    },
  );
  const property = props.data?.find((p) => String(p.id) === f.values.property_id);
  // Warn about an existing lead with this number while typing; the server refuses the duplicate anyway.
  const phone = useDebounce(f.values.phone.replace(/\D/g, ''), 400);
  const dupes = useQuery({
    queryKey: ['leads', 'duplicates', phone, lead?.id],
    queryFn: () =>
      api
        .get<{
          data: {
            id: number;
            code: string;
            name?: string;
            agent_name?: string | null;
            accessible: boolean;
          }[];
        }>('/leads/duplicates', { phone, exclude: lead?.id })
        .then((r) => r.data),
    enabled: open && phone.length >= 10,
  });
  const dupe = phone.length >= 10 ? dupes.data?.[0] : undefined;
  const statuses = LEAD_STATUSES.filter((s) => s !== 'Booked' && s !== 'Closed');

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${lead!.name}` : 'New lead'}
      description={editing ? lead!.code : 'Capture a new enquiry. Duplicate phone numbers are detected automatically.'}
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save changes' : 'Create lead'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={f.errors.name}>
          {(id) => <Input id={id} autoFocus placeholder="e.g. Rohit Srivastava" {...f.bind('name')} />}
        </Field>
        <Field
          label="Phone"
          required
          error={f.errors.phone}
          hint={
            dupe ? (
              <span className="font-semibold text-amber-700">
                Already a lead:{' '}
                {dupe.accessible ? (
                  <Link to={`/leads/${dupe.id}`} onClick={onClose} className="underline">
                    {dupe.name} ({dupe.code})
                  </Link>
                ) : (
                  dupe.code
                )}
                {dupe.agent_name ? `, assigned to ${dupe.agent_name}` : ''}
              </span>
            ) : undefined
          }
        >
          {(id) => <Input id={id} type="tel" inputMode="tel" placeholder="+91 98390 12345" {...f.bind('phone')} />}
        </Field>
        <Field label="Email" error={f.errors.email}>
          {(id) => <Input id={id} type="email" placeholder="name@example.com" {...f.bind('email')} />}
        </Field>
        <Field label="Location">{(id) => <Input id={id} placeholder="e.g. Gomti Nagar, Lucknow" {...f.bind('location')} />}</Field>
        <Field label="Lead source" required>
          {(id) => (
            <Select id={id} {...f.bind('source')}>
              {LEAD_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority">
          {(id) => (
            <Select id={id} {...f.bind('priority')}>
              <option value="Hot">Hot — ready to buy</option>
              <option value="Warm">Warm — evaluating</option>
              <option value="Cold">Cold — early stage</option>
            </Select>
          )}
        </Field>
        <Field label="Interested property" hint={property ? `${property.name} · ${inrShort(property.price)} · ${property.status}` : 'Optional'}>
          {(id) => (
            <Select
              id={id}
              value={f.values.property_id}
              onChange={(e) => {
                f.set('property_id', e.target.value);
                const p = props.data?.find((x) => String(x.id) === e.target.value);
                if (p) {
                  if (!f.values.property_type) f.set('property_type', p.type);
                  if (f.values.budget === '') f.set('budget', p.price);
                }
              }}
            >
              <option value="">Not decided yet</option>
              {Object.entries(
                (props.data ?? []).reduce<Record<string, typeof props.data>>((acc, p) => {
                  (acc[p.project] ||= []).push(p);
                  return acc;
                }, {}),
              ).map(([project, list]) => (
                <optgroup key={project} label={project}>
                  {list!.map((p) => (
                    <option key={p.id} value={p.id} disabled={(p.status === 'Booked' || p.status === 'Sold') && String(p.id) !== f.values.property_id}>
                      {p.unit_number} · {p.name} · {inrShort(p.price)} {p.status !== 'Available' ? `(${p.status})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Property type">
          {(id) => (
            <Select id={id} {...f.bind('property_type')}>
              <option value="">Any</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Budget">{(id) => <MoneyInput id={id} value={f.values.budget} onChange={(v) => f.set('budget', v)} placeholder="45,00,000" />}</Field>
        {can.assignLeads(user.role) ? (
          <Field label="Assigned to">
            {(id) => (
              <Select id={id} {...f.bind('assigned_to')}>
                <option value="">Unassigned</option>
                {agents.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Stage">
            {(id) => (
              <Select id={id} {...f.bind('status')}>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {can.assignLeads(user.role) && (
          <Field label="Stage">
            {(id) => (
              <Select id={id} {...f.bind('status')} disabled={editing && (lead!.status === 'Booked' || lead!.status === 'Closed')}>
                {(editing && (lead!.status === 'Booked' || lead!.status === 'Closed') ? [lead!.status] : statuses).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Requirement" className="sm:col-span-2">
          {(id) => <Textarea id={id} placeholder="Size, facing, floor preference, timeline, loan requirement…" {...f.bind('requirement')} />}
        </Field>
        {!editing && (
          <Field label="Internal note" className="sm:col-span-2" hint="Visible to your team only">
            {(id) => <Textarea id={id} rows={2} placeholder="Anything the team should know" {...f.bind('notes')} />}
          </Field>
        )}
      </div>
    </Modal>
  );
}

/** Searchable lead picker for follow-up / visit / task forms. */
export function LeadSelect({ value, onChange, invalid, label }: { value: { id: number; name: string } | null; onChange: (l: Lead | null) => void; invalid?: boolean; label?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const dq = useDebounce(q, 200);
  const wrap = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useQuery({
    queryKey: ['lead-options', dq],
    queryFn: () =>
      api.get<Paged<Lead>>('/leads', {
        q: dq,
        limit: 8,
        sort: 'name',
        order: 'asc',
        status: 'New,Contacted,Qualified,Site Visit,Negotiation,Booked',
      }),
    enabled: open,
  });
  useEffect(() => {
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (value) {
    return (
      <div className="flex h-10 items-center justify-between rounded-[10px] border border-stone-200 bg-stone-50 px-3 text-[14px]">
        <span className="font-semibold text-ink">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-stone-400 hover:text-stone-700" aria-label="Change lead">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative" ref={wrap}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
      <Input value={q} onChange={(e) => (setQ(e.target.value), setOpen(true))} onFocus={() => setOpen(true)} placeholder={label ?? 'Search lead by name or phone…'} className="pl-9" aria-invalid={invalid} />
      {open && (
        <ul className="scroll-thin absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-pop">
          {isFetching && !data && <li className="px-3 py-3 text-[13px] text-stone-500">Searching…</li>}
          {data?.data.length === 0 && <li className="px-3 py-3 text-[13px] text-stone-500">No matching leads</li>}
          {data?.data.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(l);
                  setOpen(false);
                  setQ('');
                }}
                className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-stone-50')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-ink">{l.name}</span>
                  <span className="block truncate text-[12px] text-stone-500">
                    {l.code} · {l.phone} {l.property_project ? `· ${l.property_project} ${l.property_unit}` : ''}
                  </span>
                </span>
                <StatusBadge status={l.status} />
                <Check className="size-4 text-transparent" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
