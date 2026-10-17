import { ArrowRightLeft, CalendarCheck2, FileText, Handshake, IndianRupee, Mail, MessageCircle, Phone, PhoneCall, Sparkles, StickyNote, UserCheck, UserPlus, Pencil, Users } from 'lucide-react';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/Feedback';
import type { Activity } from '@/types';

const ICONS: Record<string, { icon: typeof Phone; tone: string }> = {
  created: { icon: UserPlus, tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
  assigned: {
    icon: UserCheck,
    tone: 'bg-stone-100 text-stone-600 ring-stone-200',
  },
  call: { icon: Phone, tone: 'bg-brand-50 text-brand-700 ring-brand-100' },
  whatsapp: {
    icon: MessageCircle,
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  email: { icon: Mail, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
  meeting: {
    icon: Users,
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  status: {
    icon: ArrowRightLeft,
    tone: 'bg-orange-50 text-orange-700 ring-orange-100',
  },
  site_visit: {
    icon: CalendarCheck2,
    tone: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  followup: { icon: PhoneCall, tone: 'bg-sky-50 text-sky-700 ring-sky-100' },
  note: { icon: StickyNote, tone: 'bg-gold-50 text-gold-700 ring-gold-100' },
  conversion: {
    icon: Sparkles,
    tone: 'bg-brand-800 text-gold-300 ring-brand-700',
  },
  payment: {
    icon: IndianRupee,
    tone: 'bg-brand-50 text-brand-800 ring-brand-100',
  },
  deal: {
    icon: Handshake,
    tone: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  document: {
    icon: FileText,
    tone: 'bg-stone-100 text-stone-600 ring-stone-200',
  },
  updated: { icon: Pencil, tone: 'bg-stone-100 text-stone-600 ring-stone-200' },
};

export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const { icon: Icon, tone } = ICONS[type] ?? ICONS.note;
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white', tone, className)}>
      <Icon className="size-[15px]" />
    </span>
  );
}

export function ActivityTimeline({ items, emptyText = 'No activity yet' }: { items: Activity[]; emptyText?: string }) {
  if (!items.length) return <EmptyState compact icon={<Sparkles />} title={emptyText} />;
  return (
    <ol className="relative">
      {items.map((a, i) => (
        <li key={a.id} className="relative flex gap-3.5 pb-5 last:pb-0">
          {i < items.length - 1 && <span className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-stone-200" />}
          <ActivityIcon type={a.type} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-[13.5px] font-bold text-ink">{a.title}</p>
              <time className="text-[12px] text-stone-400" title={fmtDateTime(a.created_at)}>
                {timeAgo(a.created_at)}
              </time>
            </div>
            {a.description && <p className={cn('mt-1 text-[13px] leading-relaxed text-stone-600', a.type === 'note' && 'rounded-lg border border-gold-100 bg-gold-50/60 px-3 py-2 text-stone-700')}>{a.description}</p>}
            {a.user_name && <p className="mt-1 text-[12px] text-stone-400">by {a.user_name}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
