import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, CalendarRange, Coins, IndianRupee, LogIn, LogOut, Pencil, Target, Trash2, UsersRound, Wallet } from 'lucide-react';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@estateflow/shared';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDate, inr, inrShort, todayStr } from '@/lib/format';
import { PAYMENT_METHODS, cn } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput, Select } from '@/components/ui/Form';
import { Avatar, PageHeader, Progress, Segmented, Tabs } from '@/components/ui/Misc';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { StatCard } from '@/components/charts/Charts';
import type { AttendanceRecord, Role, SalaryPayment, SalaryRow, TargetRow } from '@/types';

type Tab = 'attendance' | 'salary' | 'targets';
const TAB_ROLES: Record<Tab, Role[]> = {
  attendance: ['admin', 'manager', 'accounts'],
  salary: ['admin', 'accounts'],
  targets: ['admin', 'manager'],
};
const TAB_LABEL: Record<Tab, string> = { attendance: 'Attendance', salary: 'Salary', targets: 'Targets' };

const thisMonth = () => todayStr().slice(0, 7);
const monthName = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const clock = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');

const ATT_STYLE: Record<AttendanceStatus, { short: string; on: string; cell: string }> = {
  Present: { short: 'P', on: 'border-emerald-600 bg-emerald-600 text-white', cell: 'bg-emerald-100 text-emerald-800' },
  'Half day': { short: 'H', on: 'border-amber-500 bg-amber-500 text-white', cell: 'bg-amber-100 text-amber-800' },
  Leave: { short: 'L', on: 'border-sky-600 bg-sky-600 text-white', cell: 'bg-sky-100 text-sky-800' },
  Absent: { short: 'A', on: 'border-red-600 bg-red-600 text-white', cell: 'bg-red-100 text-red-700' },
};

function MonthInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <Input type="month" aria-label="Month" value={value} max={thisMonth()} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-10 w-auto text-[13px] sm:h-9" />;
}

export default function Staff() {
  const me = useUser();
  const [params, setParams] = useSearchParams();
  const allowed = (Object.keys(TAB_ROLES) as Tab[]).filter((t) => TAB_ROLES[t].includes(me.role));
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = asked && allowed.includes(asked) ? asked : allowed[0];
  return (
    <div>
      <PageHeader title="Staff" subtitle="Attendance, salaries and sales targets" crumbs={[{ label: 'Administration' }, { label: 'Staff' }]} />
      {allowed.length > 1 && <Tabs className="mb-5" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} tabs={allowed.map((t) => ({ value: t, label: TAB_LABEL[t] }))} />}
      {tab === 'attendance' && <AttendanceTab />}
      {tab === 'salary' && <SalaryTab />}
      {tab === 'targets' && <TargetsTab />}
    </div>
  );
}

// ─── Attendance ──────────────────────────────────────────────────────────
function AttendanceTab() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'month' ? 'month' : 'day';
  const setView = (v: string) => {
    const n = new URLSearchParams(params);
    if (v === 'month') n.set('view', v);
    else n.delete('view');
    setParams(n, { replace: true });
  };
  return (
    <div>
      <Segmented
        className="mb-4"
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Day', icon: <CalendarDays /> },
          { value: 'month', label: 'Month', icon: <CalendarRange /> },
        ]}
      />
      {view === 'day' ? <AttendanceDay /> : <AttendanceMonth />}
    </div>
  );
}

