import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BadgeIndianRupee, CircleCheck, Pencil, Phone, UserRound, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDate, inr, inrShort } from '@/lib/format';
import { telHref } from '@/lib/utils';
import { Card, CardHeader, InfoRow } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Avatar, PageHeader } from '@/components/ui/Misc';
import { DataTable } from '@/components/ui/Table';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { StatCard } from '@/components/charts/Charts';
import { BrokerFormModal, PayCommissionModal, useCommissionColumns } from '@/pages/Brokers';
import type { Broker, BrokerCommission } from '@/types';

interface BrokerCustomer {
  id: number;
  code: string;
  name: string;
  booking_date?: string | null;
  total_value: number;
  status: string;
}

export default function BrokerDetail() {
  const { id } = useParams();
  const me = useUser();
  const canEdit = me.role === 'admin' || me.role === 'manager';
  const canPay = me.role === 'admin' || me.role === 'accounts';
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState<BrokerCommission | null>(null);
  const { data: b, isLoading, error, refetch } = useQuery({
    queryKey: ['brokers', 'detail', id],
    queryFn: () => api.get<Broker & { customers: BrokerCustomer[]; commissions: BrokerCommission[] }>(`/brokers/${id}`),
  });
  const columns = useCommissionColumns(canPay ? setPaying : null, false);

  if (isLoading) return <PageSkeleton stats={3} />;
  if (error || !b) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader
        title={b.name}
        subtitle={[b.firm, `${b.commission_pct}% commission`].filter(Boolean).join(' · ')}
        crumbs={[{ label: 'Brokers', to: '/brokers' }, { label: b.name }]}
        actions={
          <>
            {b.phone && (
              <a href={telHref(b.phone)}>
                <Button icon={<Phone />}>Call</Button>
              </a>
            )}
            {canEdit && (
              <Button variant="primary" icon={<Pencil />} onClick={() => setEditing(true)}>
                Edit broker
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="Customers" value={b.customers_count ?? b.customers.length} icon={<Users />} caption="Bookings brought in" />
        <StatCard label="Commission due" value={inrShort(b.commission_due ?? 0)} icon={<BadgeIndianRupee />} accent="gold" caption="Still to be paid" />
        <StatCard label="Commission paid" value={inrShort(b.commission_paid ?? 0)} icon={<CircleCheck />} caption="Paid out so far" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-3 px-5 pt-5">
              <Avatar name={b.name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-ink">{b.name}</p>
                <StatusBadge status={b.status} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 p-5">
              <InfoRow label="Phone">{b.phone}</InfoRow>
              <InfoRow label="Firm">{b.firm}</InfoRow>
              <InfoRow label="Commission">{b.commission_pct}%</InfoRow>
              <InfoRow label="Since">{fmtDate(b.created_at)}</InfoRow>
              {b.notes && (
                <InfoRow label="Notes" className="col-span-2">
                  <span className="font-normal whitespace-pre-wrap">{b.notes}</span>
                </InfoRow>
              )}
            </dl>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="Customers" subtitle="Bookings this broker brought in" icon={<UserRound />} />
            {b.customers.length ? (
              <ul className="divide-y divide-stone-100 border-t border-stone-100">
                {b.customers.map((c) => (
                  <li key={c.id}>
                    <Link to={`/customers/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-ink">{c.name}</p>
                        <p className="text-[12px] text-stone-400">
                          {c.code} · {fmtDate(c.booking_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="num text-[13px] font-bold text-ink">{inrShort(c.total_value)}</p>
                        <StatusBadge status={c.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Users />} title="No customers yet" message="Pick this broker on a customer to link the booking." />
            )}
          </Card>
        </div>
        <Card className="overflow-hidden">
          <CardHeader title="Commission" subtitle="Commission is created automatically when a broker’s customer pays." icon={<BadgeIndianRupee />} />
          <DataTable
            rows={b.commissions}
            columns={columns}
            rowKey={(c) => c.id}
            mobileCard={(c) => (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-bold text-ink">{c.customer_name}</p>
                    <p className="text-[12.5px] text-stone-500">
                      {c.pct}% of {inr(c.payment_amount)} · {fmtDate(c.payment_date)}
                    </p>
                  </div>
                  <span className="num text-[14.5px] font-extrabold text-ink">{inr(c.amount)}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <Badge tone={c.status === 'Paid' ? 'green' : 'amber'}>{c.status}</Badge>
                  {canPay && c.status === 'Due' && (
                    <Button size="sm" variant="subtle" onClick={() => setPaying(c)}>
                      Mark paid
                    </Button>
                  )}
                </div>
              </div>
            )}
            empty={<EmptyState compact icon={<BadgeIndianRupee />} title="No commission yet" message="It appears here when this broker’s customers pay." />}
          />
        </Card>
      </div>
      <BrokerFormModal open={editing} onClose={() => setEditing(false)} broker={b} />
      <PayCommissionModal commission={paying ? { ...paying, broker_name: b.name } : null} onClose={() => setPaying(null)} />
    </div>
  );
}
