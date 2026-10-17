import { createContext, useCallback, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Renders the body inside a <form>; footer buttons with type="submit" submit it. */
  onSubmit?: (e: FormEvent) => void;
}

const widths = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', onSubmit }: ModalProps) {
  const Body = onSubmit ? 'form' : 'div';
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed z-50 flex max-h-[92dvh] w-full flex-col bg-white shadow-pop focus:outline-none',
            'inset-x-0 bottom-0 rounded-t-2xl data-[state=open]:animate-slide-up',
            'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[88vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
            widths[size],
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stone-200 sm:hidden" />
          <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 pt-4 pb-3.5 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-0.5 text-[13px] text-stone-500">{description}</Dialog.Description> : <Dialog.Description className="sr-only">Dialog</Dialog.Description>}
            </div>
            <Dialog.Close asChild>
              <button className="-mr-1.5 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700" aria-label="Close">
                <X className="size-[18px]" />
              </button>
            </Dialog.Close>
          </div>
          <Body
            className="flex min-h-0 flex-1 flex-col"
            {...(onSubmit
              ? {
                  onSubmit: (e: FormEvent) => {
                    e.preventDefault();
                    onSubmit(e);
                  },
                  noValidate: true,
                }
              : {})}
          >
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="safe-bottom flex flex-col-reverse gap-2 border-t border-stone-100 bg-stone-50/60 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6 sm:pb-3.5">{footer}</div>}
          </Body>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Confirmation dialog (promise based) ────────────────────────────────
interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
}
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>(undefined);
  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => (resolver.current = resolve));
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };
  const danger = (opts?.tone ?? 'danger') === 'danger';
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog.Root open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-stone-950/40 data-[state=open]:animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-pop data-[state=open]:animate-slide-up focus:outline-none">
            <div className="flex gap-3.5">
              <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', danger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700')}>
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0 pt-0.5">
                <Dialog.Title className="text-[16px] font-bold text-ink">{opts?.title}</Dialog.Title>
                <Dialog.Description asChild>
                  <div className="mt-1 text-[13.5px] leading-relaxed text-stone-600">{opts?.message}</div>
                </Dialog.Description>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button variant={danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {opts?.confirmLabel ?? 'Confirm'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmCtx.Provider>
  );
}