function AttendanceDay() {
  const [date, setDate] = useState(todayStr());
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'attendance', date],
    queryFn: () => api.get<{ data: AttendanceRecord[] }>('/staff/attendance', { date }),
    placeholderData: keepPreviousData,
  });
  const mark = useAction((v: { user_id: number; status: AttendanceStatus }) => api.post('/staff/attendance', { ...v, date }), { invalidate: [['staff', 'attendance']] });
  const rows = data?.data ?? [];
  const count = (s: AttendanceStatus | null) => rows.filter((r) => r.status === s).length;

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'name',
      header: 'Staff',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold whitespace-nowrap text-ink">{r.name}</p>
            <p className="text-[12px] text-stone-400">{r.title ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'times',
      header: 'Check in / out',
      cell: (r) =>
        r.check_in_at ? (
          <div className="flex flex-col gap-0.5 text-[12.5px] whitespace-nowrap text-stone-600">
            <span className="flex items-center gap-1">
              <LogIn className="size-3.5 text-emerald-600" /> {clock(r.check_in_at)}
            </span>
            {r.check_out_at && (
              <span className="flex items-center gap-1">
                <LogOut className="size-3.5 text-stone-400" /> {clock(r.check_out_at)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-stone-400">—</span>
        ),
    },
    { key: 'status', header: 'Mark', cell: (r) => <StatusButtons record={r} onMark={(status) => mark.mutate({ user_id: r.user_id, status })} busy={mark.isPending} /> },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="date" aria-label="Date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-10 w-auto sm:h-9" />
        {date !== todayStr() && (
          <Button size="sm" variant="ghost" onClick={() => setDate(todayStr())}>
            Today
          </Button>
        )}
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {ATTENDANCE_STATUSES.map((s) => (
            <span key={s} className={cn('rounded-full px-2.5 py-1 text-[12px] font-bold', ATT_STYLE[s].cell)}>
              {s} {count(s)}
            </span>
          ))}
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[12px] font-bold text-stone-600">Not marked {count(null)}</span>
        </div>
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(r) => r.user_id}
            loading={isLoading}
            mobileCard={(r) => (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{r.name}</p>
                    <p className="text-[12px] text-stone-500">
                      {r.title ?? '—'}
                      {r.check_in_at && ` · in ${clock(r.check_in_at)}`}
                      {r.check_out_at && ` · out ${clock(r.check_out_at)}`}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <StatusButtons record={r} onMark={(status) => mark.mutate({ user_id: r.user_id, status })} busy={mark.isPending} />
                </div>
              </div>
            )}
            empty={<EmptyState icon={<UsersRound />} title="No active staff" message="Add team members under Users to track attendance." />}
          />
        )}
      </Card>
      <p className="mt-3 text-[12.5px] text-stone-500">Staff can check in and out from the app; you can correct any day here.</p>
    </div>
  );
}

