import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BedDouble, Building2, Compass, LayoutGrid, List, Map as MapIcon, Plus, Ruler, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { can, useUser } from '@/lib/auth';
import { inrShort } from '@/lib/format';
import { PROPERTY_STATUSES, PROPERTY_TYPES, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Form';
import { PropertyStatusBadge } from '@/components/ui/Badge';
import { PageHeader, Segmented } from '@/components/ui/Misc';
import { DataTable, type Column } from '@/components/ui/Table';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PropertyArt } from '@/components/domain/PropertyArt';
import { PropertyCover } from '@/components/domain/PropertyGallery';
import { PropertyFormModal } from '@/components/domain/PropertyForm';
import { PlotMap } from '@/components/domain/PlotMap';
import type { Paged, Property } from '@/types';

type PropertiesResponse = Paged<
  Property,
  {
    summary: { status: string; n: number; value: number }[];
    projects: {
      project: string;
      location: string;
      type: string;
      units: number;
      available: number;
      min_price: number;
      max_price: number;
    }[];
    blocks?: string[];
  }
>;

type View = 'grid' | 'list' | 'map';

const PRICE = [
  { value: '0-3000000', label: 'Under ₹30 L' },
  { value: '3000000-6000000', label: '₹30 L – ₹60 L' },
  { value: '6000000-10000000', label: '₹60 L – ₹1 Cr' },
  { value: '10000000-', label: 'Above ₹1 Cr' },
];

