import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Eye, KeyRound, LockOpen, LogOut, MoreHorizontal, Pencil, Power, ShieldCheck, UserCog, UserPlus } from 'lucide-react';
import { DESIGNATIONS } from '@estateflow/shared';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { ROLE_LABEL, cn } from '@/lib/utils';
import { useAction, useDebounce } from '@/hooks/queries';
import { required, useForm, validEmail } from '@/hooks/useForm';
import { Card, InfoRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, Input, SearchInput, Select } from '@/components/ui/Form';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Avatar, Menu, MenuItem, MenuSeparator, PageHeader, Tabs } from '@/components/ui/Misc';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { IssuedCodeModal, ResetRequestsPanel } from '@/components/domain/ResetCodes';
import type { Customer, IssuedResetCode, Paged, Role, User } from '@/types';

const ROLE_TONE: Record<Role, 'brand' | 'violet' | 'blue' | 'gold' | 'gray'> = {
  admin: 'brand',
  manager: 'violet',
  sales: 'blue',
  accounts: 'gold',
  customer: 'gray',
};
const ROLE_DESC: Record<Role, string> = {
  admin: 'Full access to every module, users and settings',
  manager: 'Team leads, assignments, pipeline and sales reports',
  sales: 'Own leads, follow-ups, site visits and customers',
  accounts: 'Payments, installments, receipts and financial reports',
  customer: 'Customer portal — property, payments and documents',
};

const CUSTOMER = 'Customer';
/** The designation that matches a user: their title when it is one, else the first designation for their role. */
const designationFor = (role: Role, title?: string | null) => (role === 'customer' ? CUSTOMER : (DESIGNATIONS.find((d) => d.title === title)?.title ?? DESIGNATIONS.find((d) => d.role === role)?.title ?? ''));

