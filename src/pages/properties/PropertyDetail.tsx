import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, Bath, CalendarCheck2, Car, Check, Compass, History, Layers, MapPin, Pencil, Ruler, Trash2, Upload, Users, KeyRound, LayoutGrid, IndianRupee } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { fmtDate, fmtTime, inr, inrShort, relativeDay } from '@/lib/format';
import { useAction } from '@/hooks/queries';
import { Card, CardHeader, InfoRow } from '@/components/ui/Card';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PropertyStatusBadge, StatusBadge } from '@/components/ui/Badge';
import { PageHeader, Progress } from '@/components/ui/Misc';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/Feedback';
import { useConfirm } from '@/components/ui/Modal';
import { PropertyFormModal } from '@/components/domain/PropertyForm';
import { GalleryManager, GalleryViewer } from '@/components/domain/PropertyGallery';
import { DocumentList, UploadDocumentModal } from '@/components/domain/Documents';
import type { DocumentItem, Property, PropertyHistoryEntry, SiteVisit } from '@/types';

type Detail = Property & {
  generating?: boolean;
  leads: {
    id: number;
    code: string;
    name: string;
    phone: string;
    status: string;
    priority: string;
    budget: number;
    next_followup?: string;
    agent_name?: string;
  }[];
  customer: {
    id: number;
    code: string;
    name: string;
    phone: string;
    booking_date: string;
    total_value: number;
    paid: number;
    status: string;
    deal_code: string;
    deal_stage: string;
    agent_name: string;
  } | null;
  visits: (SiteVisit & { lead_name: string })[];
  documents: DocumentItem[];
  history?: PropertyHistoryEntry[];
};

