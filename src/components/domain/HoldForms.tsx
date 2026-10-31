import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Hourglass, Unlock, X } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate, fmtDateShort } from '@/lib/format';
import { useAction, useDebounce } from '@/hooks/queries';
import { useUser } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Field, Input, SearchInput, Textarea } from '@/components/ui/Form';
import { Modal, useConfirm } from '@/components/ui/Modal';
import type { Lead, Paged, Property } from '@/types';

/** Whole days left on a hold (0 on its last day). */
export const holdDaysLeft = (until: string) => Math.max(0, Math.ceil((Date.parse(until) - Date.now()) / 86_400_000));

/** "Hold · ends 3 Nov" for lists, grids and map tooltips; null when the unit is not on hold. */
export const holdLabel = (p: Pick<Property, 'status' | 'hold_until'>) => (p.status === 'Reserved' && p.hold_until ? `Hold · ends ${fmtDateShort(p.hold_until)}` : null);

export function HoldModal({ open, onClose, property }: { open: boolean; onClose: () => void; property: Property }) {
  const [days, setDays] = useState('3');
  const [note, setNote] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [lead, setLead] = useState<Pick<Lead, 'id' | 'name' | 'code'> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setDays('3');
      setNote('');
      setQ('');
      setLead(null);
      setError('');
    }
  }, [open]);
  const leads = useQuery({
    queryKey: ['leads', 'hold-search', dq],
    queryFn: () => api.get<Paged<Lead>>('/leads', { q: dq, limit: 8 }).then((r) => r.data),
    enabled: open && !lead,
  });
  const hold = useAction((v: { days: number; lead_id: number | null; note: string | null }) => api.post(`/properties/${property.id}/hold`, v), {
    success: (r: any) => `${property.unit_number} on hold until ${fmtDate(r.hold_until)}`,
    onSuccess: onClose,
  });
  const submit = () => {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 15) return setError('Choose 1 to 15 days');
    hold.mutate({ days: n, lead_id: lead?.id ?? null, note: note.trim() || null });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Hold for buyer"
      description={`${property.project} · Unit ${property.unit_number}. The unit shows as Reserved and returns to Available when the hold ends.`}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={<Hourglass />} loading={hold.isPending}>
            Place hold
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Hold for (days)" required error={error} hint="Up to 15 days">
          {(id, invalid) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={15}
              value={days}
              aria-invalid={invalid}
              onChange={(e) => {
                setDays(e.target.value);
                setError('');
              }}
              className="w-32"
            />
          )}
        </Field>
        <Field label="For lead" hint="Optional. Search your leads by name or phone.">
          {() =>
            lead ? (
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-brand-200 bg-brand-50/60 px-3 py-2">
                <span className="text-[13.5px] font-semibold text-brand-900">
                  {lead.name} <span className="font-normal text-stone-500">· {lead.code}</span>
                </span>
                <Button size="icon-sm" variant="ghost" aria-label="Clear lead" icon={<X />} onClick={() => setLead(null)} />
              </div>
            ) : (
              <div>
                <SearchInput value={q} onChange={setQ} placeholder="Search leads…" />
                <ul className="scroll-thin mt-1.5 max-h-44 overflow-y-auto rounded-[10px] border border-stone-100">
                  {(leads.data ?? []).map((l) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => setLead(l)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-stone-50">
                        <span className="min-w-0 truncate font-semibold text-ink">{l.name}</span>
                        <span className="shrink-0 text-[12px] text-stone-500">
                          {l.code} · {l.status}
                        </span>
                      </button>
                    </li>
                  ))}
                  {leads.data && !leads.data.length && <li className="px-3 py-2 text-[13px] text-stone-500">No leads found</li>}
                </ul>
              </div>
            )
          }
        </Field>
        <Field label="Note">{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Token cheque expected Monday" />}</Field>
      </div>
    </Modal>
  );
}

/** Banner on a Reserved unit: who holds it, for whom and until when, with Release. */
export function HoldBanner({ property }: { property: Property }) {
  const user = useUser();
  const confirm = useConfirm();
  const release = useAction(() => api.post(`/properties/${property.id}/release`, {}), { success: 'Hold released. The unit is available again.' });
  if (property.status !== 'Reserved' || !property.hold_until) return null;
  const left = holdDaysLeft(property.hold_until);
  const canRelease = user.role === 'admin' || user.role === 'manager' || (user.role === 'sales' && property.hold_by === user.id);
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4" data-testid="hold-banner">
      <p className="flex items-start gap-2 text-[13.5px] font-semibold text-amber-900">
        <Hourglass className="mt-0.5 size-4 shrink-0" />
        <span>
          On hold for{' '}
          {property.hold_lead_id ? (
            <Link to={`/leads/${property.hold_lead_id}`} className="underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
              {property.hold_lead_name ?? 'a lead'}
            </Link>
          ) : (
            'a buyer'
          )}{' '}
          until {fmtDate(property.hold_until)} ({left} day{left === 1 ? '' : 's'} left){property.hold_by_name ? ` by ${property.hold_by_name}` : ''}
        </span>
      </p>
      {property.hold_note && <p className="mt-1.5 pl-6 text-[12.5px] text-amber-900/80">“{property.hold_note}”</p>}
      {canRelease && (
        <Button
          size="sm"
          className="mt-3 ml-6"
          icon={<Unlock />}
          loading={release.isPending}
          onClick={async () => {
            if (await confirm({ title: 'Release this hold?', message: `${property.project} ${property.unit_number} becomes available to everyone.`, confirmLabel: 'Release', tone: 'primary' })) release.mutate(undefined);
          }}
        >
          Release
        </Button>
      )}
    </div>
  );
}

