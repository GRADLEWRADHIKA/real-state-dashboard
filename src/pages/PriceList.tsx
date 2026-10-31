import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, IndianRupee, Plus, Tags } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { fmtDate, todayStr } from '@/lib/format';
import { useAction } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, FilterSelect, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Misc';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type Column } from '@/components/ui/Table';
import type { PriceBlock, PriceListEntry, PriceListResponse } from '@/types';

const rupees = (n?: number | null) => (n || n === 0 ? `₹${n.toLocaleString('en-IN')}` : '—');
const blockKey = (b: { project: string; block: string }) => `${b.project}\u0000${b.block}`;
const blockName = (b: { project: string; block: string }) => `${b.project}${b.block ? ` · Block ${b.block}` : ''}`;

function SetRateModal({ open, onClose, blocks, initial }: { open: boolean; onClose: () => void; blocks: PriceBlock[]; initial?: PriceBlock | null }) {
  const f = useForm(
    {
      key: initial ? blockKey(initial) : '',
      rate_per_sqft: '' as number | '',
      effective_from: todayStr(),
      note: '',
      apply_to_unsold: true,
    },
    (v) => ({
      key: required(v.key) && 'Choose a project and block',
      rate_per_sqft: !v.rate_per_sqft ? 'Enter the new rate' : undefined,
      effective_from: required(v.effective_from),
    }),
  );
  useEffect(() => {
    if (open) f.setValues({ key: initial ? blockKey(initial) : '', rate_per_sqft: '', effective_from: todayStr(), note: '', apply_to_unsold: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);
  const chosen = blocks.find((b) => blockKey(b) === f.values.key);
  const future = f.values.effective_from > todayStr();
  const save = useAction((body: Record<string, unknown>) => api.post<PriceListEntry>('/price-list', body), {
    success: (r) => (r.units_updated ? `New rate saved. ${r.units_updated} unsold unit${r.units_updated === 1 ? '' : 's'} re-priced.` : 'New rate saved'),
    onSuccess: onClose,
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Set new rate"
      description="Every change is kept in the history. Booked and sold units keep the price they were sold at."
      onSubmit={() =>
        f.submit((v) =>
          save.mutateAsync({
            project: chosen!.project,
            block: chosen!.block,
            rate_per_sqft: Number(v.rate_per_sqft),
            effective_from: v.effective_from,
            note: v.note.trim() || null,
            apply_to_unsold: v.apply_to_unsold,
          }),
        )
      }
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            Save rate
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Project and block" required error={f.errors.key} className="sm:col-span-2">
          {(id) => (
            <Select id={id} {...f.bind('key')}>
              <option value="">Choose…</option>
              {blocks.map((b) => (
                <option key={blockKey(b)} value={blockKey(b)}>
                  {blockName(b)} ({b.unsold} unsold of {b.units})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Rate per sq ft" required error={f.errors.rate_per_sqft} hint={chosen ? `Now ${chosen.min_rate === chosen.max_rate ? rupees(chosen.min_rate) : `${rupees(chosen.min_rate)} – ${rupees(chosen.max_rate)}`}` : undefined}>
          {(id) => <MoneyInput id={id} value={f.values.rate_per_sqft} onChange={(v) => f.set('rate_per_sqft', v)} aria-invalid={!!f.errors.rate_per_sqft} />}
        </Field>
        <Field label="Effective from" required error={f.errors.effective_from}>
          {(id) => <Input id={id} type="date" {...f.bind('effective_from')} />}
        </Field>
        <Field label="Note" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={2} placeholder="e.g. Diwali revision" {...f.bind('note')} />}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox label="Re-price unsold units now" checked={f.values.apply_to_unsold} onChange={(e) => f.set('apply_to_unsold', e.target.checked)} />
          <p className="mt-1 pl-6 text-[12.5px] text-stone-500">
            {future
              ? 'The date is in the future, so units are not re-priced now.'
              : chosen
                ? `Available and on-hold units in ${blockName(chosen)} (${chosen.unsold}) get price = new rate × area.`
                : 'Available and on-hold units get price = new rate × area.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default function PriceList() {
  const user = useUser();
  const canEdit = user.role === 'admin' || user.role === 'manager';
  const [project, setProject] = useState('');
  const [modal, setModal] = useState<{ block: PriceBlock | null } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['price-list', project],
    queryFn: () => api.get<PriceListResponse>('/price-list', { project: project || undefined }),
  });
  const blocks = data?.meta.blocks ?? [];
  const current = useMemo(() => new Map((data?.meta.current ?? []).map((e) => [blockKey(e), e])), [data]);
  const projects = useMemo(() => [...new Set(blocks.map((b) => b.project))], [blocks]);
  const shownBlocks = project ? blocks.filter((b) => b.project === project) : blocks;

  const blockCols: Column<PriceBlock>[] = [
    { key: 'project', header: 'Project', cell: (b) => <span className="font-semibold whitespace-nowrap text-ink">{b.project}</span> },
    { key: 'block', header: 'Block', cell: (b) => (b.block ? b.block : <span className="text-stone-400">—</span>) },
    {
      key: 'current',
      header: 'Price-list rate',
      align: 'right',
      cell: (b) => {
        const e = current.get(blockKey(b));
        return e ? (
          <div className="whitespace-nowrap">
            <p className="num font-bold text-ink">{rupees(e.rate_per_sqft)}/sq ft</p>
            <p className="text-[12px] text-stone-400">since {fmtDate(e.effective_from)}</p>
          </div>
        ) : (
          <span className="text-stone-400">Not set</span>
        );
      },
    },
    {
      key: 'range',
      header: 'Unit rates now',
      align: 'right',
      cell: (b) => <span className="num whitespace-nowrap text-stone-600">{b.min_rate === b.max_rate ? rupees(b.min_rate) : `${rupees(b.min_rate)} – ${rupees(b.max_rate)}`}</span>,
    },
    {
      key: 'units',
      header: 'Unsold / units',
      align: 'right',
      cell: (b) => (
        <span className="num whitespace-nowrap">
          <b className="text-ink">{b.unsold}</b> <span className="text-stone-400">/ {b.units}</span>
        </span>
      ),
    },
    ...(canEdit
      ? [
          {
            key: 'act',
            header: '',
            align: 'right' as const,
            cell: (b: PriceBlock) => (
              <Button size="sm" variant="ghost" onClick={() => setModal({ block: b })}>
                Set rate
              </Button>
            ),
          },
        ]
      : []),
  ];

  const historyCols: Column<PriceListEntry>[] = [
    { key: 'date', header: 'Effective from', cell: (e) => <span className="whitespace-nowrap">{fmtDate(e.effective_from)}</span> },
    { key: 'block', header: 'Project / block', cell: (e) => <span className="font-semibold whitespace-nowrap text-ink">{blockName(e)}</span> },
    { key: 'rate', header: 'Rate', align: 'right', cell: (e) => <span className="num font-bold whitespace-nowrap text-ink">{rupees(e.rate_per_sqft)}/sq ft</span> },
    {
      key: 'units',
      header: 'Re-priced',
      align: 'right',
      cell: (e) => (e.units_updated ? <Badge tone="green">{e.units_updated} units</Badge> : <span className="text-stone-400">—</span>),
    },
    { key: 'note', header: 'Note', cell: (e) => <span className="text-stone-600">{e.note ?? '—'}</span> },
    { key: 'by', header: 'Set by', cell: (e) => <span className="whitespace-nowrap text-stone-500">{e.created_by_name ?? '—'}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Price list"
        subtitle="Rate per sq ft for each project and block, with every change kept"
        crumbs={[{ label: 'Properties', to: '/properties' }, { label: 'Price list' }]}
        actions={
          <>
            <FilterSelect value={project} onChange={setProject} placeholder="All projects" options={projects} className="w-48" />
            {canEdit && (
              <Button variant="primary" icon={<Plus />} onClick={() => setModal({ block: null })} disabled={!blocks.length}>
                Set new rate
              </Button>
            )}
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <CardHeader title="Blocks" subtitle="Rate in effect today and units still for sale" icon={<Tags />} />
            <DataTable
              rows={shownBlocks}
              columns={blockCols}
              rowKey={blockKey}
              loading={isLoading}
              mobileCard={(b) => {
                const e = current.get(blockKey(b));
                return (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[14px] font-bold text-ink">{blockName(b)}</p>
                      <p className="text-[12.5px] text-stone-500">
                        {b.unsold} unsold of {b.units}
                      </p>
                    </div>
                    <p className="num text-[14px] font-bold text-ink">{e ? `${rupees(e.rate_per_sqft)}/sq ft` : 'Not set'}</p>
                  </div>
                );
              }}
              empty={<EmptyState compact icon={<IndianRupee />} title="No units in inventory" />}
            />
          </Card>
          <Card className="overflow-hidden">
            <CardHeader title="History" subtitle="Newest first" icon={<History />} />
            <DataTable
              rows={data?.data ?? []}
              columns={historyCols}
              rowKey={(e) => e.id}
              loading={isLoading}
              mobileCard={(e) => (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-bold text-ink">{blockName(e)}</p>
                    <p className="num font-bold text-ink">{rupees(e.rate_per_sqft)}</p>
                  </div>
                  <p className="text-[12.5px] text-stone-500">
                    From {fmtDate(e.effective_from)}
                    {e.units_updated ? ` · ${e.units_updated} units re-priced` : ''}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
              )}
              empty={<EmptyState compact icon={<History />} title="No rates set yet" message={canEdit ? 'Set a rate for a block to start the price list.' : undefined} />}
            />
          </Card>
        </div>
      )}
      {canEdit && <SetRateModal open={!!modal} onClose={() => setModal(null)} blocks={blocks} initial={modal?.block} />}
    </div>
  );
}
