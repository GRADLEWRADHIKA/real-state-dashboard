import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, DatabaseBackup, Download, KeyRound, ShieldAlert, Shuffle, Target, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { api, serverUrl } from '@/lib/api';
import { fileSize, fmtDateTime } from '@/lib/format';
import { LEAD_SOURCES, cn } from '@/lib/utils';
import { useAction, useDirectory } from '@/hooks/queries';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, MoneyInput, Select } from '@/components/ui/Form';
import { useConfirm } from '@/components/ui/Modal';
import type { Settings } from '@/types';

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-4 py-3.5', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
      <span>
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {hint && <span className="block text-[12.5px] text-stone-500">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-brand-700' : 'bg-stone-300')}>
        <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </label>
  );
}

function CopyBox({ value, testId, mono = true }: { value: string; testId?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
      <pre data-testid={testId} className={cn('min-w-0 flex-1 overflow-x-auto text-[12.5px] whitespace-pre-wrap break-all text-ink select-all', mono && 'font-mono')}>
        {value}
      </pre>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Copy"
        icon={copied ? <Check /> : <Copy />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            toast.error('Copy failed. Select the text and copy it manually.');
          }
        }}
      />
    </div>
  );
}

/** Sign-in lockout and password policy (administrators). */
export function SecurityPolicyCard({ security }: { security: Settings['security'] }) {
  const [v, setV] = useState(security);
  useEffect(() => setV(security), [security]);
  const save = useAction(() => api.put('/settings/security', v), {
    success: 'Security policy saved',
    invalidate: [['settings']],
  });
  const num = (k: keyof Settings['security']) => ({
    value: String(v[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setV((s) => ({
        ...s,
        [k]: e.target.value === '' ? '' : Number(e.target.value),
      })),
  });
  return (
    <Card>
      <CardHeader title="Sign-in policy" subtitle="Applies to the dashboard and the mobile app" icon={<ShieldAlert />} />
      <form
        className="grid max-w-2xl grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label="Failed attempts before lockout" hint="Between 3 and 20">
          {(id) => <Input id={id} type="number" min={3} max={20} {...num('max_failed_logins')} />}
        </Field>
        <Field label="Lockout duration (minutes)" hint="Doubles with each further failure, up to a day">
          {(id) => <Input id={id} type="number" min={1} max={1440} {...num('lockout_minutes')} />}
        </Field>
        <Field label="Minimum password length">{(id) => <Input id={id} type="number" min={8} max={64} {...num('password_min_length')} />}</Field>
        <Field label="Sign-in length without “keep me signed in” (hours)">{(id) => <Input id={id} type="number" min={1} max={720} {...num('session_hours')} />}</Field>
        <div className="sm:col-span-2">
          <Toggle label="Require strong passwords" hint="An uppercase letter, a lowercase letter and a number" checked={v.enforce_strong_passwords} onChange={(c) => setV((s) => ({ ...s, enforce_strong_passwords: c }))} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save policy
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Website lead capture: API key (shown once), default source, and the endpoint to call. */
export function LeadCapturePanel({ capture }: { capture: Settings['lead_capture'] }) {
  const confirm = useConfirm();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [source, setSource] = useState(capture.default_source);
  useEffect(() => setSource(capture.default_source), [capture.default_source]);
  const generate = useAction(() => api.post<{ key: string }>('/settings/lead_capture/key'), { invalidate: [['settings']], onSuccess: (r) => setNewKey(r.key) });
  const revoke = useAction(() => api.delete('/settings/lead_capture/key'), {
    success: 'Key revoked. Website forms can no longer post leads.',
    invalidate: [['settings']],
    onSuccess: () => setNewKey(null),
  });
  const save = useAction((enabled: boolean) => api.put('/settings/lead_capture', { enabled, default_source: source }), { success: 'Lead capture saved', invalidate: [['settings']] });
  const hasKey = !!capture.key_prefix;
  const endpoint = `${serverUrl() || window.location.origin}/api/public/leads`;
  const sample = `curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${newKey ?? `${capture.key_prefix || 'efk_'}…`}" \\
  -d '{"name":"Ravi Kumar","phone":"9876543210","email":"ravi@example.com","message":"Looking for a 2 BHK","campaign":"Contact form"}'`;

  return (
    <Card>
      <CardHeader title="Website lead capture" subtitle="Post enquiries from your website straight into EstateFlow" icon={<Webhook />} />
      <div className="space-y-5 px-5 pb-5">
        <div className="rounded-xl border border-stone-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-bold text-ink">API key</p>
              <p className="text-[12.5px] text-stone-500">
                {hasKey ? (
                  <>
                    <span className="font-mono">{capture.key_prefix}…</span> · created {fmtDateTime(capture.key_created_at)}
                  </>
                ) : (
                  'No key yet. Generate one to accept website leads.'
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {hasKey && (
                <Button
                  variant="ghost"
                  disabled={revoke.isPending}
                  onClick={async () =>
                    (await confirm({
                      title: 'Revoke the API key?',
                      message: 'Website forms using it stop working immediately.',
                      confirmLabel: 'Revoke',
                    })) && revoke.mutate(undefined)
                  }
                >
                  Revoke
                </Button>
              )}
              <Button
                variant="primary"
                icon={<KeyRound />}
                loading={generate.isPending}
                onClick={async () =>
                  (!hasKey ||
                    (await confirm({
                      title: 'Replace the API key?',
                      message: 'The current key stops working as soon as the new one is created.',
                      confirmLabel: 'Generate new key',
                    }))) &&
                  generate.mutate(undefined)
                }
              >
                {hasKey ? 'Generate new key' : 'Generate key'}
              </Button>
            </div>
          </div>
          {newKey && (
            <div className="mt-4 space-y-2">
              <CopyBox value={newKey} testId="lead-capture-key" />
              <p className="flex items-start gap-2 text-[12.5px] text-amber-800">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Copy this key now. It is shown only once; EstateFlow stores just a fingerprint of it.
              </p>
            </div>
          )}
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Source for website leads" hint="Used when the form does not send a source">
            {(id) => (
              <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Toggle label="Accept website leads" hint={hasKey ? 'When off, the endpoint refuses every request' : 'Generate a key first'} checked={capture.enabled} disabled={!hasKey || save.isPending} onChange={(c) => save.mutate(c)} />
        {source !== capture.default_source && (
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(capture.enabled)}>
            Save source
          </Button>
        )}

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">How your website sends a lead</p>
          <CopyBox value={sample} />
          <p className="mt-2 text-[12.5px] text-stone-500">
            Required: <b>name</b> and <b>phone</b>. Optional: email, message, location, budget, property_type, source and campaign. A phone number already in EstateFlow adds the enquiry to that lead instead of creating a duplicate. New leads are assigned using the rules below.
          </p>
        </div>
      </div>
    </Card>
  );
}

/** Round-robin assignment of new website and imported leads. */
export function AssignmentPanel({ assignment }: { assignment: Settings['assignment'] }) {
  const directory = useDirectory();
  const sales = (directory.data ?? []).filter((u) => u.role === 'sales');
  const [v, setV] = useState(assignment);
  useEffect(() => setV(assignment), [assignment]);
  const save = useAction(
    () =>
      api.put('/settings/assignment', {
        mode: v.mode,
        pool: v.pool,
        apply_to_imports: v.apply_to_imports,
      }),
    { success: 'Assignment rules saved', invalidate: [['settings']] },
  );
  const inPool = (id: number) => v.pool.length === 0 || v.pool.includes(id);
  const togglePool = (id: number) =>
    setV((s) => {
      const base = s.pool.length ? s.pool : sales.map((u) => u.id);
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      if (!next.length) {
        toast.error('Keep at least one executive in the rotation, or turn round-robin off.');
        return s;
      }
      return { ...s, pool: next.length === sales.length ? [] : next };
    });
  return (
    <Card>
      <CardHeader title="Lead assignment" subtitle="Who receives new leads that arrive without an owner" icon={<Shuffle />} />
      <div className="space-y-4 px-5 pb-5">
        <Toggle label="Round-robin assignment" hint="Share new website leads evenly across the selected executives" checked={v.mode === 'round_robin'} onChange={(c) => setV((s) => ({ ...s, mode: c ? 'round_robin' : 'none' }))} />
        {v.mode === 'round_robin' && (
          <>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink">Executives in the rotation</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {sales.map((u) => (
                  <Checkbox key={u.id} label={u.name} checked={inPool(u.id)} onChange={() => togglePool(u.id)} />
                ))}
              </div>
              {!sales.length && <p className="text-[12.5px] text-stone-500">There are no active sales executives yet.</p>}
              <p className="mt-2 text-[12px] text-stone-400">Leaving everyone selected includes executives added later.</p>
            </div>
            <Toggle label="Also assign imported leads" hint="Rows in a CSV import without an owner join the rotation" checked={v.apply_to_imports} onChange={(c) => setV((s) => ({ ...s, apply_to_imports: c }))} />
          </>
        )}
        <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
          Save rules
        </Button>
      </div>
    </Card>
  );
}

/** Monthly targets drawn on the dashboard's collections and bookings chart. */
export function TargetsCard({ targets }: { targets: Settings['targets'] }) {
  const [v, setV] = useState(targets);
  useEffect(() => setV(targets), [targets]);
  const save = useAction(() => api.put('/settings/targets', v), { success: 'Targets saved', invalidate: [['settings'], ['dashboard']] });
  return (
    <Card>
      <CardHeader title="Monthly targets" subtitle="Shown as a line on the dashboard chart. Leave at 0 for no target." icon={<Target />} />
      <form
        className="grid max-w-2xl grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field label="Collections per month">{(id) => <MoneyInput id={id} value={v.monthly_collections} onChange={(x) => setV((s) => ({ ...s, monthly_collections: Number(x) || 0 }))} />}</Field>
        <Field label="Bookings value per month">{(id) => <MoneyInput id={id} value={v.monthly_bookings} onChange={(x) => setV((s) => ({ ...s, monthly_bookings: Number(x) || 0 }))} />}</Field>
        <div className="sm:col-span-2">
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save targets
          </Button>
        </div>
      </form>
    </Card>
  );
}

interface BackupFile {
  name: string;
  size: number;
  created_at: string;
}

/** Admin only: the automatic daily database backups, a manual backup and downloads. */
export function BackupsPanel() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api.get<{ data: BackupFile[]; meta: { folder: string; uploads_folder?: string } }>('/backups'),
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const backup = useAction(() => api.post<BackupFile>('/backups'), { success: (b) => `Backup saved: ${b.name}`, invalidate: [['backups']] });
  const download = async (name: string) => {
    setDownloading(name);
    try {
      await api.download(`/backups/${encodeURIComponent(name)}`, name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(null);
    }
  };
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Backups"
        subtitle="A copy of the database is saved automatically every day. The last 14 daily copies and the last 10 manual ones are kept."
        icon={<DatabaseBackup />}
        action={
          <Button variant="primary" size="sm" icon={<DatabaseBackup />} loading={backup.isPending} onClick={() => backup.mutate(undefined)}>
            Back up now
          </Button>
        }
      />
      <p className="mx-5 mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Uploaded files are copied into the uploads folder below with every backup. Backups stay on the server’s own disk, so copy this folder somewhere else from time to time.
      </p>
      {error ? (
        <div className="px-5 pb-5 text-[13px] text-red-600">
          {error instanceof Error ? error.message : 'Couldn’t load backups'}{' '}
          <button className="font-semibold underline" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <p className="px-5 pb-5 text-[13px] text-stone-500">Loading backups…</p>
      ) : !data?.data.length ? (
        <p className="border-t border-stone-100 px-5 py-4 text-[13px] text-stone-500">No backups yet. The first one is written automatically today, or take one now.</p>
      ) : (
        <ul className="divide-y divide-stone-100 border-t border-stone-100">
          {data.data.map((b) => (
            <li key={b.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-[13px] font-semibold text-ink">{b.name}</p>
                <p className="text-[12px] text-stone-500">
                  {fmtDateTime(b.created_at)} · {fileSize(b.size)}
                </p>
              </div>
              <Button size="sm" icon={<Download />} loading={downloading === b.name} onClick={() => download(b.name)}>
                Download
              </Button>
            </li>
          ))}
        </ul>
      )}
      {data?.meta.folder && (
        <p className="border-t border-stone-100 px-5 py-3 text-[12px] break-all text-stone-400">
          Saved on the server in {data.meta.folder}
          {data.meta.uploads_folder && <> · uploads in {data.meta.uploads_folder}</>}
        </p>
      )}
    </Card>
  );
}