function UserFormModal({ open, onClose, user, presetRole }: { open: boolean; onClose: () => void; user?: User | null; presetRole?: Role }) {
  const editing = !!user;
  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: () =>
      api.get<Paged<Customer>>('/customers', {
        limit: 500,
        sort: 'name',
        order: 'asc',
      }),
    enabled: open,
  });
  const f = useForm(
    {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: (user?.role ?? presetRole ?? 'sales') as Role,
      phone: user?.phone ?? '',
      title: user?.title ?? '',
      designation: user ? designationFor(user.role, user.title) : designationFor(presetRole ?? 'sales', null),
      password: '',
      customer_id: user?.customer_id ? String(user.customer_id) : '',
    },
    (v) => ({
      name: required(v.name),
      email: required(v.email) ?? validEmail(v.email),
      password: !editing && !v.password ? 'Set an initial password' : v.password && (v.password.length < 8 || !/[A-Z]/.test(v.password) || !/[0-9]/.test(v.password)) ? 'Min 8 characters with an uppercase letter and a number' : undefined,
      customer_id: v.role === 'customer' && !v.customer_id ? 'Link the customer record' : undefined,
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const save = useAction(
    (v: typeof f.values) => {
      const { designation, ...rest } = v;
      const body = {
        ...rest,
        customer_id: v.customer_id ? Number(v.customer_id) : null,
        phone: v.phone || null,
        title: (designation && designation !== CUSTOMER ? designation : rest.title) || null,
      };
      return editing ? api.put(`/users/${user!.id}`, body) : api.post('/users', body);
    },
    { success: editing ? 'User updated' : 'User created', onSuccess: onClose },
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${user!.name}` : 'Add user'}
      description={editing ? user!.email : 'Invite a team member or give a customer portal access'}
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save' : 'Create user'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={f.errors.name}>
          {(id) => <Input id={id} autoFocus {...f.bind('name')} />}
        </Field>
        <Field label="Email" required error={f.errors.email}>
          {(id) => <Input id={id} type="email" {...f.bind('email')} />}
        </Field>
        <Field label="Designation" className="sm:col-span-2" hint="Sets what they can see and do in EstateFlow">
          {() => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...DESIGNATIONS.map((d) => ({ title: d.title as string, role: d.role as Role, description: d.description as string })), { title: CUSTOMER, role: 'customer' as Role, description: ROLE_DESC.customer }].map((d) => (
                <button
                  key={d.title}
                  type="button"
                  onClick={() => {
                    f.set('designation', d.title);
                    f.set('role', d.role);
                  }}
                  className={cn('rounded-xl border p-3 text-left transition-colors', f.values.designation === d.title ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/15' : 'border-stone-200 hover:bg-stone-50')}
                >
                  <p className="flex items-center justify-between gap-2 text-[13.5px] font-bold text-ink">
                    {d.title}
                    <Badge tone={ROLE_TONE[d.role]} dot={false}>
                      {ROLE_LABEL[d.role]}
                    </Badge>
                  </p>
                  <p className="mt-0.5 text-[12px] text-stone-500">{d.description}</p>
                </button>
              ))}
            </div>
          )}
        </Field>
        {f.values.role === 'customer' && (
          <Field label="Customer record" required error={f.errors.customer_id} className="sm:col-span-2">
            {(id) => (
              <Select id={id} {...f.bind('customer_id')}>
                <option value="">Select customer</option>
                {customers.data?.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.code} · {c.property_project} {c.property_unit}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Phone">{(id) => <Input id={id} {...f.bind('phone')} />}</Field>
        <Field label={editing ? 'New password' : 'Initial password'} required={!editing} error={f.errors.password} hint={editing ? 'Leave blank to keep the current password' : 'Share securely — the user can change it in Settings'} className="sm:col-span-2">
          {(id) => <Input id={id} type="password" autoComplete="new-password" {...f.bind('password')} />}
        </Field>
      </div>
    </Modal>
  );
}

export default function Users() {
  const me = useUser();
  const [params, setParams] = useSearchParams();
  const isAdmin = me.role === 'admin';
  const tab = !isAdmin || params.get('tab') === 'resets' ? 'resets' : 'users';
  const pending = useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => api.get<{ meta: { pending: number } }>('/users/reset-requests'),
  });
  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Users & roles' : 'Password resets'}
        subtitle={isAdmin ? 'Control who can access EstateFlow and what they can see' : 'Issue one-time reset codes to sales executives and customers'}
        crumbs={[{ label: 'Administration' }, { label: isAdmin ? 'Users & roles' : 'Password resets' }]}
        actions={
          isAdmin && tab === 'users' ? (
            <Button variant="primary" icon={<UserPlus />} onClick={() => setParams({ new: 'sales' }, { replace: true })}>
              Add user
            </Button>
          ) : undefined
        }
      />
      {isAdmin && (
        <Tabs
          className="mb-5"
          value={tab}
          onChange={(v) =>
            setParams(v === 'resets' ? { tab: 'resets' } : {}, {
              replace: true,
            })
          }
          tabs={[
            { value: 'users', label: 'Users' },
            {
              value: 'resets',
              label: 'Password resets',
              count: pending.data?.meta.pending || undefined,
            },
          ]}
        />
      )}
      {tab === 'users' ? (
        <UsersTab />
      ) : (
        <Card className="overflow-hidden">
          <ResetRequestsPanel />
        </Card>
      )}
    </div>
  );
}

function UsersTab() {
  const me = useUser();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [edit, setEdit] = useState<User | null>(null);
  const [view, setView] = useState<User | null>(null);
  const [issued, setIssued] = useState<IssuedResetCode | null>(null);
  const {
    data: resp,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users', role, status, dq],
    queryFn: () => api.get<Paged<User, { roleCounts: { role: Role; n: number }[] }>>('/users', { role, status, q: dq, limit: 500 }),
  });
  const data = resp?.data;
  const forceLogout = useAction((u: User) => api.post(`/users/${u.id}/force-logout`), { success: 'Signed out of every device', invalidate: [['users']] });
  const unlock = useAction((u: User) => api.post(`/users/${u.id}/unlock`), {
    success: 'Account unlocked',
    invalidate: [['users']],
  });
  const issueReset = useAction((u: User) => api.post<IssuedResetCode>(`/users/${u.id}/issue-reset`), { invalidate: [['reset-requests']], onSuccess: setIssued });
  const isLocked = (u: User) => !!u.locked_until && new Date(u.locked_until).getTime() > Date.now();
  const toggle = useAction(
    (u: User) =>
      api.patch(`/users/${u.id}/status`, {
        status: u.status === 'Active' ? 'Inactive' : 'Active',
      }),
    {
      success: (r: any) => (r.status === 'Active' ? 'User reactivated' : 'User deactivated'),
    },
  );
  const preset = params.get('new');
  const counts = useMemo(() => Object.fromEntries((resp?.meta.roleCounts ?? []).map((c) => [c.role, c.n])) as Record<string, number>, [resp]);

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} size="sm" />
          <div>
            <p className="font-semibold whitespace-nowrap text-ink">
              {u.name} {u.id === me.id && <span className="text-[11.5px] font-medium text-stone-400">(you)</span>}
            </p>
            <p className="text-[12px] text-stone-400">{u.role === 'customer' ? u.customer_name : u.title}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (u) => <span className="whitespace-nowrap">{u.email}</span>,
    },
    {
      key: 'designation',
      header: 'Designation',
      cell: (u) => <span className="whitespace-nowrap text-stone-700">{u.role === 'customer' ? 'Customer' : (u.title ?? '—')}</span>,
    },
    {
      key: 'role',
      header: 'Access',
      cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>,
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (u) => <span className="num whitespace-nowrap">{u.phone ?? '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={u.status} />
          {isLocked(u) && <Badge tone="red">Locked</Badge>}
        </div>
      ),
    },
    {
      key: 'sessions',
      header: 'Signed in',
      align: 'right',
      cell: (u) => <span className="num text-stone-500">{u.active_sessions ? `${u.active_sessions} device${u.active_sessions > 1 ? 's' : ''}` : '—'}</span>,
    },
    {
      key: 'login',
      header: 'Last login',
      cell: (u) => (
        <span className="whitespace-nowrap text-stone-500" title={fmtDateTime(u.last_login)}>
          {u.last_login ? timeAgo(u.last_login) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (u) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${u.name}`} icon={<MoreHorizontal />} />}>
            <MenuItem icon={<Eye />} onSelect={() => setView(u)}>
              View
            </MenuItem>
            <MenuItem icon={<Pencil />} onSelect={() => setEdit(u)}>
              Edit
            </MenuItem>
            {u.id !== me.id && (
              <>
                <MenuItem icon={<KeyRound />} disabled={u.status !== 'Active'} onSelect={() => issueReset.mutate(u)}>
                  Issue reset code
                </MenuItem>
                {isLocked(u) && (
                  <MenuItem icon={<LockOpen />} onSelect={() => unlock.mutate(u)}>
                    Unlock account
                  </MenuItem>
                )}
                <MenuItem
                  icon={<LogOut />}
                  disabled={!u.active_sessions}
                  onSelect={async () =>
                    (await confirm({
                      title: `Sign ${u.name} out everywhere?`,
                      message: 'Every device they are signed in on is signed out at once. They can sign in again with their password.',
                      confirmLabel: 'Sign out',
                    })) && forceLogout.mutate(u)
                  }
                >
                  Sign out everywhere
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<Power />}
                  danger={u.status === 'Active'}
                  onSelect={async () => {
                    if (
                      u.status === 'Inactive' ||
                      (await confirm({
                        title: `Deactivate ${u.name}?`,
                        message: 'They will be signed out and can no longer access EstateFlow. Their records stay intact.',
                        confirmLabel: 'Deactivate',
                      }))
                    )
                      toggle.mutate(u);
                  }}
                >
                  {u.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <button key={r} onClick={() => setRole(role === r ? '' : r)} className={cn('card p-4 text-left transition-shadow hover:shadow-pop', role === r && 'ring-2 ring-brand-600/40')}>
            <div className="flex items-center justify-between">
              <Badge tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Badge>
              <span className="text-[20px] font-extrabold text-ink">{counts[r] ?? 0}</span>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-stone-500">{ROLE_DESC[r]}</p>
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, email or phone…" className="sm:w-72" />
          <FilterSelect value={status} onChange={setStatus} placeholder="Any status" options={['Active', 'Inactive']} className="sm:w-40" />
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <DataTable
            rows={data ?? []}
            columns={columns}
            rowKey={(u) => u.id}
            loading={isLoading}
            onRowClick={setView}
            rowClassName={(u) => (u.status === 'Inactive' ? 'opacity-60' : undefined)}
            mobileCard={(u) => (
              <div className="flex items-center gap-3">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-ink">{u.name}</p>
                  <p className="truncate text-[12.5px] text-stone-500">{u.role === 'customer' ? u.email : [u.title, u.email].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  {u.status === 'Inactive' && <StatusBadge status="Inactive" />}
                </div>
              </div>
            )}
            empty={<EmptyState icon={<UserCog />} title="No users match" />}
          />
        )}
      </Card>
      <UserFormModal open={!!preset} onClose={() => setParams({}, { replace: true })} presetRole={(preset as Role) || 'sales'} />
      <UserFormModal open={!!edit} onClose={() => setEdit(null)} user={edit} />
      <IssuedCodeModal issued={issued} onClose={() => setIssued(null)} />
      <Modal
        open={!!view}
        onClose={() => setView(null)}
        title={view?.name ?? ''}
        description={view ? [view.role !== 'customer' && view.title, ROLE_LABEL[view.role]].filter(Boolean).join(' · ') : ''}
        size="sm"
        footer={
          <>
            <Button onClick={() => setView(null)}>Close</Button>
            <Button
              variant="primary"
              icon={<Pencil />}
              onClick={() => {
                setEdit(view);
                setView(null);
              }}
            >
              Edit
            </Button>
          </>
        }
      >
        {view && (
          <div>
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={view.name} size="lg" />
              <div>
                <p className="text-[15px] font-bold text-ink">{view.name}</p>
                <p className="text-[13px] text-stone-500">{view.title}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <InfoRow label="Email">{view.email}</InfoRow>
              <InfoRow label="Phone">{view.phone}</InfoRow>
              <InfoRow label="Status">
                <StatusBadge status={view.status} />
              </InfoRow>
              <InfoRow label="Last login">{view.last_login ? fmtDateTime(view.last_login) : 'Never'}</InfoRow>
              <InfoRow label="Signed-in devices">{view.active_sessions ?? 0}</InfoRow>
              {isLocked(view) && <InfoRow label="Locked until">{fmtDateTime(view.locked_until)}</InfoRow>}
              {view.role !== 'customer' ? <InfoRow label="Assigned leads">{view.leads_count ?? 0}</InfoRow> : <InfoRow label="Customer">{view.customer_name}</InfoRow>}
              <InfoRow label="Member since">{fmtDateTime(view.created_at).split(',')[0]}</InfoRow>
            </dl>
            <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
              {ROLE_DESC[view.role]}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
