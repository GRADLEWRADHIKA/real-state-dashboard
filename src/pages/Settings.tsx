import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Bell, Building, Check, CreditCard, DatabaseBackup, KeyRound, ListOrdered, Lock, Shapes, UserCog, UserRound, Webhook, X, Minus } from 'lucide-react';
import { api, auth } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { LEAD_STATUSES, ROLE_LABEL, cn } from '@/lib/utils';
import { useAction, useSettings } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Form';
import { StatusBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Misc';
import { PageSkeleton } from '@/components/ui/Feedback';
import { PoweredBy } from '@/components/layout/Brand';
import { AssignmentPanel, BackupsPanel, LeadCapturePanel, SecurityPolicyCard, TargetsCard, Toggle } from '@/components/domain/SettingsPanels';
import type { User } from '@/types';

type Section = 'profile' | 'company' | 'roles' | 'leads' | 'statuses' | 'types' | 'payments' | 'notifications' | 'security' | 'backups';

const SECTIONS: {
  key: Section;
  label: string;
  icon: typeof Bell;
  admin?: boolean;
}[] = [
  { key: 'profile', label: 'My profile', icon: UserRound },
  { key: 'company', label: 'Company profile', icon: Building, admin: true },
  { key: 'roles', label: 'Users & roles', icon: UserCog, admin: true },
  { key: 'leads', label: 'Lead capture', icon: Webhook, admin: true },
  { key: 'statuses', label: 'Lead statuses', icon: ListOrdered },
  { key: 'types', label: 'Property types', icon: Shapes },
  { key: 'payments', label: 'Payment methods', icon: CreditCard },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'backups', label: 'Backups', icon: DatabaseBackup, admin: true },
];

const MATRIX: {
  area: string;
  access: Record<string, 'full' | 'own' | 'view' | 'none'>;
}[] = [
  {
    area: 'Dashboard & analytics',
    access: { admin: 'full', manager: 'full', sales: 'own', accounts: 'none' },
  },
  {
    area: 'Leads & pipeline',
    access: { admin: 'full', manager: 'full', sales: 'own', accounts: 'none' },
  },
  {
    area: 'Lead assignment',
    access: { admin: 'full', manager: 'full', sales: 'none', accounts: 'none' },
  },
  {
    area: 'Site visits & follow-ups',
    access: { admin: 'full', manager: 'full', sales: 'own', accounts: 'none' },
  },
  {
    area: 'Customers',
    access: { admin: 'full', manager: 'full', sales: 'own', accounts: 'full' },
  },
  {
    area: 'Properties',
    access: { admin: 'full', manager: 'full', sales: 'view', accounts: 'view' },
  },
  {
    area: 'Payments & installments',
    access: { admin: 'full', manager: 'none', sales: 'none', accounts: 'full' },
  },
  {
    area: 'Reports',
    access: { admin: 'full', manager: 'view', sales: 'none', accounts: 'view' },
  },
  {
    area: 'Users & settings',
    access: { admin: 'full', manager: 'none', sales: 'none', accounts: 'none' },
  },
];

function AccessCell({ v }: { v: 'full' | 'own' | 'view' | 'none' }) {
  if (v === 'none') return <Minus className="mx-auto size-4 text-stone-300" aria-label="No access" />;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold', v === 'full' ? 'bg-brand-50 text-brand-800' : v === 'own' ? 'bg-sky-50 text-sky-800' : 'bg-stone-100 text-stone-600')}>
      {v === 'full' && <Check className="size-3" />}
      {v === 'full' ? 'Full' : v === 'own' ? 'Own records' : 'View'}
    </span>
  );
}

