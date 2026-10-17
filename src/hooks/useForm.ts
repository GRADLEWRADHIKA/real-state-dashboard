import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

type Errors<T> = Partial<Record<keyof T | 'form', string>>;

/**
 * Small controlled-form helper: values, per-field errors, client validation and
 * mapping of server validation messages ("field: message") back onto fields.
 */
export function useForm<T extends Record<string, any>>(initial: T, validate?: (v: T) => Errors<T>) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [busy, setBusy] = useState(false);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const bind = <K extends keyof T>(key: K) => ({
    value: (values[key] ?? '') as any,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as T[K]),
    'aria-invalid': !!errors[key],
  });

  const submit = async (fn: (v: T) => Promise<unknown>) => {
    const errs = validate?.(values) ?? {};
    const clean = Object.fromEntries(Object.entries(errs).filter(([, v]) => v)) as Errors<T>;
    setErrors(clean);
    if (Object.keys(clean).length) {
      toast.error('Please fix the highlighted fields');
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[role=dialog] [aria-invalid=true], form [aria-invalid=true]');
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus({ preventScroll: true });
      });
      return false;
    }
    setBusy(true);
    try {
      await fn(values);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      const m = /^([a-z_]+): (.+)$/.exec(msg);
      if (err instanceof ApiError && m && m[1] in values)
        setErrors({
          [m[1]]: m[2].charAt(0).toUpperCase() + m[2].slice(1),
        } as Errors<T>);
      toast.error(m ? `${m[1].replace(/_/g, ' ')} ${m[2]}`.replace(/^\w/, (c) => c.toUpperCase()) : msg);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    values,
    setValues,
    set,
    bind,
    errors,
    setErrors,
    busy,
    submit,
    reset: () => setValues(initial),
  };
}

export const required = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? 'This field is required' : undefined);
export const validPhone = (v: string) => (!/^\+?[0-9 ()-]{8,16}$/.test(v.trim()) ? 'Enter a valid phone number' : undefined);
export const validEmail = (v?: string | null) => (v && !/^\S+@\S+\.\S+$/.test(v) ? 'Enter a valid email' : undefined);