export default function PropertyDetail() {
  const { id } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(false);
  const [upload, setUpload] = useState(false);
  const {
    data: p,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get<Detail>(`/properties/${id}`),
  });
  const del = useAction(() => api.delete(`/properties/${id}`), {
    success: 'Property deleted',
    onSuccess: () => navigate('/properties'),
  });
  if (isLoading) return <PageSkeleton stats={0} />;
  if (error || !p) return <ErrorState error={error} onRetry={refetch} />;
  const rate = p.rate_per_sqft || Math.round(p.price / p.area_sqft);
  const history = p.history ?? [];
  const specs = [
    p.block ? { icon: LayoutGrid, label: 'Block', value: p.block } : null,
    {
      icon: Ruler,
      label: 'Area',
      value: `${p.area_sqft.toLocaleString('en-IN')} sq ft`,
    },
    p.rate_per_sqft ? { icon: IndianRupee, label: 'Rate per sq ft', value: `₹${p.rate_per_sqft.toLocaleString('en-IN')}` } : null,
    p.bedrooms ? { icon: BedDouble, label: 'Bedrooms', value: `${p.bedrooms} BHK` } : null,
    p.bathrooms ? { icon: Bath, label: 'Bathrooms', value: p.bathrooms } : null,
    p.facing ? { icon: Compass, label: 'Facing', value: p.facing } : null,
    p.floor !== null && p.floor !== undefined && p.type !== 'Plot' && p.type !== 'Villa'
      ? {
          icon: Layers,
          label: 'Floor',
          value: p.floor === 0 ? 'Ground' : p.floor,
        }
      : null,
    p.parking
      ? {
          icon: Car,
          label: 'Parking',
          value: `${p.parking} slot${p.parking > 1 ? 's' : ''}`,
        }
      : null,
    p.possession ? { icon: KeyRound, label: 'Possession', value: p.possession } : null,
  ].filter(Boolean) as {
    icon: typeof Ruler;
    label: string;
    value: string | number;
  }[];

  return (
    <div>
      <PageHeader
        crumbs={[{ label: 'Properties', to: '/properties' }, { label: `${p.project} · ${p.unit_number}` }]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {p.name} <PropertyStatusBadge status={p.status} className="text-[12px]" />
          </span>
        }
        subtitle={
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5" /> {p.project} · Unit {p.unit_number} · {p.location}, {p.city}
          </span>
        }
        actions={
          can.editProperties(user.role) && (
            <>
              <Button icon={<Upload />} onClick={() => setUpload(true)}>
                Upload
              </Button>
              <Button icon={<Pencil />} onClick={() => setEdit(true)}>
                Edit
              </Button>
              {user.role === 'admin' && !p.customer && (
                <Button
                  size="icon"
                  aria-label="Delete property"
                  icon={<Trash2 />}
                  className="hover:text-red-600"
                  onClick={async () => {
                    if (
                      await confirm({
                        title: 'Delete this property?',
                        message: `${p.project} ${p.unit_number} will be removed from inventory.`,
                        confirmLabel: 'Delete',
                      })
                    )
                      del.mutate(undefined);
                  }}
                />
              )}
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Card className="overflow-hidden">
            <GalleryViewer property={p} />
            <div className="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="label-xs">Specifications</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {specs.map((s) => (
                    <div key={s.label} className="rounded-xl border border-stone-100 bg-stone-50/70 p-3">
                      <s.icon className="size-4 text-brand-700" />
                      <p className="mt-2 text-[11.5px] font-semibold text-stone-500">{s.label}</p>
                      <p className="text-[14px] font-bold text-ink">{s.value}</p>
                    </div>
                  ))}
                </div>
                {p.description && <p className="mt-5 text-[14px] leading-relaxed text-stone-600">{p.description}</p>}
              </div>
              <div className="rounded-2xl bg-brand-950 p-5 text-white lg:w-60">
                <p className="text-[12px] font-semibold text-brand-200/70">List price</p>
                <p className="mt-1 text-[28px] font-extrabold tracking-tight">{inrShort(p.price)}</p>
                <p className="num text-[13px] text-brand-100/80">{inr(p.price)}</p>
                <p className="mt-3 text-[12.5px] text-gold-300">₹{rate.toLocaleString('en-IN')} / sq ft</p>
                {p.rera_number && <p className="mt-3 text-[11.5px] text-brand-200/60">RERA {p.rera_number}</p>}
              </div>
            </div>
          </Card>
          {can.editProperties(user.role) && (
            <Card>
              <CardHeader title="Gallery" subtitle="Drag to reorder. The first image a visitor sees is the cover." />
              <div className="p-5 pt-0">
                <GalleryManager property={p} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Amenities" />
            <div className="flex flex-wrap gap-2 px-5 pb-5">
              {p.amenities.length ? (
                p.amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50/60 px-3 py-1.5 text-[12.5px] font-semibold text-brand-900">
                    <Check className="size-3.5 text-brand-600" />
                    {a}
                  </span>
                ))
              ) : (
                <p className="text-[13px] text-stone-500">No amenities listed.</p>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Interested leads" subtitle={`${p.leads.length} leads have shown interest in this unit`} icon={<Users />} />
            {p.leads.length ? (
              <ul className="divide-y divide-stone-100 border-t border-stone-100">
                {p.leads.map((l) => (
                  <li key={l.id}>
                    <Link to={`/leads/${l.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-stone-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold text-ink">{l.name}</p>
                        <p className="text-[12px] text-stone-500">
                          {l.code} · {l.agent_name ?? 'Unassigned'}
                        </p>
                      </div>
                      <span className="hidden text-[13px] font-bold text-ink sm:block">{inrShort(l.budget)}</span>
                      <span className="hidden w-24 text-right text-[12px] text-stone-500 md:block">{l.next_followup ? relativeDay(l.next_followup) : '—'}</span>
                      <StatusBadge status={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<Users />} title="No interested leads yet" />
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Availability & booking" />
            <div className="px-5 pb-5">
              {p.customer ? (
                <div>
                  <Link to={`/customers/${p.customer.id}`} className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 p-3.5 hover:border-stone-200">
                    <div>
                      <p className="text-[14px] font-bold text-ink">{p.customer.name}</p>
                      <p className="text-[12px] text-stone-500">
                        {p.customer.code} · {p.customer.deal_code}
                      </p>
                    </div>
                    <StatusBadge status={p.customer.deal_stage} />
                  </Link>
                  <dl className="mt-4 grid grid-cols-2 gap-4">
                    <InfoRow label="Booked on">{fmtDate(p.customer.booking_date)}</InfoRow>
                    <InfoRow label="Deal value">{inrShort(p.customer.total_value)}</InfoRow>
                    <InfoRow label="Collected">{inrShort(p.customer.paid)}</InfoRow>
                    <InfoRow label="Sold by">{p.customer.agent_name}</InfoRow>
                  </dl>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-stone-500">
                      <span>Payment progress</span>
                      <span className="text-ink">{Math.round((p.customer.paid / p.customer.total_value) * 100)}%</span>
                    </div>
                    <Progress value={(p.customer.paid / p.customer.total_value) * 100} />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                  <p className="text-[14px] font-bold text-emerald-900">{p.status === 'Reserved' ? 'Reserved — token received' : 'Available for booking'}</p>
                  <p className="mt-1 text-[13px] text-emerald-800/80">Convert an interested lead to book this unit and generate the payment schedule.</p>
                  {p.leads.length > 0 && (
                    <ButtonLink to={`/leads/${p.leads[0].id}`} size="sm" variant="primary" className="mt-3">
                      Open top lead
                    </ButtonLink>
                  )}
                </div>
              )}
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-4">
                <InfoRow label="Property code">{p.code}</InfoRow>
                <InfoRow label="Type">{p.type}</InfoRow>
                <InfoRow label="Block">{p.block}</InfoRow>
                <InfoRow label="Phase / tower">{p.tower}</InfoRow>
                <InfoRow label="Rate per sq ft">{p.rate_per_sqft ? `₹${p.rate_per_sqft.toLocaleString('en-IN')}` : null}</InfoRow>
                <InfoRow label="Salesperson">{p.agent_name}</InfoRow>
              </dl>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Plot history" subtitle="Everyone who has booked this unit, newest first" icon={<History />} />
            {history.length ? (
              <ol className="px-5 pb-4">
                {history.map((h, i) => {
                  const body = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13.5px] font-semibold text-ink">{h.customer_name}</p>
                          <p className="text-[12px] text-stone-500">
                            {[h.customer_code, `Booked ${fmtDate(h.booking_date)}`, inrShort(h.total_value)].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <StatusBadge status={h.status} />
                      </div>
                      <p className="mt-1 text-[12px] text-stone-500">
                        {h.agent_name ? `Sold by ${h.agent_name}` : 'No salesperson'}
                        {h.status !== 'Cancelled' && h.registry_status && ` · Registry ${h.registry_status === 'Date fixed' && h.registry_date ? `on ${fmtDate(h.registry_date)}` : h.registry_status.toLowerCase()}`}
                      </p>
                      {h.status === 'Cancelled' && (
                        <p className="mt-1 text-[12px] text-red-700">
                          Cancelled{h.cancelled_at ? ` ${fmtDate(h.cancelled_at)}` : ''}
                          {h.cancel_reason ? ` — ${h.cancel_reason}` : ''}
                        </p>
                      )}
                    </>
                  );
                  return (
                    <li key={`${h.customer_id}-${i}`} className="border-t border-stone-100 py-2.5 first:border-0">
                      {h.customer_code ? (
                        <Link to={`/customers/${h.customer_id}`} className="-mx-2 block rounded-lg px-2 py-1 hover:bg-stone-50">
                          {body}
                        </Link>
                      ) : (
                        <div className="py-1">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState compact icon={<History />} title="No bookings yet" message="When this unit is booked, the buyer appears here." />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent site visits" icon={<CalendarCheck2 />} />
            {p.visits.length ? (
              <ul className="px-5 pb-4">
                {p.visits.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 border-t border-stone-100 py-2.5 first:border-0">
                    <div className="min-w-0">
                      <Link to={`/leads/${v.lead_id}`} className="block truncate text-[13px] font-semibold text-ink hover:text-brand-800">
                        {v.lead_name}
                      </Link>
                      <p className="text-[12px] text-stone-500">
                        {fmtDate(v.visit_date)} · {fmtTime(v.visit_time)}
                      </p>
                    </div>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={<CalendarCheck2 />} title="No visits yet" />
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Documents"
              action={
                can.editProperties(user.role) && (
                  <Button size="sm" variant="ghost" icon={<Upload />} onClick={() => setUpload(true)}>
                    Upload
                  </Button>
                )
              }
            />
            <DocumentList docs={p.documents} canDelete={can.editProperties(user.role)} />
          </Card>
        </div>
      </div>
      <PropertyFormModal open={edit} onClose={() => setEdit(false)} property={p} />
      <UploadDocumentModal open={upload} onClose={() => setUpload(false)} entityType="property" entityId={p.id} defaultType="Property Documents" />
    </div>
  );
}