export default function Settings() {
  const user = useUser();
  const { setUser } = useAuth();
  const isAdmin = user.role === 'admin';
  const { data: settings, isLoading } = useSettings();
  const [section, setSection] = useState<Section>('profile');

  const company = useForm(
    {
      name: '',
      legal_name: '',
      tagline: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      gstin: '',
      rera: '',
      receipt_prefix: 'SWR',
      currency: 'INR',
    },
    (v) => ({
      name: required(v.name),
      receipt_prefix: required(v.receipt_prefix),
    }),
  );
  useEffect(() => {
    if (settings?.company) company.setValues({ ...company.values, ...settings.company });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);
  const saveCompany = useAction((v: typeof company.values) => api.put('/settings/company', v), { success: 'Company profile saved', invalidate: [['settings']] });

  const profile = useForm({ name: user.name, phone: user.phone ?? '' }, (v) => ({ name: required(v.name) }));
  const saveProfile = useAction((v: typeof profile.values) => api.put<{ user: User }>('/auth/profile', v), {
    success: 'Profile updated',
    invalidate: [['directory']],
    onSuccess: (r) => setUser(r.user),
  });

  const pw = useForm({ current_password: '', new_password: '', confirm: '' }, (v) => ({
    current_password: required(v.current_password),
    new_password: v.new_password.length < 8 || !/[A-Z]/.test(v.new_password) || !/[0-9]/.test(v.new_password) ? 'Min 8 characters with an uppercase letter and a number' : undefined,
    confirm: v.confirm !== v.new_password ? 'Passwords do not match' : undefined,
  }));
  const changePw = useAction((v: typeof pw.values) => auth.changePassword(v.current_password, v.new_password), { success: (m) => m, invalidate: [], onSuccess: () => pw.reset() });

  const [notif, setNotif] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (settings?.notifications) setNotif(settings.notifications);
  }, [settings]);
  const saveNotif = useAction((v: Record<string, boolean>) => api.put('/settings/notifications', v), { success: 'Notification preferences saved', invalidate: [['settings']] });

  if (isLoading) return <PageSkeleton stats={0} />;
  const sections = SECTIONS.filter((s) => !s.admin || isAdmin);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Company profile, configuration and your account" crumbs={[{ label: 'Administration' }, { label: 'Settings' }]} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_1fr]">
        <nav className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:px-0" aria-label="Settings sections">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[13.5px] font-semibold whitespace-nowrap transition-colors',
                section === s.key ? 'bg-white text-brand-800 shadow-card ring-1 ring-stone-200' : 'text-stone-600 hover:bg-white/60 hover:text-ink',
              )}
            >
              <s.icon className={cn('size-4', section === s.key ? 'text-brand-700' : 'text-stone-400')} />
              {s.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {section === 'profile' && (
            <Card>
              <CardHeader title="My profile" subtitle={`${ROLE_LABEL[user.role]} · ${user.email}`} />
              <form className="grid grid-cols-1 max-w-xl gap-4 px-5 pb-5 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), profile.submit((v) => saveProfile.mutateAsync(v)))} noValidate>
                <Field label="Full name" error={profile.errors.name}>
                  {(id) => <Input id={id} {...profile.bind('name')} />}
                </Field>
                <Field label="Phone">{(id) => <Input id={id} {...profile.bind('phone')} />}</Field>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="primary" loading={profile.busy}>
                    Save profile
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {section === 'company' && isAdmin && (
            <Card>
              <CardHeader title="Company profile" subtitle="Shown on receipts, the login screen and customer communication" />
              <form className="grid grid-cols-1 gap-4 px-5 pb-5 sm:grid-cols-2" onSubmit={(e) => (e.preventDefault(), company.submit((v) => saveCompany.mutateAsync(v)))} noValidate>
                <Field label="Company name" required error={company.errors.name}>
                  {(id) => <Input id={id} {...company.bind('name')} />}
                </Field>
                <Field label="Legal name">{(id) => <Input id={id} {...company.bind('legal_name')} />}</Field>
                <Field label="Tagline">{(id) => <Input id={id} {...company.bind('tagline')} />}</Field>
                <Field label="Website">{(id) => <Input id={id} {...company.bind('website')} />}</Field>
                <Field label="Email">{(id) => <Input id={id} type="email" {...company.bind('email')} />}</Field>
                <Field label="Phone">{(id) => <Input id={id} {...company.bind('phone')} />}</Field>
                <Field label="Registered office address" className="sm:col-span-2">
                  {(id) => <Textarea id={id} rows={2} {...company.bind('address')} />}
                </Field>
                <Field label="GSTIN" hint="Printed on receipts when set">
                  {(id) => <Input id={id} className="uppercase" {...company.bind('gstin')} />}
                </Field>
                <Field label="RERA registration" hint="Printed on receipts when set">
                  {(id) => <Input id={id} {...company.bind('rera')} />}
                </Field>
                <Field label="Receipt prefix" required error={company.errors.receipt_prefix} hint={`Next receipt looks like ${company.values.receipt_prefix || 'RCPT'}/2026-27/0001`}>
                  {(id) => <Input id={id} className="uppercase" maxLength={10} {...company.bind('receipt_prefix')} />}
                </Field>
                <Field label="Currency">{(id) => <Input id={id} value="INR — Indian Rupee (₹)" disabled />}</Field>
                <div className="sm:col-span-2">
                  <Button type="submit" variant="primary" loading={company.busy}>
                    Save company profile
                  </Button>
                </div>
              </form>
            </Card>
          )}
          {section === 'company' && isAdmin && settings && (
            <div className="mt-5">
              <TargetsCard targets={settings.targets} />
            </div>
          )}

          {section === 'roles' && isAdmin && (
            <Card className="overflow-hidden">
              <CardHeader
                title="Roles & permissions"
                subtitle="What each role can access across EstateFlow"
                action={
                  <Link to="/users" className="text-[13px] font-semibold text-brand-800 hover:underline">
                    Manage users →
                  </Link>
                }
              />
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[620px] text-[13.5px]">
                  <thead>
                    <tr className="border-y border-stone-100 bg-stone-50/70 text-[11.5px] font-semibold tracking-[0.04em] text-stone-500 uppercase">
                      <th className="py-2.5 pl-5 text-left">Area</th>
                      {(['admin', 'manager', 'sales', 'accounts'] as const).map((r) => (
                        <th key={r} className="px-3 text-center last:pr-5">
                          {ROLE_LABEL[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX.map((m) => (
                      <tr key={m.area} className="border-b border-stone-100 last:border-0">
                        <td className="py-3 pl-5 font-semibold text-ink">{m.area}</td>
                        {(['admin', 'manager', 'sales', 'accounts'] as const).map((r) => (
                          <td key={r} className="px-3 text-center last:pr-5">
                            <AccessCell v={m.access[r]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-5 py-3 text-[12.5px] text-stone-500">Customers only see their own portal: property, payment schedule, receipts and documents.</p>
            </Card>
          )}

          {section === 'leads' && settings && (
            <div className="space-y-5">
              <LeadCapturePanel capture={settings.lead_capture} />
              <AssignmentPanel assignment={settings.assignment} />
            </div>
          )}

          {section === 'statuses' && (
            <Card>
              <CardHeader title="Lead statuses" subtitle="Pipeline stages used across leads, the board and reports" />
              <ol className="px-5 pb-5">
                {LEAD_STATUSES.map((s, i) => (
                  <li key={s} className="flex items-center gap-4 border-t border-stone-100 py-3 first:border-0">
                    <span className="num w-6 text-[12px] font-bold text-stone-400">{i + 1}</span>
                    <StatusBadge status={s} />
                    <span className="text-[13px] text-stone-500">
                      {
                        {
                          New: 'Fresh enquiry awaiting first contact',
                          Contacted: 'Spoken to; requirement being understood',
                          Qualified: 'Budget, timeline and intent confirmed',
                          'Site Visit': 'Visit scheduled or completed',
                          Negotiation: 'Price and payment plan under discussion',
                          Booked: 'Converted — booking amount and schedule created',
                          Closed: 'Fully paid / registered',
                          Lost: 'Not proceeding (reason recorded)',
                        }[s]
                      }
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {(section === 'types' || section === 'payments') && (
            <Card>
              <CardHeader title={section === 'types' ? 'Property types' : 'Payment methods'} subtitle={section === 'types' ? 'Available when adding inventory and capturing lead requirements' : 'Accepted when recording payments; cheques can be held for clearance'} />
              <div className="flex flex-wrap gap-2 px-5 pb-5">
                {((section === 'types' ? settings?.property_types : settings?.payment_methods) ?? []).map((t: string) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-stone-700 shadow-card">
                    <Check className="size-3.5 text-brand-600" />
                    {t}
                  </span>
                ))}
              </div>
              <p className="border-t border-stone-100 px-5 py-3 text-[12.5px] text-stone-500">These values drive validation and reporting. Contact TheGradleW support to add a custom type.</p>
            </Card>
          )}

          {section === 'notifications' && (
            <Card>
              <CardHeader title="Notifications" subtitle="In-app alerts for the team" />
              <div className="divide-y divide-stone-100 px-5">
                {[
                  ['payment_received', 'Payment received', 'Admins, accounts and the owning executive are notified'],
                  ['lead_assigned', 'Lead assigned', 'Notify executives when a lead is assigned to them'],
                  ['followup_reminder', 'Follow-up reminders', 'Remind owners about follow-ups due today'],
                  ['site_visit_reminder', 'Site visit reminders', 'Alert executives about today’s visits'],
                  ['installment_due', 'Installment due alerts', 'Remind customers before a due date and alert accounts when it is missed'],
                  ['customer_request', 'Customer requests', 'Notify the agent (and accounts for payment queries) when a customer raises a request'],
                  ['daily_digest', 'Daily digest', 'Morning summary of leads, visits and collections'],
                ].map(([k, label, hint]) => (
                  <Toggle key={k} label={label} hint={hint} checked={!!notif[k]} onChange={(v) => setNotif((n) => ({ ...n, [k]: v }))} />
                ))}
              </div>
              <div className="px-5 py-4">
                <Button variant="primary" disabled={!isAdmin} loading={saveNotif.isPending} onClick={() => saveNotif.mutate(notif)}>
                  Save preferences
                </Button>
                {!isAdmin && <p className="mt-2 text-[12.5px] text-stone-500">Only administrators can change notification rules.</p>}
              </div>
            </Card>
          )}

          {section === 'security' && (
            <div className="space-y-5">
              <Card>
                <CardHeader title="Change password" icon={<KeyRound />} />
                <form className="grid max-w-xl gap-4 px-5 pb-5" onSubmit={(e) => (e.preventDefault(), pw.submit((v) => changePw.mutateAsync(v)))} noValidate>
                  <Field label="Current password" error={pw.errors.current_password}>
                    {(id) => <Input id={id} type="password" autoComplete="current-password" {...pw.bind('current_password')} />}
                  </Field>
                  <Field label="New password" error={pw.errors.new_password} hint="At least 8 characters, one uppercase letter and one number">
                    {(id) => <Input id={id} type="password" autoComplete="new-password" {...pw.bind('new_password')} />}
                  </Field>
                  <Field label="Confirm new password" error={pw.errors.confirm}>
                    {(id) => <Input id={id} type="password" autoComplete="new-password" {...pw.bind('confirm')} />}
                  </Field>
                  <div>
                    <Button type="submit" variant="primary" loading={pw.busy}>
                      Update password
                    </Button>
                  </div>
                </form>
              </Card>
              {isAdmin && settings && <SecurityPolicyCard security={settings.security} />}
              <Card className="p-5">
                <p className="text-[14px] font-bold text-ink">Security practices in this deployment</p>
                <ul className="mt-3 space-y-2 text-[13px] text-stone-600">
                  {[
                    'Passwords are hashed with bcrypt and never stored in plain text',
                    'Short-lived access tokens with single-use refresh tokens; a replayed token signs that login out everywhere',
                    'Accounts lock after repeated failed sign-ins; an administrator can unlock them',
                    'Forgotten passwords are reset with a one-time code issued by an administrator or manager',
                    'Sales executives only see the leads and customers assigned to them',
                    'Customers use the mobile app and only see their own receipts and documents',
                    'Every change is written to the audit log with the user, IP address and request id',
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-1.5 text-[12px] text-stone-400">
                  <X className="size-3.5" /> Two-factor authentication is not enabled in this build.
                </p>
              </Card>
            </div>
          )}
          {section === 'backups' && isAdmin && <BackupsPanel />}
          <div className="mt-6 text-center lg:text-left">
            <PoweredBy />
          </div>
        </div>
      </div>
    </div>
  );
}
