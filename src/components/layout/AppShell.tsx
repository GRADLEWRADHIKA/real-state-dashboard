import { Suspense, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { MoreHorizontal } from 'lucide-react';
import { homeFor, useAuth } from '@/lib/auth';
import { BOTTOM_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { PageSkeleton } from '@/components/ui/Feedback';
import type { Role } from '@/types';
import { Sidebar, SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { BRAND, PoweredBy } from './Brand';

function MobileNav({ role, onMore }: { role: Exclude<Role, 'customer'>; onMore: () => void }) {
  return (
    <nav className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md lg:hidden" aria-label="Primary">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {BOTTOM_NAV[role].map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={({ isActive }) => cn('flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors', isActive ? 'text-brand-800' : 'text-stone-500')}>
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-brand-100')}>
                    <item.icon className="size-[19px]" strokeWidth={isActive ? 2.3 : 2} />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li>
          <button onClick={onMore} className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-stone-500">
            <span className="flex h-7 w-12 items-center justify-center">
              <MoreHorizontal className="size-[19px]" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Staff application frame: sidebar (desktop), drawer + bottom bar (tablet/phone). */
export function AppShell() {
  const { user } = useAuth();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role === 'customer') return <Navigate to="/portal" replace />;

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-stone-950/50 data-[state=open]:animate-fade-in lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] shadow-2xl data-[state=open]:animate-[slide-in_0.22s_ease-out] focus:outline-none lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main menu</Dialog.Description>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <style>{`@keyframes slide-in{from{transform:translateX(-100%)}to{transform:none}}`}</style>

      <div className="flex min-h-dvh flex-col lg:pl-[252px] print:pl-0">
        <Topbar onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-7 lg:px-8 lg:pb-10 print:p-0">
          <Suspense fallback={<PageSkeleton />}>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </Suspense>
        </main>
        <footer className="no-print hidden items-center justify-between border-t border-stone-200/70 px-8 py-4 text-[12px] text-stone-400 lg:flex">
          <span>
            © {new Date().getFullYear()} {BRAND.company} · {BRAND.product}
          </span>
          <PoweredBy />
        </footer>
      </div>
      <MobileNav role={user.role} onMore={() => setDrawer(true)} />
    </div>
  );
}

export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}
