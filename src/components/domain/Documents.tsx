import { useRef, useState } from 'react';
import { Download, Eye, FileImage, FileSpreadsheet, FileText, Trash2, Upload } from 'lucide-react';
import { UPLOAD_ACCEPT } from '@estateflow/shared';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { fileSize, fmtDate } from '@/lib/format';
import { DOCUMENT_TYPES, cn } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Form';
import { Modal, useConfirm } from '@/components/ui/Modal';
import type { DocumentItem } from '@/types';

export function DocIcon({ mime, className }: { mime?: string | null; className?: string }) {
  const Icon = mime?.startsWith('image/') ? FileImage : mime?.includes('sheet') || mime?.includes('excel') ? FileSpreadsheet : FileText;
  const tone = mime === 'application/pdf' ? 'bg-red-50 text-red-600' : mime?.startsWith('image/') ? 'bg-sky-50 text-sky-700' : 'bg-stone-100 text-stone-600';
  return (
    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tone, className)}>
      <Icon className="size-[18px]" />
    </span>
  );
}

export function UploadDocumentModal({
  open,
  onClose,
  entityType,
  entityId,
  defaultType = 'Other',
  types = DOCUMENT_TYPES as readonly string[],
  accept = UPLOAD_ACCEPT,
  title = 'Upload document',
  description = 'PDF, images, Word, Excel, CSV or text up to 10 MB',
  success = 'Document uploaded',
}: {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: number;
  defaultType?: string;
  types?: readonly string[];
  /** File picker filter, e.g. "image/*" for a photo. */
  accept?: string;
  title?: string;
  description?: string;
  success?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState(defaultType);
  const [name, setName] = useState('');
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = useAction(
    () => {
      const fd = new FormData();
      fd.append('file', file!);
      fd.append('entity_type', entityType);
      fd.append('entity_id', String(entityId));
      fd.append('doc_type', docType);
      if (name.trim()) fd.append('name', name.trim());
      setProgress(0);
      return api.upload('/documents', fd, { onProgress: setProgress }).finally(() => setProgress(null));
    },
    {
      success,
      onSuccess: () => {
        setFile(null);
        setName('');
        onClose();
      },
    },
  );
  const pick = (f?: File | null) => {
    if (!f) return;
    if (accept.startsWith('image/') && !f.type.startsWith('image/')) return toast.error('Choose an image (JPG, PNG or WebP)');
    if (f.size > 10 * 1024 * 1024) return toast.error('File is larger than 10 MB');
    setFile(f);
    if (!name) setName(f.name);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      onSubmit={() => (file ? upload.mutate(undefined) : toast.error('Choose a file to upload'))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={upload.isPending} icon={<Upload />}>
            Upload
          </Button>
        </>
      }
    >
      <div
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files[0]);
        }}
        onClick={() => input.current?.click()}
        className={cn('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors', drag ? 'border-brand-500 bg-brand-50' : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50')}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <Upload className="size-5" />
        </span>
        {file ? (
          <>
            <p className="mt-3 text-[14px] font-bold text-ink">{file.name}</p>
            <p className="text-[12.5px] text-stone-500">{fileSize(file.size)} · click to change</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-[14px] font-bold text-ink">Drop a file here or click to browse</p>
            <p className="text-[12.5px] text-stone-500">Aadhaar, PAN, agreements, booking forms…</p>
          </>
        )}
        <input ref={input} type="file" hidden accept={accept} onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {progress !== null && (
        <div className="mt-3" role="progressbar" aria-label="Upload progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-brand-700 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-right text-[12px] text-stone-500">{Math.round(progress * 100)}%</p>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Document type">
          {(id) => (
            <Select id={id} value={docType} onChange={(e) => setDocType(e.target.value)}>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Display name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="File name" />}</Field>
      </div>
    </Modal>
  );
}

export function DocumentList({ docs, canDelete = true, showEntity, emptyAction }: { docs: DocumentItem[]; canDelete?: boolean; showEntity?: boolean; emptyAction?: React.ReactNode }) {
  const confirm = useConfirm();
  const del = useAction((id: number) => api.delete(`/documents/${id}`), {
    success: 'Document deleted',
  });
  if (!docs.length) return <EmptyState compact icon={<FileText />} title="No documents yet" message="Upload KYC, agreements and booking forms to keep everything in one place." action={emptyAction} />;
  return (
    <ul className="divide-y divide-stone-100">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <DocIcon mime={d.mime} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold text-ink">{d.name}</p>
            <p className="truncate text-[12px] text-stone-500">
              {showEntity && d.entity_name ? `${d.entity_name} · ` : ''}
              {d.uploaded_by_name ?? '—'} · {fmtDate(d.created_at)} · {fileSize(d.size)}
            </p>
          </div>
          <Badge tone="gray" dot={false} className="hidden sm:inline-flex">
            {d.doc_type}
          </Badge>
          {/^(application\/pdf|image\/)/.test(d.mime ?? '') && (
            <Button size="icon-sm" variant="ghost" aria-label={`Preview ${d.name}`} onClick={() => api.open(`/documents/${d.id}/download?inline=1`, d.name).catch((e) => toast.error(e.message))}>
              <Eye />
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={`Download ${d.name}`} onClick={() => api.download(`/documents/${d.id}/download`, d.name).catch((e) => toast.error(e.message))}>
            <Download />
          </Button>
          {canDelete && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${d.name}`}
              className="hover:text-red-600"
              onClick={async () => {
                if (
                  await confirm({
                    title: 'Delete document?',
                    message: `“${d.name}” will be permanently removed.`,
                    confirmLabel: 'Delete',
                  })
                )
                  del.mutate(d.id);
              }}
            >
              <Trash2 />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
