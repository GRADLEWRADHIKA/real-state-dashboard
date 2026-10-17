import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold' | 'subtle';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-semibold transition-[background,box-shadow,color,border-color] duration-150 disabled:pointer-events-none disabled:opacity-55 select-none';
const variants: Record<Variant, string> = {
  primary: 'bg-brand-800 text-white shadow-sm shadow-brand-950/10 hover:bg-brand-900 active:bg-brand-950',
  secondary: 'border border-stone-200 bg-white text-stone-800 shadow-card hover:border-stone-300 hover:bg-stone-50',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  gold: 'bg-gold-400 text-brand-950 shadow-sm hover:bg-gold-300',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
  md: 'h-10 px-3.5 text-sm sm:h-9 [&_svg]:size-4',
  lg: 'h-11 px-5 text-[15px] [&_svg]:size-[18px]',
  icon: 'size-10 sm:size-9 [&_svg]:size-[18px]',
  'icon-sm': 'size-8 [&_svg]:size-4',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {loading ? <LoaderCircle className="animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
