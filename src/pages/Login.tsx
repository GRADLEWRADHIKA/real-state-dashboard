import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowRight, Building2, CalendarCheck2, Eye, EyeOff, IndianRupee, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useMeta } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { BRAND, BrandMark, PoweredBy } from '@/components/layout/Brand';
import logo from '@/assets/starwiz-logo-512.png';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@demo.com', password: 'Admin@123' },
  { role: 'Sales Manager', email: 'manager@demo.com', password: 'Manager@123' },
  { role: 'Sales Executive', email: 'sales@demo.com', password: 'Sales@123' },
  { role: 'Accounts', email: 'accounts@demo.com', password: 'Accounts@123' },
];

function Skyline() {
  // Line drawing of a township skyline: towers, villas and trees.
  const towers = [
    { x: 40, w: 54, h: 210 },
    { x: 104, w: 40, h: 150 },
    { x: 380, w: 62, h: 250 },
    { x: 452, w: 44, h: 180 },
  ];
  return (
    <svg viewBox="0 0 540 300" className="h-auto w-full" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
        {towers.map((t, i) => (
          <g key={i}>
            <rect x={t.x} y={290 - t.h} width={t.w} height={t.h} rx="2" />
            {Array.from({ length: Math.floor(t.h / 22) - 1 }).map((_, r) =>
              Array.from({ length: Math.floor(t.w / 14) }).map((__, c) => <rect key={`${r}-${c}`} x={t.x + 7 + c * 14} y={290 - t.h + 12 + r * 22} width="6" height="9" rx="1" opacity={(r + c + i) % 4 === 0 ? 0.9 : 0.35} />),
            )}
          </g>
        ))}
        {[170, 250].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 290 V215 L${x + 36} 182 L${x + 72} 215 V290`} />
            <path d={`M${x - 6} 220 L${x + 36} 180 L${x + 78} 220`} opacity="0.7" />
            <rect x={x + 27} y={250} width="18" height="40" rx="1" />
            <rect x={x + 8} y={228} width="12" height="12" rx="1" opacity={i ? 0.9 : 0.4} />
            <rect x={x + 52} y={228} width="12" height="12" rx="1" opacity={i ? 0.4 : 0.9} />
          </g>
        ))}
        {[156, 334, 512].map((x) => (
          <g key={x} opacity="0.75">
            <circle cx={x} cy={262} r="13" />
            <path d={`M${x} 275 V290`} />
          </g>
        ))}
        <path d="M10 290 H530" opacity="0.8" />
        <path d="M30 297 H510" opacity="0.3" strokeDasharray="2 6" />
      </g>
    </svg>
  );
}

/** No email is sent: the request goes to an administrator, who hands over a one-time code. */
function ForgotPassword({ open, onClose, initialEmail }: { open: boolean; onClose: () => void; initialEmail: string }) {
  const [step, setStep] = useState<'request' | 'sent' | 'code' | 'done'>('request');
  const [email, setEmail] = useState(initialEmail);
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setStep('request');
      setEmail(initialEmail);
      setError(null);
    }
  }, [open, initialEmail]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const request = () =>
    run(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address');
      await api.post('/auth/forgot-password', {
        email,
        note: note || undefined,
      });
      setStep('sent');
    });
  const reset = () =>
    run(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address');
      if (code.trim().length < 6) throw new Error('Enter the code from your administrator');
      await api.post('/auth/reset-password', {
        email,
        code: code.trim(),
        new_password: pw,
      });
      setStep('done');
    });

  const footer =
    step === 'request' ? (
      <>
        <Button type="button" variant="ghost" onClick={() => setStep('code')}>
          I have a reset code
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Send request
        </Button>
      </>
    ) : step === 'code' ? (
      <>
        <Button type="button" onClick={() => setStep('request')}>
          Back
        </Button>
        <Button type="submit" variant="primary" loading={busy}>
          Set new password
        </Button>
      </>
    ) : step === 'sent' ? (
      <>
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={() => setStep('code')}>
          Enter reset code
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={onClose}>
        Back to sign in
      </Button>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={step === 'code' ? 'Enter your reset code' : step === 'done' ? 'Password changed' : 'Reset your password'}
      description={step === 'request' ? 'Your administrator will give you a one-time code in person or by phone.' : step === 'code' ? 'Codes are valid for 30 minutes and work once.' : undefined}
      onSubmit={step === 'request' ? request : step === 'code' ? reset : undefined}
      footer={footer}
    >
      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
      {step === 'request' && (
        <div className="space-y-4">
          <Field label="Work email" required>
            {(id) => <Input id={id} type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />}
          </Field>
          <Field label="Message for your administrator" hint="Optional">
            {(id) => <Input id={id} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I changed my phone" />}
          </Field>
        </div>
      )}
      {step === 'sent' && (
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <ShieldCheck className="size-5" />
          </span>
          <p className="text-[14px] leading-relaxed text-stone-600">
            Your request has been sent to your administrator. When they give you a reset code, choose <b className="text-ink">Enter reset code</b>.
          </p>
        </div>
      )}
      {step === 'code' && (
        <div className="space-y-4">
          <Field label="Email" required>
            {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Reset code" required>
            {(id) => <Input id={id} autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8 characters" className="font-mono tracking-[0.2em]" maxLength={12} />}
          </Field>
          <Field label="New password" required hint="At least 8 characters with an uppercase letter and a number">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
          </Field>
        </div>
      )}
      {step === 'done' && <p className="text-[14px] leading-relaxed text-stone-600">Your password has been changed and other devices were signed out. Sign in with your new password.</p>}
    </Modal>
  );
}

export default function LoginPage() {
  const { login, bootError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const meta = useMeta();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [forgot, setForgot] = useState(false);
  const isDemo = meta.data?.mode === 'demo';
  const unreachable = meta.isError;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const errs: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Enter your password';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const user = await login(email, password, remember);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : homeFor(user.role), {
        replace: true,
      });
    } catch (err: any) {
      setErrors({ form: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-white">
      {/* Brand panel */}
      <section className="relative hidden w-[46%] max-w-[720px] flex-col overflow-hidden bg-brand-950 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_15%_10%,rgb(15_81_50/0.85),transparent_70%),radial-gradient(60%_50%_at_100%_100%,rgb(197_157_9/0.12),transparent_70%)]" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255/0.6)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.6)_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative flex flex-1 flex-col px-12 pt-10 pb-8 xl:px-16">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Starwiz Realty — Your Trust, Our Vision" className="size-14 rounded-xl shadow-lg ring-1 ring-gold-400/30" />
            <div>
              <p className="text-[15px] font-extrabold">{BRAND.company}</p>
              <p className="text-[11.5px] font-semibold tracking-[0.1em] text-gold-300/90 uppercase">{BRAND.product}</p>
            </div>
          </div>
          <div className="mt-auto pt-16">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-300/25 bg-gold-300/10 px-3 py-1 text-[12px] font-semibold text-gold-200">
              <span className="size-1.5 rounded-full bg-gold-400" /> Your Trust. Our Vision.
            </p>
            <h1 className="font-display text-[44px] leading-[1.06] font-semibold tracking-[-0.02em] xl:text-[52px]">
              Manage Every Property.
              <br />
              Every Lead.
              <br />
              <span className="text-gold-300">Every Deal.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-brand-100/75">{BRAND.tagline} Leads, site visits, bookings, payments and installments for Starwiz Green Valley — in one connected workspace.</p>
            <ul className="mt-8 grid max-w-lg grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] text-brand-100/85">
              {[
                [Building2, 'Plots, villas, apartments & shops'],
                [CalendarCheck2, 'Follow-ups and site visits'],
                [IndianRupee, 'Installments & receipts'],
                [ShieldCheck, 'Role-based team access'],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Building2;
                return (
                  <li key={i} className="flex items-center gap-2.5">
                    <I className="size-4 text-gold-300" />
                    {text as string}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="relative mt-10 text-gold-300/45">
            <Skyline />
          </div>
          <div className="mt-6 flex items-center justify-between text-[12px] text-brand-200/55">
            <span>Nigohan–Samesi Road, Mohanlalganj, Lucknow</span>
            <PoweredBy tone="dark" />
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-10 lg:hidden">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-9" />
            <div className="leading-tight">
              <p className="text-[14px] font-extrabold">{BRAND.company}</p>
              <p className="text-[11px] font-semibold tracking-[0.08em] text-gold-600 uppercase">{BRAND.product}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[400px]">
            <h2 className="font-display text-[30px] font-semibold tracking-[-0.02em] text-ink">Welcome back</h2>
            <p className="mt-1.5 text-[14.5px] text-stone-500">Sign in to your EstateFlow workspace.</p>

            {(errors.form || bootError || unreachable) && (
              <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13.5px] font-medium text-red-700" role="alert">
                {errors.form || bootError || 'The server is not reachable right now. Please try again in a moment.'}
              </div>
            )}

            <form onSubmit={submit} noValidate className="mt-6 space-y-4">
              <Field label="Email" error={errors.email}>
                {(id, invalid) => <Input id={id} type="email" autoComplete="username" value={email} aria-invalid={invalid} onChange={(e) => setEmail(e.target.value)} placeholder="you@starwizrealty.com" autoFocus />}
              </Field>
              <Field
                label={
                  <span className="flex w-full items-center justify-between">
                    Password
                    <button type="button" onClick={() => setForgot(true)} className="text-[12.5px] font-semibold text-brand-700 hover:text-brand-900">
                      Forgot password?
                    </button>
                  </span>
                }
                error={errors.password}
              >
                {(id, invalid) => (
                  <div className="relative">
                    <Input id={id} type={show ? 'text' : 'password'} autoComplete="current-password" value={password} aria-invalid={invalid} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                    <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-stone-400 hover:text-stone-700" aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                )}
              </Field>
              <Checkbox label="Keep me signed in" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy}>
                Sign in <ArrowRight />
              </Button>
            </form>

            {isDemo && (
              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-stone-200" />
                  <span className="flex items-center gap-1.5 text-[11.5px] font-bold tracking-[0.08em] text-stone-400 uppercase">
                    <KeyRound className="size-3.5" /> Demo access
                  </span>
                  <span className="h-px flex-1 bg-stone-200" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {DEMO_ACCOUNTS.map((a) => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => {
                        setEmail(a.email);
                        setPassword(a.password);
                        setErrors({});
                      }}
                      className={cn('rounded-[10px] border px-2.5 py-2 text-left transition-colors', email === a.email ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/15' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50')}
                    >
                      <span className="block text-[12.5px] font-bold text-ink">{a.role}</span>
                      <span className="block truncate text-[11px] text-stone-500">{a.email}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2.5 text-[12px] text-stone-400">Shown on the demo environment only. Click a role, then sign in.</p>
              </div>
            )}

            <p className="mt-8 flex items-start gap-2 text-[12.5px] leading-relaxed text-stone-500">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-stone-400" />
              Customers sign in from the EstateFlow mobile app to see their property, payments and receipts.
            </p>
          </div>
        </div>
        <footer className="flex flex-col items-center gap-1 px-5 pb-6 text-center sm:flex-row sm:justify-between sm:px-10">
          <p className="text-[12px] text-stone-400">
            © {new Date().getFullYear()} {BRAND.company} Pvt. Ltd.
          </p>
          <PoweredBy />
        </footer>
      </section>
      <ForgotPassword open={forgot} onClose={() => setForgot(false)} initialEmail={email} />
    </div>
  );
}
