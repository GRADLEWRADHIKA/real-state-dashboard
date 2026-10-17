import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal, useConfirm } from '@/components/ui/Modal';
import type { IssuedResetCode, ResetRequest } from '@/types';

/** Shows a freshly issued reset code. It is never retrievable again once closed. */
export function IssuedCodeModal({ issued, onClose }: { issued: IssuedResetCode | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Copy failed. Select the code and copy it manually.');
    }
  };
  return (
    <Modal
      open={!!issued}
      onClose={onClose}
      size="sm"
      title="Reset code issued"
      description={issued ? `For ${issued.user.name} · ${issued.user.email}` : ''}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {issued && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
            <span data-testid="reset-code" className="num text-[24px] font-extrabold tracking-[0.18em] text-brand-900 select-all">
              {issued.code}
            </span>
            <Button size="icon-sm" variant="ghost" aria-label="Copy code" icon={copied ? <Check /> : <Copy />} onClick={copy} />
          </div>
          <p className="text-[13px] text-stone-600">
            Read this code to the user in person or over the phone. They enter it on the sign-in screen under <b>Forgot password</b>. It expires at <b>{fmtDateTime(issued.expires_at)}</b> and works once.
          </p>
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-[12.5px] text-amber-800">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            This is the only time the code is shown. Closing this window hides it for good; issue a new code if it is lost.
          </div>
        </div>
      )}
    </Modal>
  );
}

const STATUS_TONE: Record<ResetRequest['status'], 'amber' | 'blue' | 'green' | 'gray'> = { Pending: 'amber', Issued: 'blue', Completed: 'green', Dismissed: 'gray' };

/** Queue of "forgot password" requests. Admins see every account, managers see sales and customers. */
export function ResetRequestsPanel() {
  const confirm = useConfirm();
  const [issued, setIssued] = useState<IssuedResetCode | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reset-requests'],
    queryFn: () => api.get<{ data: ResetRequest[]; meta: { pending: number } }>('/users/reset-requests'),
  });
  const issue = useAction((id: number) => api.post<IssuedResetCode>(`/users/reset-requests/${id}/issue`), { invalidate: [['reset-requests']], onSuccess: setIssued });
  const dismiss = useAction((id: number) => api.post(`/users/reset-requests/${id}/dismiss`), { success: 'Request dismissed', invalidate: [['reset-requests']] });

  const columns: Column<ResetRequest>[] = [
    {
      key: 'user',
      header: 'Account',
      cell: (r) => (
        <div>
          <p className="font-semibold whitespace-nowrap text-ink">{r.user_name ?? 'Unknown account'}</p>
          <p className="text-[12px] text-stone-400">{r.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (r) => (r.user_role ? ROLE_LABEL[r.user_role] : '—'),
    },
    {
      key: 'note',
      header: 'Note',
      cell: (r) => <span className="text-stone-500">{r.note || '—'}</span>,
    },
    {
      key: 'requested',
      header: 'Requested',
      cell: (r) => (
        <span className="whitespace-nowrap text-stone-500" title={fmtDateTime(r.requested_at)}>
          {timeAgo(r.requested_at)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <div>
          <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
          {r.status === 'Issued' && r.code_expires_at && (
            <p className="mt-0.5 text-[11.5px] text-stone-400">
              by {r.issued_by_name} · expires {fmtDateTime(r.code_expires_at)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'Pending' || r.status === 'Issued' ? (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              disabled={dismiss.isPending}
              onClick={async () =>
                (await confirm({
                  title: 'Dismiss this request?',
                  message: 'Any code already issued for it stops working.',
                  confirmLabel: 'Dismiss',
                })) && dismiss.mutate(r.id)
              }
            >
              Dismiss
            </Button>
            <Button size="sm" variant="primary" icon={<KeyRound />} loading={issue.isPending && issue.variables === r.id} disabled={!r.user_id} onClick={() => issue.mutate(r.id)}>
              {r.status === 'Issued' ? 'Issue new code' : 'Issue code'}
            </Button>
          </div>
        ) : null,
    },
  ];

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <>
      <DataTable
        rows={data?.data ?? []}
        columns={columns}
        rowKey={(r) => r.id}
        loading={isLoading}
        mobileCard={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[14px] font-bold text-ink">{r.user_name ?? r.email}</p>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-[12.5px] text-stone-500">
              {r.email} · {timeAgo(r.requested_at)}
            </p>
            {(r.status === 'Pending' || r.status === 'Issued') && (
              <Button className="mt-2" size="sm" variant="primary" icon={<KeyRound />} disabled={!r.user_id} onClick={() => issue.mutate(r.id)}>
                Issue code
              </Button>
            )}
          </div>
        )}
        empty={<EmptyState icon={<KeyRound />} title="No reset requests" message="When someone taps “Forgot password” on the sign-in screen, the request lands here." />}
      />
      <IssuedCodeModal issued={issued} onClose={() => setIssued(null)} />
    </>
  );
}
