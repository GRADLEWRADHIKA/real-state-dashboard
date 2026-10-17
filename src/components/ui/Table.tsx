import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from './Feedback';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortKey?: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export interface SortState {
  key: string;
  order: 'asc' | 'desc';
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSort?: (s: SortState) => void;
  selected?: Set<number>;
  onSelect?: (ids: Set<number>) => void;
  selectId?: (row: T) => number;
  mobileCard?: (row: T) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
}

/** Table on md+ screens, tappable card list on phones. */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, sort, onSort, selected, onSelect, selectId, mobileCard, loading, empty, className, rowClassName }: Props<T>) {
  const selectable = !!(selected && onSelect && selectId);
  const allIds = selectable ? rows.map(selectId!) : [];
  const allChecked = selectable && allIds.length > 0 && allIds.every((id) => selected!.has(id));
  const toggleAll = () => {
    if (!selectable) return;
    const next = new Set(selected);
    if (allChecked) allIds.forEach((id) => next.delete(id));
    else allIds.forEach((id) => next.add(id));
    onSelect!(next);
  };
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelect!(next);
  };
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  if (loading) {
    return (
      <div className={cn('divide-y divide-stone-100', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          </div>
        ))}
      </div>
    );
  }
  if (!rows.length) return <>{empty}</>;

  return (
    <div className={className}>
      {/* Phone: cards */}
      <ul className="divide-y divide-stone-100 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('flex gap-3 px-4 py-3.5', onRowClick && 'cursor-pointer active:bg-stone-50')}>
            {selectable && <input type="checkbox" aria-label="Select row" className="mt-1 size-4 accent-brand-700" checked={selected!.has(selectId!(row))} onClick={(e) => e.stopPropagation()} onChange={() => toggle(selectId!(row))} />}
            <div className="min-w-0 flex-1">{mobileCard ? mobileCard(row) : columns.slice(0, 3).map((c) => <div key={c.key}>{c.cell(row)}</div>)}</div>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="scroll-thin hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0 text-[13.5px]">
          <thead>
            <tr>
              {selectable && (
                <th className="sticky top-0 w-10 border-b border-stone-200 bg-stone-50/80 py-2.5 pl-5">
                  <input type="checkbox" aria-label="Select all" className="size-4 accent-brand-700" checked={allChecked} onChange={toggleAll} />
                </th>
              )}
              {columns.map((c, i) => {
                const active = sort && c.sortKey && sort.key === c.sortKey;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cn(
                      'sticky top-0 border-b border-stone-200 bg-stone-50/80 px-3 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap text-stone-500 uppercase',
                      align(c.align),
                      i === 0 && !selectable && 'pl-5',
                      i === columns.length - 1 && 'pr-5',
                      c.className,
                    )}
                  >
                    {c.sortKey && onSort ? (
                      <button
                        className={cn('inline-flex items-center gap-1 uppercase hover:text-stone-800', active && 'text-stone-800')}
                        onClick={() =>
                          onSort({
                            key: c.sortKey!,
                            order: active && sort!.order === 'desc' ? 'asc' : 'desc',
                          })
                        }
                      >
                        {c.header}
                        {active ? sort!.order === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = selectable ? selectId!(row) : undefined;
              const isSel = id !== undefined && selected!.has(id);
              return (
                <tr key={rowKey(row)} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn('group transition-colors', onRowClick && 'cursor-pointer', isSel ? 'bg-brand-50/60' : 'hover:bg-stone-50/80', rowClassName?.(row))}>
                  {selectable && (
                    <td className="border-b border-stone-100 py-3 pl-5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Select row" className="size-4 accent-brand-700" checked={isSel} onChange={() => toggle(id!)} />
                    </td>
                  )}
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('border-b border-stone-100 px-3 py-3 align-middle text-stone-700', align(c.align), i === 0 && !selectable && 'pl-5', i === columns.length - 1 && 'pr-5', c.className)}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({ meta, onPage, className }: { meta: { page: number; limit: number; total: number }; onPage: (p: number) => void; className?: string }) {
  const { page, limit: pageSize, total } = meta;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const nums: (number | '…')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[13px] font-semibold transition-colors';
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-stone-100 px-4 py-3 sm:px-5', className)}>
      <p className="text-[13px] text-stone-500">
        <span className="num font-semibold text-stone-700">
          {from}–{to}
        </span>{' '}
        of <span className="num font-semibold text-stone-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button className={cn(btn, 'text-stone-500 hover:bg-stone-100 disabled:opacity-40')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {nums.map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="hidden px-1 text-stone-400 sm:inline">
              …
            </span>
          ) : (
            <button key={n} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined} className={cn(btn, 'hidden sm:inline-flex', n === page ? 'bg-brand-800 text-white' : 'text-stone-600 hover:bg-stone-100')}>
              {n}
            </button>
          ),
        )}
        <span className="num px-2 text-[13px] font-semibold text-stone-600 sm:hidden">
          {page} / {pages}
        </span>
        <button className={cn(btn, 'text-stone-500 hover:bg-stone-100 disabled:opacity-40')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
