import type { ReactNode } from 'react';
import { Flame, Snowflake, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Tone = 'gray' | 'blue' | 'indigo' | 'violet' | 'amber' | 'orange' | 'green' | 'brand' | 'red' | 'gold';

const tones: Record<Tone, { pill: string; dot: string }> = {
  gray: {
    pill: 'bg-stone-100 text-stone-700 ring-stone-200',
    dot: 'bg-stone-400',
  },
  blue: { pill: 'bg-sky-50 text-sky-800 ring-sky-200/80', dot: 'bg-sky-500' },
  indigo: {
    pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
    dot: 'bg-indigo-500',
  },
  violet: {
    pill: 'bg-violet-50 text-violet-700 ring-violet-200/80',
    dot: 'bg-violet-500',
  },
  amber: {
    pill: 'bg-amber-50 text-amber-800 ring-amber-200/90',
    dot: 'bg-amber-500',
  },
  orange: {
    pill: 'bg-orange-50 text-orange-800 ring-orange-200/80',
    dot: 'bg-orange-500',
  },
  green: {
    pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  brand: {
    pill: 'bg-brand-50 text-brand-800 ring-brand-200',
    dot: 'bg-brand-700',
  },
  red: { pill: 'bg-red-50 text-red-700 ring-red-200/80', dot: 'bg-red-500' },
  gold: { pill: 'bg-gold-50 text-gold-700 ring-gold-200', dot: 'bg-gold-500' },
};

export function Badge({ tone = 'gray', dot = true, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] leading-5 font-semibold whitespace-nowrap ring-1 ring-inset', t.pill, className)}>
      {dot && <span className={cn('size-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  // leads
  New: 'blue',
  Contacted: 'indigo',
  Qualified: 'violet',
  'Site Visit': 'amber',
  Negotiation: 'orange',
  Booked: 'green',
  Closed: 'brand',
  Lost: 'red',
  // properties
  Available: 'green',
  Reserved: 'amber',
  Sold: 'gray',
  // installments & payments
  Paid: 'green',
  Pending: 'amber',
  'Partially Paid': 'orange',
  Overdue: 'red',
  Completed: 'green',
  Failed: 'red',
  // visits / follow-ups / tasks
  Scheduled: 'blue',
  Cancelled: 'gray',
  Rescheduled: 'amber',
  Missed: 'red',
  Todo: 'gray',
  'In Progress': 'blue',
  // customers / users / deals
  Active: 'green',
  Inactive: 'gray',
  Open: 'blue',
  Won: 'brand',
  'Agreement Signed': 'indigo',
  Registration: 'violet',
  Possession: 'brand',
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null;
  return (
    <Badge tone={STATUS_TONE[status] ?? 'gray'} className={className}>
      {status}
    </Badge>
  );
}

const PROPERTY_TONE: Record<string, Tone> = {
  Available: 'green',
  Reserved: 'amber',
  Booked: 'blue',
  Sold: 'gray',
};
export const PropertyStatusBadge = ({ status, className }: { status: string; className?: string }) => (
  <Badge tone={PROPERTY_TONE[status] ?? 'gray'} className={className}>
    {status}
  </Badge>
);

const PRIORITY: Record<string, { tone: Tone; icon: typeof Flame }> = {
  Hot: { tone: 'red', icon: Flame },
  Warm: { tone: 'amber', icon: Sun },
  Cold: { tone: 'blue', icon: Snowflake },
};
export function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority || !PRIORITY[priority]) return null;
  const { tone, icon: Icon } = PRIORITY[priority];
  return (
    <Badge tone={tone} dot={false}>
      <Icon className="size-3" />
      {priority}
    </Badge>
  );
}

const TASK_TONE: Record<string, Tone> = {
  Low: 'gray',
  Medium: 'blue',
  High: 'amber',
  Urgent: 'red',
};
export const TaskPriorityBadge = ({ priority }: { priority: string }) => <Badge tone={TASK_TONE[priority] ?? 'gray'}>{priority}</Badge>;
