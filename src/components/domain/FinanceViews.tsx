import { CalendarClock, IndianRupee } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { fmtDate, inr, inrShort, relativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Misc';
import type { Financials, Installment } from '@/types';

/** Customer money position: value, booking, paid, outstanding, next due — with progress + donut. */
export function FinancialSummary({ fin, compact }: { fin: Financials; compact?: boolean }) {
  const next = fin.next_installment;
  const data = [
    { name: 'Paid', value: fin.paid, color: '#0f5132' },
    {
      name: 'Outstanding',
      value: Math.max(0, fin.outstanding),
      color: '#e7e3da',
    },
  ];
  const tiles = [
    { label: 'Property value', value: inr(fin.total_value) },
    { label: 'Booking amount', value: inr(fin.booking_amount) },
    { label: 'Total paid', value: inr(fin.paid), tone: 'text-brand-800' },
    {
      label: 'Outstanding',
      value: inr(fin.outstanding),
      tone: fin.outstanding > 0 ? 'text-ink' : 'text-brand-800',
    },
  ];
  return (
    <div className={cn('grid gap-5', !compact && 'lg:grid-cols-[1fr_220px]')}>
      <div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label}>
              <p className="text-[12px] font-semibold text-stone-500">{t.label}</p>
              <p className={cn('num mt-1 text-[17px] font-extrabold tracking-tight sm:text-[19px]', t.tone ?? 'text-ink')}>{t.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span className="font-semibold text-stone-600">Payment progress</span>
            <span className="num font-bold text-ink">{fin.progress}% paid</span>
          </div>
          <Progress value={fin.progress} size="lg" />
          <p className="mt-2 text-[12px] text-stone-500">
            {fin.paid_installments} of {fin.installments} installments fully paid
            {fin.overdue > 0 && (
              <>
                {' · '}
                <b className="font-bold text-red-600">{inr(fin.overdue)} overdue</b>
              </>
            )}
          </p>
        </div>
        {next ? (
          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-gold-200/80 bg-gold-50/70 px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-white text-gold-600 shadow-card">
              <CalendarClock className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-gold-700">Next installment · {next.label}</p>
              <p className="num text-[18px] font-extrabold text-ink">{inr(next.balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold text-stone-500">Due date</p>
              <p className="text-[14px] font-bold text-ink">{fmtDate(next.due_date)}</p>
              <p className={cn('text-[12px] font-semibold', next.due_date < new Date().toISOString().slice(0, 10) ? 'text-red-600' : 'text-stone-500')}>{relativeDay(next.due_date)}</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-[13.5px] font-semibold text-brand-800">All installments are fully paid.</div>
        )}
      </div>
      {!compact && (
        <div className="flex flex-col items-center justify-center">
          <div className="relative size-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="#fff" strokeWidth={2}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[24px] font-extrabold tracking-tight text-ink">{Math.round(fin.progress)}%</span>
              <span className="text-[11.5px] font-medium text-stone-500">paid</span>
            </div>
          </div>
          <div className="mt-3 flex gap-4 text-[12px]">
            <span className="flex items-center gap-1.5 font-semibold text-stone-600">
              <span className="size-2.5 rounded-[3px] bg-brand-800" /> Paid {inrShort(fin.paid)}
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-stone-600">
              <span className="size-2.5 rounded-[3px] bg-[#e7e3da]" /> Due {inrShort(fin.outstanding)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function InstallmentTable({ rows, onPay, showCustomer }: { rows: Installment[]; onPay?: (i: Installment) => void; showCustomer?: boolean }) {
  return (
    <>
      <ul className="divide-y divide-stone-100 md:hidden">
        {rows.map((i) => (
          <li key={i.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-ink">
                  #{i.number} {i.label}
                </p>
                <p className="text-[12.5px] text-stone-500">
                  {showCustomer ? `${i.customer_name} · ` : ''}Due {fmtDate(i.due_date)}
                </p>
              </div>
              <StatusBadge status={i.status} />
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="text-[12.5px] text-stone-500">
                <span className="num font-bold text-ink">{inr(i.amount)}</span>
                {i.paid_amount > 0 && i.paid_amount < i.amount && <span> · paid {inr(i.paid_amount)}</span>}
              </div>
              {onPay && i.balance > 0 && (
                <Button size="sm" variant="subtle" icon={<IndianRupee />} onClick={() => onPay(i)}>
                  Record
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="scroll-thin hidden overflow-x-auto md:block">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="border-y border-stone-100 bg-stone-50/70 text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">
              <th className="py-2.5 pl-5 text-left">#</th>
              <th className="px-3 text-left">Installment</th>
              {showCustomer && <th className="px-3 text-left">Customer</th>}
              <th className="px-3 text-left">Due date</th>
              <th className="px-3 text-right">Amount</th>
              <th className="px-3 text-right">Paid</th>
              <th className="px-3 text-right">Balance</th>
              <th className="px-3 text-left">Status</th>
              <th className="hidden px-3 text-left 2xl:table-cell">Paid on</th>
              {onPay && <th className="pr-5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={cn('border-b border-stone-100 last:border-0', i.status === 'Overdue' && 'bg-red-50/30')}>
                <td className="num py-3 pl-5 text-stone-400">{i.number}</td>
                <td className="px-3 font-semibold whitespace-nowrap text-ink">{i.label}</td>
                {showCustomer && (
                  <td className="px-3">
                    <p className="font-semibold text-ink">{i.customer_name}</p>
                    <p className="text-[12px] text-stone-500">
                      {i.property_project} · {i.property_unit}
                    </p>
                  </td>
                )}
                <td className="px-3 whitespace-nowrap text-stone-600">{fmtDate(i.due_date)}</td>
                <td className="num px-3 text-right font-semibold text-ink">{inr(i.amount)}</td>
                <td className="num px-3 text-right text-brand-800">{i.paid_amount ? inr(i.paid_amount) : '—'}</td>
                <td className={cn('num px-3 text-right font-semibold', i.balance > 0 ? 'text-ink' : 'text-stone-400')}>{i.balance > 0 ? inr(i.balance) : '—'}</td>
                <td className="px-3">
                  <StatusBadge status={i.status} />
                </td>
                <td className="hidden px-3 whitespace-nowrap text-stone-500 2xl:table-cell">{fmtDate(i.payment_date)}</td>
                {onPay && (
                  <td className="py-2 pr-5 text-right">
                    {i.balance > 0 && (
                      <Button size="sm" variant={i.status === 'Overdue' ? 'primary' : 'secondary'} icon={<IndianRupee />} onClick={() => onPay(i)}>
                        Record
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
