import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DOCUMENT_TYPES } from '@/lib/utils';
import { useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, SearchInput, Select } from '@/components/ui/Form';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { DocumentList, UploadDocumentModal } from '@/components/domain/Documents';
import type { Customer, DocumentItem, Lead, Paged, Property } from '@/types';
import { useUser, can } from '@/lib/auth';

type Entity = 'lead' | 'customer' | 'property';

function PickEntity({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: Entity, id: number) => void }) {
  const user = useUser();
  const [type, setType] = useState<Entity>('customer');
  const [id, setId] = useState('');
  const opts = useQuery({
    queryKey: ['entity-options', type],
    enabled: open,
    queryFn: async () => {
      if (type === 'lead')
        return (
          await api.get<Paged<Lead>>('/leads', {
            limit: 500,
            sort: 'name',
            order: 'asc',
          })
        ).data.map((l) => ({ id: l.id, label: `${l.name} · ${l.code}` }));
      if (type === 'customer')
        return (
          await api.get<Paged<Customer>>('/customers', {
            limit: 500,
            sort: 'name',
            order: 'asc',
          })
        ).data.map((c) => ({
          id: c.id,
          label: `${c.name} · ${c.property_project} ${c.property_unit}`,
        }));
      return (await api.get<{ data: Property[] }>('/properties', { limit: 500 })).data.map((p) => ({
        id: p.id,
        label: `${p.project} · ${p.unit_number}`,
      }));
    },
  });
  const types: Entity[] = can.sales(user.role) ? ['customer', 'lead', 'property'] : ['customer', 'property'];
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Upload document"
      description="Choose where this document belongs"
      onSubmit={() => (id ? onPick(type, Number(id)) : toast.error('Select a record'))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Continue
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Attach to">
          {(fid) => (
            <Select
              id={fid}
              value={type}
              onChange={(e) => {
                setType(e.target.value as Entity);
                setId('');
              }}
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Record">
          {(fid) => (
            <Select id={fid} value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">{opts.isLoading ? 'Loading…' : 'Select'}</option>
              {opts.data?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

export default function Documents() {
  const [entity, setEntity] = useState<'all' | 'customer' | 'lead' | 'property' | 'deal'>('all');
  const [docType, setDocType] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [pick, setPick] = useState(false);
  const [target, setTarget] = useState<{ type: Entity; id: number } | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['documents', entity, docType, dq],
    queryFn: () =>
      api.get<Paged<DocumentItem>>('/documents', {
        entity_type: entity === 'all' ? undefined : entity,
        doc_type: docType,
        q: dq,
        limit: 500,
      }),
  });
  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="KYC, agreements, booking forms and property documents in one secure place"
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Documents' }]}
        actions={
          <Button variant="primary" icon={<Upload />} onClick={() => setPick(true)}>
            Upload document
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <Tabs
          className="px-4 pt-1 sm:px-5"
          value={entity}
          onChange={setEntity}
          tabs={[
            { value: 'all', label: 'All documents' },
            { value: 'customer', label: 'Customers' },
            { value: 'lead', label: 'Leads' },
            { value: 'property', label: 'Properties' },
            { value: 'deal', label: 'Deals' },
          ]}
        />
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search file name…" className="sm:w-72" />
          <FilterSelect value={docType} onChange={setDocType} placeholder="All document types" options={[...DOCUMENT_TYPES]} className="sm:w-52" />
          <p className="text-[13px] text-stone-500 sm:ml-auto">{data?.meta.total ?? 0} files</p>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <DocumentList
            docs={data?.data ?? []}
            showEntity
            emptyAction={
              <Button variant="primary" icon={<Upload />} onClick={() => setPick(true)}>
                Upload document
              </Button>
            }
          />
        )}
      </Card>
      <PickEntity
        open={pick}
        onClose={() => setPick(false)}
        onPick={(type, id) => {
          setPick(false);
          setTarget({ type, id });
        }}
      />
      {target && <UploadDocumentModal open onClose={() => setTarget(null)} entityType={target.type} entityId={target.id} defaultType={target.type === 'property' ? 'Property Documents' : 'Other'} />}
    </div>
  );
}
