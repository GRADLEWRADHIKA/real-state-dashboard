import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Download, MessageCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fmtDate, inr } from '@/lib/format';
import { amountInWords, type ReceiptData } from '@estateflow/shared';
import { Button, ButtonAnchor } from '@/components/ui/Button';
import { waHref } from '@/lib/utils';
import { receiptMessage } from '@/lib/whatsapp';
import { StatusBadge } from '@/components/ui/Badge';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import logo from '@/assets/starwiz-logo-512.png';

export function ReceiptView({ id, backLabel = 'Back' }: { id: string; backLabel?: string }) {
  const navigate = useNavigate();
  const {
    data: r,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get<ReceiptData>(`/transactions/${id}`),
  });
  if (isLoading) return <Skeleton className="mx-auto h-[900px] max-w-3xl rounded-2xl" />;
  if (error || !r) return <ErrorState error={error} onRetry={refetch} />;
  const c = r.company;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" icon={<ArrowLeft />} onClick={() => navigate(-1)}>
          {backLabel}
        </Button>
        <div className="flex flex-wrap gap-2">
          {r.status === 'Completed' && r.customer.phone && (
            <ButtonAnchor
              icon={<MessageCircle />}
              className="text-emerald-700"
              href={waHref(
                r.customer.phone,
                receiptMessage({
                  name: r.customer.name,
                  receipt: r.receipt_number ?? r.code,
                  amount: r.amount,
                  words: amountInWords(r.amount),
                  date: r.payment_date,
                  method: r.method,
                  project: r.property_project,
                  unit: r.property_unit,
                  company: c.name,
                }),
              )}
            >
              Send on WhatsApp
            </ButtonAnchor>
          )}
          <Button icon={<Printer />} onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="primary"
            icon={<Download />}
            onClick={() =>
              api
                .download(`/transactions/${r.id}/receipt.pdf`, `${(r.receipt_number ?? r.code).replace(/\//g, '-')}.pdf`)
                .then(() => toast.success('Receipt downloaded'))
                .catch((e) => toast.error(e.message))
            }
          >
            Download PDF
          </Button>
        </div>
      </div>

      <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col gap-5 bg-brand-900 px-6 py-6 text-white sm:flex-row sm:items-start sm:justify-between sm:px-10 sm:py-8 print:bg-brand-900 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
          <div className="flex gap-4">
            <img src={logo} alt="" className="size-16 shrink-0 rounded-xl ring-1 ring-gold-400/30" />
            <div>
              <p className="text-[18px] font-extrabold">{c.name}</p>
              <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-brand-100/80">{c.address}</p>
              <p className="mt-1 text-[12px] text-brand-100/80">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
              {(c.gstin || c.rera) && <p className="mt-1 text-[11.5px] text-brand-200/70">{[c.gstin && `GSTIN ${c.gstin}`, c.rera && `RERA ${c.rera}`].filter(Boolean).join(' · ')}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[12px] font-bold tracking-[0.18em] text-gold-300">PAYMENT RECEIPT</p>
            <p className="mt-2 text-[15px] font-bold">{r.receipt_number ?? '—'}</p>
            <p className="text-[12.5px] text-brand-100/80">
              {fmtDate(r.payment_date, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </header>

        <div className="px-6 py-7 sm:px-10">
          {r.status !== 'Completed' && (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-semibold text-amber-800">
              This payment is {r.status.toLowerCase()} — the receipt becomes valid once the amount is realised.
              <StatusBadge status={r.status} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="label-xs">Received from</p>
              <p className="mt-1.5 text-[16px] font-bold text-ink">{r.customer.name}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-stone-600">{r.customer.address}</p>
              <p className="text-[13px] text-stone-600">
                {r.customer.phone}
                {r.customer.email ? ` · ${r.customer.email}` : ''}
              </p>
            </div>
            <div>
              <p className="label-xs">Property</p>
              <p className="mt-1.5 text-[16px] font-bold text-ink">
                {r.property_project} · {r.property_unit}
              </p>
              <p className="mt-1 text-[13px] text-stone-600">{r.property_name}</p>
              {(r.property_location || r.property_city) && <p className="text-[13px] text-stone-600">{[r.property_location, r.property_city].filter(Boolean).join(', ')}</p>}
              <p className="mt-1 text-[12.5px] text-stone-500">Customer ID {r.customer.code}</p>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-stone-200">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="bg-stone-50 text-[11.5px] font-semibold tracking-[0.05em] text-stone-500 uppercase">
                  <th className="px-4 py-2.5 text-left">Description</th>
                  <th className="hidden px-4 text-left sm:table-cell">Payment method</th>
                  <th className="px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-stone-100 align-top">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-ink">
                      {r.type}
                      {r.installment_label ? ` — ${r.installment_label}` : ''}
                    </p>
                    <p className="mt-0.5 text-[12px] text-stone-500">Transaction ID {r.code}</p>
                    {r.reference && <p className="text-[12px] text-stone-500">Reference {r.reference}</p>}
                    <p className="mt-0.5 text-[12px] text-stone-500 sm:hidden">{r.method}</p>
                  </td>
                  <td className="hidden px-4 py-3.5 text-stone-700 sm:table-cell">{r.method}</td>
                  <td className="num px-4 py-3.5 text-right text-[15px] font-bold text-ink">{inr(r.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_280px]">
            <div className="rounded-xl bg-stone-50 p-4">
              <p className="label-xs">Amount in words</p>
              <p className="mt-1 text-[14px] font-semibold text-ink italic">{amountInWords(r.amount)}</p>
            </div>
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-stone-500">Amount received</dt>
                <dd className="num font-extrabold text-brand-800">{inr(r.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Total property value</dt>
                <dd className="num font-semibold text-ink">{inr(r.customer.total_value)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-stone-500">Paid to date</dt>
                <dd className="num font-semibold text-ink">{inr(r.paid_to_date)}</dd>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2">
                <dt className="font-semibold text-ink">Outstanding balance</dt>
                <dd className="num text-[15px] font-extrabold text-ink">{inr(r.outstanding_after)}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-12 flex flex-col-reverse gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <BadgeCheck className="size-4 text-brand-600" /> Computer-generated receipt, valid subject to realisation of payment.
            </p>
            <div className="text-right">
              <div className="mb-2 ml-auto h-px w-48 bg-stone-300" />
              <p className="text-[12.5px] font-semibold text-ink">For {c.name}</p>
              <p className="text-[12px] text-stone-500">Authorised signatory</p>
            </div>
          </div>
        </div>
        <footer className="flex items-center justify-between border-t border-stone-100 bg-stone-50/70 px-6 py-3 text-[11.5px] text-stone-400 sm:px-10">
          <span>{c.website}</span>
          <span>Generated by EstateFlow CRM</span>
        </footer>
      </article>
    </div>
  );
}

export default function Receipt() {
  const { id } = useParams();
  return <ReceiptView id={id!} />;
}
