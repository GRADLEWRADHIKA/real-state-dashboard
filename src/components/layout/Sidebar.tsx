import { NavLink, useLocation } from 'react-router';
import { LogOut } from 'lucide-react';
import { navFor } from '@/lib/nav';
import { useAuth, useUser } from '@/lib/auth';
import { ROLE_LABEL, cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/Misc';
import { BrandLockup, PoweredBy } from './Brand';

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const user = useUser();
  const { logout } = useAuth();
  const sections = navFor(user.role);
  const { pathname } = useLocation();
  const excluded = (item: { exclude?: string[] }) => !!item.exclude?.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <div className="flex h-full flex-col bg-brand-950 bg-[radial-gradient(120%_60%_at_0%_0%,rgb(15_81_50/0.55),transparent_70%)] text-brand-100">
      <div className="safe-top px-4 pt-5 pb-4">
        <BrandLockup />
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {sections.map((s) => (
          <div key={s.title} className="mt-4 first:mt-1">
            <p className="px-3 pb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-brand-300/50 uppercase">{s.title}</p>
            <ul className="space-y-0.5">
              {s.items.map((item) => (
                <li key={item.to + item.label}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive: active }) => cn('group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors', active && !excluded(item) ? 'bg-white/[0.09] text-white' : 'text-brand-100/70 hover:bg-white/[0.05] hover:text-white')}
                  >
                    {({ isActive: active }) => {
                      const isActive = active && !excluded(item);
                      return (
                      <>
                        {isActive && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-gold-400" />}
                        <item.icon className={cn('size-[18px] shrink-0', isActive ? 'text-gold-300' : 'text-brand-300/60 group-hover:text-brand-100')} strokeWidth={2} />
                        {item.label}
                      </>
                      );
                    }}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="safe-bottom border-t border-white/[0.07] px-3 pt-3 pb-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <Avatar name={user.name} size="sm" className="bg-gold-400/90 text-brand-950" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[13px] font-bold text-white">{user.name}</p>
            <p className="truncate text-[11.5px] text-brand-200/60">{ROLE_LABEL[user.role]}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-brand-200/60 transition-colors hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
            <LogOut className="size-4" />
          </button>
        </div>
        <PoweredBy tone="dark" className="mt-2 block px-2" />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[252px] lg:block">
      <SidebarContent />
    </aside>
  );
}
