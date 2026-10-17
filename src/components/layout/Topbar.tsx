import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Popover from '@radix-ui/react-popover';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, BellRing, Building2, CalendarCheck2, CheckCheck, CircleAlert, CornerDownLeft, Handshake, IndianRupee, ListChecks, LogOut, Menu as MenuIcon, PhoneCall, Plus, Search, Settings, UserPlus, UserRound, Users, CalendarClock, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useAuth, useUser } from '@/lib/auth';
import { navFor } from '@/lib/nav';
import { timeAgo, inrShort } from '@/lib/format';
import { ROLE_LABEL, cn } from '@/lib/utils';
import { useDebounce, useMeta } from '@/hooks/queries';
import { Avatar, Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { BrandMark } from './Brand';
import type { NotificationItem } from '@/types';

const NOTIF_ICON: Record<string, typeof Bell> = {
  payment: IndianRupee,
  site_visit: CalendarCheck2,
  followup: PhoneCall,
  alert: CircleAlert,
  installment: CalendarClock,
  lead: UserPlus,
  deal: Handshake,
  task: ListChecks,
  document: FileText,
};

function NotificationBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: NotificationItem[]; meta: { unread: number } }>('/notifications', { limit: 40 }),
    refetchInterval: 60_000,
  });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const openItem = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.is_read) api.patch(`/notifications/${n.id}/read`, {}).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
    if (n.link) navigate(n.link);
  };
  const unread = data?.meta.unread ?? 0;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative flex size-10 items-center justify-center rounded-[10px] text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          {unread ? <BellRing className="size-[19px]" /> : <Bell className="size-[19px]" />}
          {unread > 0 && <span className="absolute top-1.5 right-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} className="z-50 w-[min(380px,calc(100vw-24px))] rounded-2xl border border-stone-200 bg-white shadow-pop data-[state=open]:animate-fade-in">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <div>
              <p className="text-[14.5px] font-bold">Notifications</p>
              <p className="text-[12px] text-stone-500">{unread ? `${unread} unread` : 'You’re all caught up'}</p>
            </div>
            {unread > 0 && (
              <button onClick={() => readAll.mutate()} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-brand-800 hover:bg-brand-50">
                <CheckCheck className="size-4" /> Mark all read
              </button>
            )}
          </div>
          <ul className="scroll-thin max-h-[min(440px,70vh)] overflow-y-auto py-1">
            {!data?.data.length && <li className="px-4 py-10 text-center text-[13px] text-stone-500">No notifications yet</li>}
            {data?.data.map((n) => {
              const Icon = NOTIF_ICON[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50', !n.is_read && 'bg-brand-50/40')}>
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full', n.type === 'alert' ? 'bg-red-50 text-red-600' : n.type === 'payment' ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-600')}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-bold text-ink">{n.title}</span>
                        {!n.is_read && <span className="size-1.5 shrink-0 rounded-full bg-brand-600" />}
                      </span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-stone-600">{n.message}</span>
                      <span className="mt-1 block text-[11.5px] text-stone-400">{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface SearchResults {
  leads: {
    id: number;
    code: string;
    name: string;
    phone: string;
    status: string;
  }[];
  customers: {
    id: number;
    code: string;
    name: string;
    phone: string;
    property_project?: string;
    property_unit?: string;
  }[];
  properties: {
    id: number;
    code: string;
    name: string;
    project: string;
    unit_number: string;
    status: string;
    price: number;
  }[];
}

export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useUser();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const dq = useDebounce(q.trim(), 200);
  const listRef = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useQuery({
    queryKey: ['search', dq],
    queryFn: () => api.get<SearchResults>('/search', { q: dq }),
    enabled: open && dq.length >= 2,
  });

  const pages = useMemo(() => navFor(user.role).flatMap((s) => s.items), [user.role]);
  const items = useMemo(() => {
    const out: {
      key: string;
      group: string;
      label: string;
      meta?: string;
      badge?: string;
      icon: typeof Users;
      to: string;
    }[] = [];
    if (dq.length < 2) {
      pages.forEach((p) =>
        out.push({
          key: `p${p.to}${p.label}`,
          group: 'Go to',
          label: p.label,
          icon: p.icon,
          to: p.to,
        }),
      );
      return out;
    }
    pages
      .filter((p) => p.label.toLowerCase().includes(dq.toLowerCase()))
      .forEach((p) =>
        out.push({
          key: `p${p.to}`,
          group: 'Pages',
          label: p.label,
          icon: p.icon,
          to: p.to,
        }),
      );
    data?.leads.forEach((l) =>
      out.push({
        key: `l${l.id}`,
        group: 'Leads',
        label: l.name,
        meta: `${l.code} · ${l.phone}`,
        badge: l.status,
        icon: Users,
        to: `/leads/${l.id}`,
      }),
    );
    data?.customers.forEach((c) =>
      out.push({
        key: `c${c.id}`,
        group: 'Customers',
        label: c.name,
        meta: `${c.code} · ${c.property_project ?? ''} ${c.property_unit ?? ''}`,
        icon: UserRound,
        to: `/customers/${c.id}`,
      }),
    );
    data?.properties.forEach((p) =>
      out.push({
        key: `r${p.id}`,
        group: 'Properties',
        label: `${p.project} · ${p.unit_number}`,
        meta: `${p.name} · ${inrShort(p.price)}`,
        badge: p.status,
        icon: Building2,
        to: `/properties/${p.id}`,
      }),
    );
    return out;
  }, [dq, data, pages]);

  useEffect(() => {
    setActive(0);
  }, [dq, open]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };
  let lastGroup = '';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed top-[8vh] left-1/2 z-50 w-[calc(100%-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-pop data-[state=open]:animate-slide-up focus:outline-none">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Dialog.Description className="sr-only">Search leads, customers, properties and pages</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-stone-100 px-4">
            <Search className="size-[18px] text-stone-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(items.length - 1, a + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === 'Enter' && items[active]) go(items[active].to);
              }}
              placeholder="Search leads, customers, units, phone numbers…"
              className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-400"
            />
            {isFetching && <span className="size-4 animate-spin rounded-full border-2 border-stone-200 border-t-brand-700" />}
          </div>
          <div ref={listRef} className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
            {dq.length >= 2 && !isFetching && items.length === 0 && <p className="px-3 py-10 text-center text-[13.5px] text-stone-500">No results for “{dq}”</p>}
            {items.map((it, idx) => {
              const header = it.group !== lastGroup ? it.group : null;
              lastGroup = it.group;
              return (
                <div key={it.key}>
                  {header && <p className="px-3 pt-2.5 pb-1 text-[11px] font-bold tracking-wide text-stone-400 uppercase">{header}</p>}
                  <button data-idx={idx} onMouseMove={() => setActive(idx)} onClick={() => go(it.to)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', idx === active ? 'bg-brand-50' : '')}>
                    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', idx === active ? 'bg-white text-brand-800 shadow-card' : 'bg-stone-100 text-stone-500')}>
                      <it.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{it.label}</span>
                      {it.meta && <span className="block truncate text-[12px] text-stone-500">{it.meta}</span>}
                    </span>
                    {it.badge && <StatusBadge status={it.badge} />}
                    {idx === active && <CornerDownLeft className="size-4 text-stone-400" />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hidden items-center gap-4 border-t border-stone-100 bg-stone-50 px-4 py-2 text-[11.5px] text-stone-500 sm:flex">
            <span>
              <kbd className="rounded border border-stone-200 bg-white px-1.5 font-sans">↑</kbd> <kbd className="rounded border border-stone-200 bg-white px-1.5 font-sans">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border border-stone-200 bg-white px-1.5 font-sans">Enter</kbd> to open
            </span>
            <span>
              <kbd className="rounded border border-stone-200 bg-white px-1.5 font-sans">Esc</kbd> to close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QuickAdd() {
  const user = useUser();
  const navigate = useNavigate();
  const sales = can.sales(user.role);
  return (
    <Menu
      trigger={
        <Button variant="primary" size="md" icon={<Plus />} className="max-sm:size-10 max-sm:px-0" aria-label="Create new">
          <span className="hidden sm:inline">New</span>
        </Button>
      }
    >
      <MenuLabel>Create</MenuLabel>
      {sales && (
        <>
          <MenuItem icon={<UserPlus />} onSelect={() => navigate('/leads?new=1')}>
            New lead
          </MenuItem>
          <MenuItem icon={<PhoneCall />} onSelect={() => navigate('/followups?new=1')}>
            Schedule follow-up
          </MenuItem>
          <MenuItem icon={<CalendarCheck2 />} onSelect={() => navigate('/site-visits?new=1')}>
            Schedule site visit
          </MenuItem>
        </>
      )}
      <MenuItem icon={<ListChecks />} onSelect={() => navigate('/tasks?new=1')}>
        New task
      </MenuItem>
      {can.finance(user.role) && (
        <MenuItem icon={<IndianRupee />} onSelect={() => navigate('/finance/installments?range=next30')}>
          Record payment
        </MenuItem>
      )}
      {can.editProperties(user.role) && (
        <MenuItem icon={<Building2 />} onSelect={() => navigate('/properties?new=1')}>
          Add property
        </MenuItem>
      )}
    </Menu>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const meta = useMeta();
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="no-print safe-top sticky top-0 z-20 border-b border-stone-200/70 bg-canvas/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="flex size-10 items-center justify-center rounded-[10px] text-stone-600 hover:bg-stone-100 lg:hidden" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </button>
        <BrandMark className="size-8 sm:hidden" />
        <button onClick={() => setSearchOpen(true)} className="hidden h-10 max-w-md flex-1 items-center gap-2.5 rounded-[10px] border border-stone-200 bg-white px-3 text-[13.5px] text-stone-400 shadow-card transition-colors hover:border-stone-300 sm:flex">
          <Search className="size-4" />
          <span className="flex-1 text-left">Search leads, customers, units…</span>
          <kbd className="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-stone-500">Ctrl K</kbd>
        </button>
        <div className="flex-1 sm:hidden" />
        <div className="flex items-center gap-1 sm:ml-auto sm:gap-2">
          {meta.data?.mode === 'demo' && (
            <span className="hidden items-center gap-1.5 rounded-full border border-gold-200 bg-gold-50 px-2.5 py-1 text-[11.5px] font-bold text-gold-700 md:inline-flex" title="This environment uses sample data">
              <span className="size-1.5 rounded-full bg-gold-500" /> Demo data
            </span>
          )}
          <button onClick={() => setSearchOpen(true)} className="flex size-10 items-center justify-center rounded-[10px] text-stone-600 hover:bg-stone-100 sm:hidden" aria-label="Search">
            <Search className="size-[19px]" />
          </button>
          <QuickAdd />
          <NotificationBell />
          <Menu
            trigger={
              <button className="flex items-center gap-2 rounded-[10px] p-1 transition-colors hover:bg-stone-100 sm:pr-2" aria-label="Account menu">
                <Avatar name={user.name} size="sm" />
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-[13px] font-bold text-ink">{user.name}</span>
                  <span className="block text-[11.5px] text-stone-500">{ROLE_LABEL[user.role]}</span>
                </span>
              </button>
            }
          >
            <div className="px-2.5 py-2">
              <p className="text-[13.5px] font-bold text-ink">{user.name}</p>
              <p className="text-[12px] text-stone-500">{user.email}</p>
            </div>
            <MenuSeparator />
            <MenuItem icon={<Settings />} onSelect={() => navigate('/settings')}>
              Settings & profile
            </MenuItem>
            <MenuItem icon={<LogOut />} onSelect={logout} danger>
              Sign out
            </MenuItem>
          </Menu>
        </div>
      </div>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