export default function PropertiesList() {
  const user = useUser();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('ef_prop_view') as View) || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const get = (k: string) => params.get(k) ?? '';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const [pmin, pmax] = get('price').split('-');
  const query = {
    q: dq,
    type: get('type'),
    status: get('status'),
    project: get('project'),
    block: get('block'),
    price_min: pmin || undefined,
    price_max: pmax || undefined,
  };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['properties', query],
    queryFn: () => api.get<PropertiesResponse>('/properties', { ...query, limit: 500 }),
    placeholderData: keepPreviousData,
  });
  const summary = Object.fromEntries((data?.meta.summary ?? []).map((s) => [s.status, s]));
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('ef_prop_view', v);
    } catch {
      /* ignore */
    }
  };

  const columns = useMemo<Column<Property>[]>(
    () => [
      {
        key: 'unit',
        header: 'Property',
        cell: (p) => (
          <div className="flex items-center gap-3">
            <PropertyCover property={p} className="h-10 w-14 shrink-0 overflow-hidden rounded-lg" sizes="64px" />
            <div className="min-w-0">
              <p className="font-semibold whitespace-nowrap text-ink">{p.name}</p>
              <p className="text-[12px] text-stone-400">{p.code}</p>
            </div>
          </div>
        ),
      },
      {
        key: 'project',
        header: 'Project',
        cell: (p) => <span className="whitespace-nowrap text-stone-700">{p.project}</span>,
      },
      {
        key: 'unit_number',
        header: 'Unit',
        cell: (p) => <span className="font-semibold whitespace-nowrap text-ink">{p.unit_number}</span>,
      },
      { key: 'type', header: 'Type', cell: (p) => p.type },
      {
        key: 'area',
        header: 'Area',
        align: 'right',
        cell: (p) => <span className="num whitespace-nowrap">{p.area_sqft.toLocaleString('en-IN')} sq ft</span>,
      },
      {
        key: 'price',
        header: 'Price',
        align: 'right',
        cell: (p) => <span className="num font-bold whitespace-nowrap text-ink">{inrShort(p.price)}</span>,
      },
      {
        key: 'status',
        header: 'Status',
        cell: (p) => <PropertyStatusBadge status={p.status} />,
      },
      {
        key: 'agent',
        header: 'Salesperson',
        cell: (p) => <span className="whitespace-nowrap text-stone-600">{p.agent_name ?? '—'}</span>,
      },
      {
        key: 'interest',
        header: 'Interested',
        align: 'right',
        cell: (p) => <span className="num">{p.interested_count ?? 0}</span>,
      },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        title="Properties"
        subtitle="Inventory across every project — plots, villas, apartments and commercial units"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Properties' }]}
        actions={
          <>
            <Segmented
              value={view}
              onChange={changeView}
              options={[
                {
                  value: 'grid',
                  label: <span className="sr-only sm:not-sr-only">Grid</span>,
                  icon: <LayoutGrid />,
                },
                {
                  value: 'list',
                  label: <span className="sr-only sm:not-sr-only">List</span>,
                  icon: <List />,
                },
                {
                  value: 'map',
                  label: <span className="sr-only sm:not-sr-only">Map</span>,
                  icon: <MapIcon />,
                },
              ]}
            />
            {can.editProperties(user.role) && (
              <Button variant="primary" icon={<Plus />} onClick={() => setParam('new', '1')}>
                Add property
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PROPERTY_STATUSES.map((s) => (
          <button key={s} onClick={() => setParam('status', get('status') === s ? '' : s)} className={cn('card flex items-center justify-between p-4 text-left transition-shadow hover:shadow-pop', get('status') === s && 'ring-2 ring-brand-600/40')}>
            <div>
              <p className="text-[12.5px] font-semibold text-stone-500">{s}</p>
              <p className="mt-1 text-[24px] font-extrabold tracking-tight text-ink">{summary[s]?.n ?? 0}</p>
              <p className="text-[12px] text-stone-400">{inrShort(summary[s]?.value ?? 0)} value</p>
            </div>
            <PropertyStatusBadge status={s} />
          </button>
        ))}
      </div>

      {!!data?.meta.projects.length && (
        <div className="scroll-thin -mx-1 mb-5 flex gap-3 overflow-x-auto px-1 pb-1">
          {data.meta.projects.map((p) => (
            <button
              key={p.project}
              onClick={() => setParam('project', get('project') === p.project ? '' : p.project)}
              className={cn('card flex min-w-[240px] flex-1 items-center gap-3 p-3 text-left transition-shadow hover:shadow-pop', get('project') === p.project && 'ring-2 ring-brand-600/40')}
            >
              <PropertyArt type={p.type} project={p.project} className="size-14 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-bold text-ink">{p.project}</p>
                <p className="text-[12px] text-stone-500">
                  {p.available} of {p.units} available
                </p>
                <p className="text-[12px] font-semibold text-stone-700">
                  {inrShort(p.min_price)} – {inrShort(p.max_price)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search unit, project, code…" className="sm:w-72" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect value={get('type')} onChange={(v) => setParam('type', v)} placeholder="All types" options={[...PROPERTY_TYPES]} />
          <FilterSelect value={get('status')} onChange={(v) => setParam('status', v)} placeholder="Any status" options={[...PROPERTY_STATUSES]} />
          {(!!data?.meta.blocks?.length || !!get('block')) && <FilterSelect value={get('block')} onChange={(v) => setParam('block', v)} placeholder="All blocks" options={(data?.meta.blocks ?? [get('block')]).map((b) => ({ value: b, label: `Block ${b}` }))} />}
          {view !== 'map' && <FilterSelect value={get('price')} onChange={(v) => setParam('price', v)} placeholder="Any price" options={PRICE} />}
        </div>
        {view !== 'map' && (
          <p className="text-[13px] text-stone-500 sm:ml-auto">
            <b className="text-ink">{data?.meta.total ?? 0}</b> units
          </p>
        )}
      </div>

      {view === 'map' ? (
        <PlotMap filters={{ q: dq, type: get('type'), status: get('status'), project: get('project'), block: get('block') }} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-[14px]" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState
            icon={<Building2 />}
            title="No properties found"
            message="Adjust the filters or add a new unit to the inventory."
            action={
              can.editProperties(user.role) ? (
                <Button variant="primary" icon={<Plus />} onClick={() => setParam('new', '1')}>
                  Add property
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.data.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`} className="card group overflow-hidden transition-shadow hover:shadow-pop">
              <div className="relative">
                <PropertyCover property={p} className="h-44 overflow-hidden" sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw" badge />
                <PropertyStatusBadge status={p.status} className="absolute top-3 left-3 bg-white/90 backdrop-blur" />
                <span className="absolute top-3 right-3 rounded-md bg-white/90 px-2 py-0.5 text-[11.5px] font-bold text-stone-700 backdrop-blur">{p.type}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-ink group-hover:text-brand-800">{p.name}</p>
                    <p className="truncate text-[12.5px] text-stone-500">
                      {p.project} · <b className="font-semibold text-stone-700">{p.unit_number}</b>
                    </p>
                  </div>
                  <p className="shrink-0 text-[17px] font-extrabold text-ink">{inrShort(p.price)}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-stone-600">
                  <span className="flex items-center gap-1">
                    <Ruler className="size-3.5 text-stone-400" />
                    {p.area_sqft.toLocaleString('en-IN')} sq ft
                  </span>
                  {p.bedrooms ? (
                    <span className="flex items-center gap-1">
                      <BedDouble className="size-3.5 text-stone-400" />
                      {p.bedrooms} BHK
                    </span>
                  ) : null}
                  {p.facing && (
                    <span className="flex items-center gap-1">
                      <Compass className="size-3.5 text-stone-400" />
                      {p.facing}
                    </span>
                  )}
                </div>
                <div className="mt-3.5 flex items-center justify-between border-t border-stone-100 pt-3 text-[12px]">
                  <span className="text-stone-500">{p.customer_name ? `Booked by ${p.customer_name}` : (p.agent_name ?? 'Unassigned')}</span>
                  <span className="flex items-center gap-1 font-semibold text-stone-600">
                    <Users className="size-3.5" /> {p.interested_count ?? 0} interested
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <DataTable
            rows={data.data}
            columns={columns}
            rowKey={(p) => p.id}
            onRowClick={(p) => navigate(`/properties/${p.id}`)}
            mobileCard={(p) => (
              <div className="flex gap-3">
                <PropertyCover property={p} className="h-16 w-20 shrink-0 overflow-hidden rounded-lg" sizes="96px" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[14px] font-bold text-ink">
                      {p.project.replace('Green Valley ', 'GV ')} · {p.unit_number}
                    </p>
                    <PropertyStatusBadge status={p.status} />
                  </div>
                  <p className="text-[12.5px] text-stone-500">{p.name}</p>
                  <p className="mt-1 text-[13px] font-bold text-ink">{inrShort(p.price)}</p>
                </div>
              </div>
            )}
          />
        </Card>
      )}
      <PropertyFormModal open={get('new') === '1'} onClose={() => setParam('new', '')} onSaved={(p) => navigate(`/properties/${p.id}`)} />
    </div>
  );
}
