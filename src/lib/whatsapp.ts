import { daysBetween } from '@estateflow/shared';
import { useSettings } from '@/hooks/queries';
import { BRAND } from '@/components/layout/Brand';
import { fmtDate, inr, todayStr } from '@/lib/format';

/**
 * Click-to-chat WhatsApp messages (wa.me links opened in a new tab; nothing is sent from the server).
 * Wording is Hindi-English, the way the sales and accounts team writes to customers.
 */

/** Company name for message sign-offs: from Settings, falling back to the built-in brand. */
export function useCompanyName() {
  return useSettings().data?.company?.name || BRAND.company;
}

const plot = (project?: string | null, unit?: string | null) => [project, unit].filter(Boolean).join(' ');

export const daysLeft = (date?: string | null) => (date ? daysBetween(todayStr(), date) : null);

export function installmentReminder(o: { name: string; label: string; balance: number; due_date: string; company: string }) {
  return `Namaste ${o.name}, aapki kist ${o.label} ${inr(o.balance)} (${fmtDate(o.due_date)}) pending hai. Kripya jald bhugtan karein. – ${o.company}`;
}

export function receiptMessage(o: { name: string; receipt?: string | null; amount: number; words?: string; date: string; method: string; project?: string | null; unit?: string | null; company: string }) {
  const where = plot(o.project, o.unit);
  return [
    `Namaste ${o.name}, aapka bhugtan prapt hua. Dhanyavaad!`,
    o.receipt ? `Receipt no.: ${o.receipt}` : null,
    `Amount: ${inr(o.amount)}${o.words ? ` (${o.words})` : ''}`,
    `Date: ${fmtDate(o.date)}`,
    `Method: ${o.method}`,
    where ? `Plot: ${where}` : null,
    `– ${o.company}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function registryReminder(o: { name: string; date: string; project?: string | null; unit?: string | null; company: string }) {
  const left = daysLeft(o.date);
  const when = left === null ? '' : left === 0 ? ' (aaj)' : left === 1 ? ' (kal)' : left > 0 ? ` (${left} din baaki)` : '';
  const where = plot(o.project, o.unit);
  return `Namaste ${o.name}, aapke plot${where ? ` ${where}` : ''} ki registry ${fmtDate(o.date)}${when} ko fixed hai. Kripya zaroori documents ke saath samay par pahunchein. – ${o.company}`;
}
