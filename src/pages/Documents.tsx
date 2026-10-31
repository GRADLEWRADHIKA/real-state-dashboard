import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DOCUMENT_TYPES } from '@/lib/utils';
import { useDebounce, usePagedFilters } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, FilterSelect, SearchInput, Select } from '@/components/ui/Form';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { DocumentList, UploadDocumentModal } from '@/components/domain/Documents';
import { Pagination } from '@/components/ui/Table';
import type { Customer, DocumentItem, Lead, Paged, Property } from '@/types';
import { useUser, can } from '@/lib/auth';
import { PRIVATE_FOLDERS, type PrivateFolder } from '@estateflow/shared';

type Entity = 'lead' | 'customer' | 'property';

function PickEntity({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: Entity, id: number) => void }) {
  const user = useUser();
  const [type, setType] = useState<Entity>('customer');
  const [id, setId] = useState('');
  const [find, setFind] = useState('');
  const dfind = useDebounce(find);
  // Records are looked up by search, so every record can be picked however many there are.
  const opts = useQuery({
    queryKey: ['entity-options', type, dfind],
    enabled: open,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const q = dfind || undefined;
      if (type === 'lead')
        return (
          await api.get<Paged<Lead>>('/leads', {
            q,
            limit: 50,
            sort: 'name',
            order: 'asc',
          })
        ).data.map((l) => ({ id: l.id, label: `${l.name} · ${l.code}` }));
      if (type === 'customer')
        return (
          await api.get<Paged<Customer>>('/customers', {
            q,
            limit: 50,
            sort: 'name',
            order: 'asc',
          })
        ).data.map((c) => ({
          id: c.id,
          label: `${c.name} · ${c.property_project} ${c.property_unit}`,
        }));
      return (await api.get<{ data: Property[] }>('/properties', { q, limit: 50 })).data.map((p) => ({
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
                setFind('');
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
        <Field label="Record" hint="Type a name, code, phone or unit to find it. The first 50 matches are listed.">
          {(fid) => (
            <div className="space-y-2">
              <SearchInput value={find} onChange={setFind} placeholder={`Search ${type}s…`} />
              <Select id={fid} value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">{opts.isLoading ? 'Loading…' : opts.data?.length ? 'Select' : 'No matches'}</option>
                {opts.data?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </Field>
      </div>
    </Modal>
  );
}

type Tab = 'all' | 'customer' | 'lead' | 'property' | 'deal' | PrivateFolder;

export default function Documents() {
  const user = useUser();
  const privateOpen = user.role === 'admin' || user.role === 'accounts';
  const [entity, setEntity] = useState<Tab>('all');
  const folder = PRIVATE_FOLDERS.find((f) => f.key === entity);
  const [privateUpload, setPrivateUpload] = useState(false);
  const [docType, setDocType] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [pick, setPick] = useState(false);
  const [target, setTarget] = useState<{ type: Entity; id: number } | null>(null);
  const [page, setPage] = usePagedFilters([entity, docType, dq]);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['documents', entity, docType, dq, page],
    queryFn: () =>
      folder
        ? api.get<Paged<DocumentItem>>('/vault', { folder: folder.key, doc_type: docType || undefined, q: dq || undefined, page, limit: 50 })
        : api.get<Paged<DocumentItem>>('/documents', {
            entity_type: entity === 'all' ? undefined : entity,
            doc_type: docType,
            q: dq,
            page,
            limit: 50,
          }),
    placeholderData: keepPreviousData,
  });
  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle={folder ? `${folder.title} documents · ${folder.note}. Never shown to customers or sales staff.` : 'KYC, agreements, booking forms and property documents in one secure place'}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Documents' }]}
        actions={
          <Button variant="primary" icon={<Upload />} onClick={() => (folder ? setPrivateUpload(true) : setPick(true))}>
            {folder ? `Upload to ${folder.title}` : 'Upload document'}
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <Tabs
          className="px-4 pt-1 sm:px-5"
          value={entity}
          onChange={(v) => {
            setEntity(v);
            setDocType('');
          }}
          tabs={[
            { value: 'all', label: 'All documents' },
            { value: 'customer', label: 'Customers' },
            { value: 'lead', label: 'Leads' },
            { value: 'property', label: 'Properties' },
            { value: 'deal', label: 'Deals' },
            ...(privateOpen ? PRIVATE_FOLDERS.map((f) => ({ value: f.key, label: f.title })) : []),
          ]}
        />
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search file name…" className="sm:w-72" />
          <FilterSelect value={docType} onChange={setDocType} placeholder="All document types" options={folder ? [...folder.types] : [...DOCUMENT_TYPES]} className="sm:w-52" />
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
            showEntity={!folder}
            emptyAction={
              <Button variant="primary" icon={<Upload />} onClick={() => (folder ? setPrivateUpload(true) : setPick(true))}>
                {folder ? `Upload to ${folder.title}` : 'Upload document'}
              </Button>
            }
          />
        )}
        {data && <Pagination meta={data.meta} onPage={setPage} />}
      </Card>
      <PickEntity
        open={pick}
        onClose={() => setPick(false)}
        onPick={(type, id) => {
          setPick(false);
          setTarget({ type, id });
        }}
      />
      {folder && privateUpload && (
        <UploadDocumentModal
          open
          onClose={() => setPrivateUpload(false)}
          entityType={folder.key}
          entityId={0}
          endpoint="/vault"
          fields={{ folder: folder.key }}
          types={folder.types}
          defaultType={folder.types[0]}
          title={`Upload to ${folder.title}`}
          description={`${folder.note}. PDF, images, Word, Excel or CSV up to 10 MB.`}
        />
      )}
      {target && <UploadDocumentModal open onClose={() => setTarget(null)} entityType={target.type} entityId={target.id} defaultType={target.type === 'property' ? 'Property Documents' : 'Other'} />}
    </div>
  );
}
