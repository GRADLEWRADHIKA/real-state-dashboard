import { useMemo } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Map as MapIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { inrShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Tooltip } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import type { PlotMapUnit, Property } from '@/types';
import { holdLabel } from './HoldForms';

/** Tile colours per status. "Reserved" is called "Hold" on the plot map, as the sales team does. */
const STATUS: Record<string, { label: string; tile: string; dot: string }> = {
  Available: { label: 'Available', tile: 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200', dot: 'bg-emerald-500' },
  Reserved: { label: 'Hold', tile: 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200', dot: 'bg-amber-500' },
  Booked: { label: 'Booked', tile: 'border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200', dot: 'bg-sky-500' },
  Sold: { label: 'Sold', tile: 'border-red-300 bg-red-100 text-red-900 hover:bg-red-200', dot: 'bg-red-500' },
};
const ORDER = ['Available', 'Reserved', 'Booked', 'Sold'];

export interface PlotMapFilters {
  q?: string;
  type?: string;
  status?: string;
  project?: string;
  block?: string;
}

/** Colour-coded layout of every unit, grouped by project then block. Filters apply client-side. */
export function PlotMap({ filters }: { filters: PlotMapFilters }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['properties', 'map'],
    queryFn: () => api.get<{ data: PlotMapUnit[] }>('/properties/map'),
  });
  // The map endpoint has no hold details; units on hold are few, so fetch them separately for the tooltip.
  const holds = useQuery({
    queryKey: ['properties', 'holds'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { status: 'Reserved', limit: 500 }).then((r) => new Map(r.data.map((p) => [p.id, p]))),
  });

  const units = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    return (data?.data ?? []).filter(
      (u) =>
        (!filters.type || u.type === filters.type) &&
        (!filters.status || u.status === filters.status) &&
        (!filters.project || u.project === filters.project) &&
        (!filters.block || u.block === filters.block) &&
        (!q || u.unit_number.toLowerCase().includes(q) || u.project.toLowerCase().includes(q) || (u.customer_name ?? '').toLowerCase().includes(q)),
    );
  }, [data, filters.q, filters.type, filters.status, filters.project, filters.block]);

  const groups = useMemo(() => {
    const projects = new Map<string, Map<string, PlotMapUnit[]>>();
    for (const u of units) {
      const blocks = projects.get(u.project) ?? new Map<string, PlotMapUnit[]>();
      const key = u.block?.trim() || '';
      blocks.set(key, [...(blocks.get(key) ?? []), u]);
      projects.set(u.project, blocks);
    }
    return [...projects.entries()].map(([project, blocks]) => ({
      project,
      total: [...blocks.values()].reduce((n, b) => n + b.length, 0),
      blocks: [...blocks.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'en', { numeric: true }))),
    }));
  }, [units]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of units) c[u.status] = (c[u.status] ?? 0) + 1;
    return c;
  }, [units]);

  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading) return <Skeleton className="h-96 rounded-[14px]" />;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <span className="label-xs">Legend</span>
        {ORDER.map((s) => (
          <span key={s} className="flex items-center gap-2 text-[13px] font-semibold text-stone-700">
            <span className={cn('size-3.5 rounded-[4px]', STATUS[s].dot)} />
            {STATUS[s].label}
            <span className="num rounded-full bg-stone-100 px-1.5 text-[11.5px] text-stone-600">{counts[s] ?? 0}</span>
          </span>
        ))}
        <span className="text-[13px] text-stone-500 sm:ml-auto">
          <b className="text-ink">{units.length}</b> units
        </span>
      </Card>

      {!groups.length ? (
        <Card>
          <EmptyState icon={<MapIcon />} title="No units to show" message="Adjust the filters, or give units a block in the property form." />
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.project} className="p-4 sm:p-5">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h3 className="truncate text-[15px] font-bold tracking-[-0.01em] text-ink">{g.project}</h3>
              <span className="shrink-0 text-[12.5px] text-stone-500">{g.total} units</span>
            </div>
            <div className="space-y-4">
              {g.blocks.map(([block, list]) => (
                <div key={block || '—'}>
                  {(g.blocks.length > 1 || block) && <p className="mb-2 text-[12px] font-bold tracking-wide text-stone-500 uppercase">{block ? `Block ${block}` : 'No block'}</p>}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(3.25rem,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))]">
                    {list.map((u) => {
                      const st = STATUS[u.status] ?? STATUS.Sold;
                      const hold = u.status === 'Reserved' ? holds.data?.get(u.id) : undefined;
                      const holdText = hold ? holdLabel(hold) : null;
                      return (
                        <Tooltip
                          key={u.id}
                          content={
                            <span className="block">
                              <b>
                                {u.unit_number} · {st.label}
                              </b>
                              <br />
                              {u.area_sqft.toLocaleString('en-IN')} sq ft · {inrShort(u.price)}
                              {u.customer_name && (
                                <>
                                  <br />
                                  {u.customer_name}
                                </>
                              )}
                              {holdText && (
                                <>
                                  <br />
                                  {holdText}
                                  {hold?.hold_lead_name ? ` · ${hold.hold_lead_name}` : ''}
                                </>
                              )}
                            </span>
                          }
                        >
                          <Link
                            to={`/properties/${u.id}`}
                            aria-label={`${u.unit_number}, ${st.label}, ${u.area_sqft} sq ft, ${inrShort(u.price)}${u.customer_name ? `, ${u.customer_name}` : ''}`}
                            className={cn('flex aspect-square min-w-0 items-center justify-center rounded-lg border px-1 text-center text-[12px] leading-tight font-bold transition-colors focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:outline-none', st.tile)}
                          >
                            <span className="truncate">{u.unit_number}</span>
                          </Link>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