function StatusButtons({ record, onMark, busy }: { record: AttendanceRecord; onMark: (s: AttendanceStatus) => void; busy?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Attendance for ${record.name}`}>
      {ATTENDANCE_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={record.status === s}
          disabled={busy}
          onClick={() => record.status !== s && onMark(s)}
          className={cn('h-8 rounded-lg border px-2.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors disabled:opacity-60', record.status === s ? ATT_STYLE[s].on : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50')}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

interface MonthRow {
  user_id: number;
  name: string;
  title?: string | null;
  present: number;
  half_day: number;
  leave: number;
  absent: number;
  days: Record<string, AttendanceStatus>;
}

function AttendanceMonth() {
  const [month, setMonth] = useState(thisMonth());
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'attendance', 'month', month],
    queryFn: () => api.get<{ data: MonthRow[] }>('/staff/attendance/month', { month }),
    placeholderData: keepPreviousData,
  });
  const [y, m] = month.split('-').map(Number);
  const days = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const today = todayStr();
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthInput value={month} onChange={setMonth} />
        <div className="flex flex-wrap gap-1.5 text-[12px] sm:ml-auto">
          {ATTENDANCE_STATUSES.map((s) => (
            <span key={s} className="flex items-center gap-1 text-stone-600">
              <span className={cn('flex size-5 items-center justify-center rounded text-[10.5px] font-bold', ATT_STYLE[s].cell)}>{ATT_STYLE[s].short}</span>
              {s}
            </span>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState icon={<UsersRound />} title="No active staff" />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-stone-50/70 text-stone-500">
                  <th className="sticky left-0 z-10 min-w-[160px] bg-stone-50 py-2 pl-4 text-left text-[11.5px] font-semibold tracking-[0.04em] uppercase">Staff</th>
                  {days.map((d) => {
                    const dow = new Date(`${d}T00:00:00`).getDay();
                    return (
                      <th key={d} className={cn('min-w-[24px] px-0.5 py-2 text-center font-semibold', dow === 0 && 'text-red-400', d === today && 'text-brand-800')}>
                        {Number(d.slice(8))}
                      </th>
                    );
                  })}
                  <th className="px-2 text-center font-bold text-emerald-700" title="Present">
                    P
                  </th>
                  <th className="px-2 text-center font-bold text-amber-700" title="Half day">
                    H
                  </th>
                  <th className="px-2 text-center font-bold text-sky-700" title="Leave">
                    L
                  </th>
                  <th className="px-2 pr-4 text-center font-bold text-red-700" title="Absent">
                    A
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.user_id} className="border-t border-stone-100">
                    <td className="sticky left-0 z-10 bg-white py-2 pl-4">
                      <p className="truncate font-semibold text-ink">{r.name}</p>
                      <p className="truncate text-[11px] text-stone-400">{r.title ?? ''}</p>
                    </td>
                    {days.map((d) => {
                      const s = r.days[d];
                      return (
                        <td key={d} className="px-0.5 py-1 text-center">
                          <span title={s ? `${fmtDate(d)}: ${s}` : fmtDate(d)} className={cn('mx-auto flex size-[22px] items-center justify-center rounded text-[10.5px] font-bold', s ? ATT_STYLE[s].cell : d > today ? 'bg-transparent' : 'bg-stone-50 text-stone-300')}>
                            {s ? ATT_STYLE[s].short : ''}
                          </span>
                        </td>
                      );
                    })}
                    <td className="num px-2 text-center font-bold text-ink">{r.present}</td>
                    <td className="num px-2 text-center font-bold text-ink">{r.half_day}</td>
                    <td className="num px-2 text-center font-bold text-ink">{r.leave}</td>
                    <td className="num px-2 pr-4 text-center font-bold text-ink">{r.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Salary & targets: set the monthly amount ────────────────────────────
function SetAmountModal({ target, onClose }: { target: { user_id: number; name: string; field: 'monthly_salary' | 'monthly_target'; value: number } | null; onClose: () => void }) {
  const isSalary = target?.field === 'monthly_salary';
  const [value, setValue] = useState<number | ''>('');
  useEffect(() => {
    if (target) setValue(target.value || '');
  }, [target]);
  const save = useAction((v: number) => api.put(`/staff/${target!.user_id}/pay`, { [target!.field]: v }), {
    success: isSalary ? 'Salary updated' : 'Target updated',
    invalidate: [['staff']],
    onSuccess: onClose,
  });
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      size="sm"
      title={isSalary ? 'Set monthly salary' : 'Set monthly target'}
      description={target?.name}
      onSubmit={() => save.mutate(Number(value || 0))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <Field label={isSalary ? 'Salary per month' : 'Booking value target per month'} hint={isSalary ? 'Applies to every month from now on' : 'Booked deal value they should reach each month'}>
        {(id) => <MoneyInput id={id} autoFocus value={value} onChange={setValue} />}
      </Field>
    </Modal>
  );
}

// ─── Salary ──────────────────────────────────────────────────────────────
function PaySalaryModal({ row, month, onClose }: { row: SalaryRow | null; month: string; onClose: () => void }) {
  const f = useForm(
    { amount: (row?.balance || '') as number | '', paid_on: todayStr(), method: 'Bank Transfer', notes: '' },
    (v) => ({
      amount: !v.amount || Number(v.amount) <= 0 ? 'Enter the amount' : row && row.monthly_salary > 0 && Number(v.amount) > row.balance ? `Only ${inr(row.balance)} is left for this month` : undefined,
      paid_on: required(v.paid_on) ?? (v.paid_on > todayStr() ? 'Cannot be in the future' : undefined),
    }),
  );
  useEffect(() => {
    if (row) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.user_id]);
  const pay = useAction((v: typeof f.values) => api.post('/staff/salary-payments', { ...v, user_id: row!.user_id, month, amount: Number(v.amount), notes: v.notes || null }), {
    success: 'Salary payment recorded',
    invalidate: [['staff', 'salaries']],
    onSuccess: onClose,
  });
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      size="sm"
      title={`Pay ${row?.name ?? ''}`}
      description={row ? `${monthName(month)} · salary ${inr(row.monthly_salary)}, paid ${inr(row.paid)}, left ${inr(row.balance)}` : ''}
      onSubmit={() => f.submit((v) => pay.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy} icon={<IndianRupee />}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" required error={f.errors.amount}>
          {(id) => <MoneyInput id={id} autoFocus value={f.values.amount} onChange={(v) => f.set('amount', v)} aria-invalid={!!f.errors.amount} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid on" required error={f.errors.paid_on}>
            {(id) => <Input id={id} type="date" max={todayStr()} {...f.bind('paid_on')} />}
          </Field>
          <Field label="Method">
            {(id) => (
              <Select id={id} {...f.bind('method')}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Notes">{(id) => <Input id={id} placeholder="e.g. Advance, bonus" {...f.bind('notes')} />}</Field>
      </div>
    </Modal>
  );
}

function SalaryTab() {
  const confirm = useConfirm();
  const [month, setMonth] = useState(thisMonth());
  const [paying, setPaying] = useState<SalaryRow | null>(null);
  const [setting, setSetting] = useState<{ user_id: number; name: string; field: 'monthly_salary'; value: number } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'salaries', month],
    queryFn: () => api.get<{ data: SalaryRow[]; meta: { month: string; totals: { salary: number; paid: number; balance: number } } }>('/staff/salaries', { month }),
    placeholderData: keepPreviousData,
  });
  const remove = useAction((id: number) => api.delete(`/staff/salary-payments/${id}`), { success: 'Payment deleted', invalidate: [['staff', 'salaries']] });
  const askDelete = async (p: SalaryPayment, name: string) => {
    if (await confirm({ title: 'Delete this salary payment?', message: `${inr(p.amount)} paid to ${name} on ${fmtDate(p.paid_on)} will be removed.`, confirmLabel: 'Delete' })) remove.mutate(p.id);
  };
  const totals = data?.meta.totals;

  const columns: Column<SalaryRow>[] = [
    {
      key: 'name',
      header: 'Staff',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold whitespace-nowrap text-ink">{r.name}</p>
            <p className="text-[12px] text-stone-400">{r.title ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'salary',
      header: 'Salary',
      align: 'right',
      cell: (r) => (
        <button type="button" onClick={() => setSetting({ user_id: r.user_id, name: r.name, field: 'monthly_salary', value: r.monthly_salary })} className="group inline-flex items-center gap-1.5 whitespace-nowrap" title="Set salary">
          <span className={cn('num font-semibold', r.monthly_salary ? 'text-ink' : 'text-stone-400')}>{r.monthly_salary ? inr(r.monthly_salary) : 'Not set'}</span>
          <Pencil className="size-3.5 text-stone-300 group-hover:text-brand-700" />
        </button>
      ),
    },
    { key: 'paid', header: 'Paid', align: 'right', cell: (r) => <span className="num whitespace-nowrap text-emerald-700">{inr(r.paid)}</span> },
    { key: 'left', header: 'Left', align: 'right', cell: (r) => <span className={cn('num font-bold whitespace-nowrap', r.balance > 0 ? 'text-amber-700' : 'text-stone-400')}>{inr(r.balance)}</span> },
    { key: 'payments', header: 'Payments', cell: (r) => <PaymentChips payments={r.payments} onDelete={(p) => askDelete(p, r.name)} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button size="sm" variant={r.balance > 0 ? 'subtle' : 'ghost'} icon={<IndianRupee />} onClick={() => setPaying(r)} disabled={r.monthly_salary > 0 && r.balance <= 0}>
          Pay
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthInput value={month} onChange={setMonth} />
        <p className="text-[13px] text-stone-500">Kitni hai, kitni di, kitni baki — salary, paid and left for {monthName(month)}.</p>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="Salary" value={totals ? inrShort(totals.salary) : '—'} icon={<Wallet />} caption="Total for the month" />
        <StatCard label="Paid" value={totals ? inrShort(totals.paid) : '—'} icon={<Coins />} caption="Given so far" />
        <StatCard label="Left" value={totals ? inrShort(totals.balance) : '—'} icon={<IndianRupee />} accent="gold" caption="Still to pay" />
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(r) => r.user_id}
            loading={isLoading}
            mobileCard={(r) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{r.name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      Salary {inrShort(r.monthly_salary)} · paid {inrShort(r.paid)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-[14.5px] font-extrabold text-amber-700">{inrShort(r.balance)}</p>
                    <p className="text-[11.5px] text-stone-400">left</p>
                  </div>
                </div>
                <div className="mt-2">
                  <PaymentChips payments={r.payments} onDelete={(p) => askDelete(p, r.name)} />
                </div>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" icon={<Pencil />} onClick={() => setSetting({ user_id: r.user_id, name: r.name, field: 'monthly_salary', value: r.monthly_salary })}>
                    Set salary
                  </Button>
                  <Button size="sm" variant="subtle" icon={<IndianRupee />} onClick={() => setPaying(r)} disabled={r.monthly_salary > 0 && r.balance <= 0}>
                    Pay
                  </Button>
                </div>
              </div>
            )}
            empty={<EmptyState icon={<Wallet />} title="No active staff" />}
          />
        )}
      </Card>
      <PaySalaryModal row={paying} month={month} onClose={() => setPaying(null)} />
      <SetAmountModal target={setting} onClose={() => setSetting(null)} />
    </div>
  );
}

function PaymentChips({ payments, onDelete }: { payments: SalaryPayment[]; onDelete: (p: SalaryPayment) => void }) {
  if (!payments.length) return <span className="text-[12.5px] text-stone-400">None yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {payments.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 py-0.5 pr-1 pl-2.5 text-[12px] whitespace-nowrap text-stone-700" title={p.notes ?? undefined}>
          <b className="num">{inr(p.amount)}</b>
          <span className="text-stone-400">
            {fmtDate(p.paid_on)} · {p.method}
          </span>
          <button type="button" onClick={() => onDelete(p)} aria-label={`Delete payment of ${inr(p.amount)}`} className="rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Targets ─────────────────────────────────────────────────────────────
function TargetsTab() {
  const [month, setMonth] = useState(thisMonth());
  const [setting, setSetting] = useState<{ user_id: number; name: string; field: 'monthly_target'; value: number } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['staff', 'targets', month],
    queryFn: () => api.get<{ data: TargetRow[] }>('/staff/targets', { month }),
    placeholderData: keepPreviousData,
  });
  const pctOf = (r: TargetRow) => (r.monthly_target > 0 ? (r.achieved / r.monthly_target) * 100 : 0);
  const edit = (r: TargetRow) => setSetting({ user_id: r.user_id, name: r.name, field: 'monthly_target', value: r.monthly_target });

  const columns: Column<TargetRow>[] = [
    {
      key: 'name',
      header: 'Staff',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.name} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold whitespace-nowrap text-ink">{r.name}</p>
            <p className="text-[12px] text-stone-400">{r.title ?? '—'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Booked vs target',
      className: 'min-w-[220px]',
      cell: (r) => <TargetBar r={r} pct={pctOf(r)} />,
    },
    { key: 'bookings', header: 'Bookings', align: 'right', cell: (r) => <span className="num">{r.bookings}</span> },
    { key: 'collected', header: 'Collected', align: 'right', cell: (r) => <span className="num whitespace-nowrap text-stone-600">{inr(r.collected)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) => (
        <Button size="sm" variant="ghost" icon={<Target />} onClick={() => edit(r)}>
          Set target
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <MonthInput value={month} onChange={setMonth} />
        <p className="text-[13px] text-stone-500">Booked deal value in {monthName(month)} against each person’s monthly target.</p>
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data?.data ?? []}
            columns={columns}
            rowKey={(r) => r.user_id}
            loading={isLoading}
            mobileCard={(r) => (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="truncate text-[14px] font-bold text-ink">{r.name}</p>
                  <Button size="sm" variant="ghost" icon={<Target />} onClick={() => edit(r)}>
                    Set target
                  </Button>
                </div>
                <TargetBar r={r} pct={pctOf(r)} />
                <p className="mt-1.5 text-[12px] text-stone-500">
                  {r.bookings} bookings · {inrShort(r.collected)} collected
                </p>
              </div>
            )}
            empty={<EmptyState icon={<CalendarCheck />} title="No sales staff" message="Targets apply to sales people and sales managers." />}
          />
        )}
      </Card>
      <SetAmountModal target={setting} onClose={() => setSetting(null)} />
    </div>
  );
}

function TargetBar({ r, pct }: { r: TargetRow; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="num font-bold text-ink">{inrShort(r.achieved)}</span>
        <span className="text-stone-500">{r.monthly_target ? `of ${inrShort(r.monthly_target)} · ${Math.round(pct)}%` : 'No target set'}</span>
      </div>
      <Progress value={pct} tone={pct >= 100 ? 'brand' : 'gold'} size="sm" />
    </div>
  );
}
