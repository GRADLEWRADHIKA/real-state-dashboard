import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-[10px] border border-stone-200 bg-white px-3 text-[14px] text-ink shadow-[inset_0_1px_1px_rgb(28_27_24/0.03)] placeholder:text-stone-400 transition-colors hover:border-stone-300 focus:border-brand-600 focus:outline-none focus:ring-[3px] focus:ring-brand-600/12 disabled:bg-stone-50 disabled:text-stone-500 aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/15';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode }>(function Input({ className, prefix, ...rest }, ref) {
  if (prefix) {
    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[14px] text-stone-400">{prefix}</span>
        <input ref={ref} className={cn(control, 'h-10 pl-7', className)} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={cn(control, 'h-10', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'resize-y py-2.5 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, 'h-10 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone-400" />
    </div>
  );
});

interface FieldProps {
  label?: ReactNode;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (id: string, invalid: boolean) => ReactNode;
}
/** Label + control + error/hint, with ids wired for accessibility. */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-[13px] font-semibold text-stone-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children(id, !!error)}
      {error ? <p className="text-[12.5px] font-medium text-red-600">{error}</p> : hint ? <p className="text-[12.5px] text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700 select-none', className)}>
      <input type="checkbox" className="size-4 cursor-pointer rounded border-stone-300 accent-brand-700" {...rest} />
      {label}
    </label>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-stone-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cn(control, 'h-10 pr-8 pl-9 sm:h-9')} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Compact filter dropdown used in list toolbars. */
export function FilterSelect({ value, onChange, placeholder, options, className }: { value: string; onChange: (v: string) => void; placeholder: string; options: (string | { value: string; label: string })[]; className?: string }) {
  const active = value !== '';
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className={cn(
          'h-10 w-full appearance-none rounded-[10px] border pr-8 pl-3 text-[13px] font-semibold transition-colors focus:outline-none focus:ring-[3px] focus:ring-brand-600/12 sm:h-9',
          active ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <ChevronDown className={cn('pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2', active ? 'text-brand-700' : 'text-stone-400')} />
    </div>
  );
}

/** Indian-format money input: shows grouping while typing, returns a number. */
export function MoneyInput({
  value,
  onChange,
  ...rest
}: {
  value: number | '' | null | undefined;
  onChange: (v: number | '') => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'prefix'>) {
  const shown = value === '' || value === null || value === undefined ? '' : Number(value).toLocaleString('en-IN');
  return (
    <Input
      inputMode="numeric"
      prefix="₹"
      value={shown}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        onChange(digits ? Number(digits) : '');
      }}
      {...rest}
    />
  );
}
