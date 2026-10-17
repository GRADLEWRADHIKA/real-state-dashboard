import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseCsv } from '@estateflow/shared';
import { api } from '@/lib/api';
import { cn, downloadCsv } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface ImportRow {
  row: number;
  status: 'ok' | 'error' | 'duplicate';
  errors: string[];
  data?: Record<string, unknown>;
}
interface ImportResult {
  summary: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    created: number;
  };
  rows: ImportRow[];
}

const TEMPLATE_COLUMNS = ['name', 'phone', 'email', 'location', 'source', 'budget', 'property_type', 'priority', 'requirement', 'assigned_email'];

/** CSV import: preview every row (errors, duplicates) on the server, then create the valid ones. */
export function LeadImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [skipDuplicates, setSkip] = useState(true);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName('');
    setRows([]);
    setPreview(null);
    if (input.current) input.current.value = '';
  };
  const close = () => {
    reset();
    onClose();
  };

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.rows.length) throw new Error('The file has no data rows');
      if (!parsed.headers.includes('name') || !parsed.headers.includes('phone')) throw new Error('The file needs at least "name" and "phone" columns');
      setFileName(file.name);
      setRows(parsed.rows);
      setPreview(
        await api.post<ImportResult>('/leads/import', {
          rows: parsed.rows,
          dryRun: true,
        }),
      );
    } catch (e: any) {
      toast.error(e.message);
      reset();
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const r = await api.post<ImportResult>('/leads/import', {
        rows,
        dryRun: false,
        skipDuplicates,
      });
      toast.success(`${r.summary.created} lead${r.summary.created === 1 ? '' : 's'} imported`);
      qc.invalidateQueries({ queryKey: ['leads'] });
      close();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const s = preview?.summary;
  const importable = s ? s.valid : 0;
  return (
    <Modal
      open={open}
      onClose={close}
      size="xl"
      title="Import leads from CSV"
      description="Rows are checked first. Nothing is saved until you confirm."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          {preview && (
            <Button variant="primary" loading={busy} disabled={!importable || !!s?.invalid} onClick={commit}>
              Import {importable} lead{importable === 1 ? '' : 's'}
            </Button>
          )}
        </>
      }
    >
      <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
      {!preview ? (
        <div className="space-y-4">
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 px-6 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40">
            <Upload className="size-7 text-brand-700" />
            <span className="text-[14px] font-semibold text-ink">{busy ? 'Checking rows…' : 'Choose a CSV file'}</span>
            <span className="text-[12.5px] text-stone-500">Up to 2,000 rows. Leads without an assignee follow the round-robin rule in Settings.</span>
          </button>
          <div className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3 text-[13px] text-stone-600">
            <span>
              Columns: <span className="font-mono text-[12px]">{TEMPLATE_COLUMNS.join(', ')}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              icon={<FileSpreadsheet />}
              onClick={() =>
                downloadCsv(
                  'lead-import-template.csv',
                  [
                    {
                      name: 'Ravi Kumar',
                      phone: '+91 98765 43210',
                      email: 'ravi@example.com',
                      location: 'Gomti Nagar, Lucknow',
                      source: 'Website',
                      budget: '4500000',
                      property_type: 'Plot',
                      priority: 'Warm',
                      requirement: '1200 sq ft plot',
                      assigned_email: '',
                    },
                  ],
                  TEMPLATE_COLUMNS.map((k) => ({ key: k, label: k })),
                )
              }
            >
              Template
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-semibold text-ink">{fileName}</span>
            <Badge tone="green">{s!.valid} ready</Badge>
            {s!.duplicates > 0 && <Badge tone="amber">{s!.duplicates} duplicates</Badge>}
            {s!.invalid > 0 && <Badge tone="red">{s!.invalid} with errors</Badge>}
            <button type="button" onClick={reset} className="ml-auto text-[12.5px] font-semibold text-brand-700">
              Choose another file
            </button>
          </div>
          {s!.invalid > 0 && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">Fix the rows with errors in your file and choose it again. Rows with errors are never imported.</p>}
          {s!.duplicates > 0 && <Checkbox label="Skip rows whose phone number already exists" checked={skipDuplicates} onChange={(e) => setSkip(e.target.checked)} />}
          <div className="scroll-thin max-h-[46vh] overflow-auto rounded-xl border border-stone-200">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-stone-50 text-left text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={cn('border-t border-stone-100', r.status === 'error' && 'bg-red-50/50', r.status === 'duplicate' && 'bg-amber-50/50')}>
                    <td className="px-3 py-1.5 text-stone-400">{r.row}</td>
                    <td className="px-3 py-1.5 font-medium text-ink">{String(r.data?.name ?? rows[r.row - 1]?.name ?? '')}</td>
                    <td className="px-3 py-1.5">{String(r.data?.phone ?? rows[r.row - 1]?.phone ?? '')}</td>
                    <td className="px-3 py-1.5">{String(r.data?.source ?? '')}</td>
                    <td className="px-3 py-1.5">{r.status === 'ok' ? <span className="text-brand-700">Ready</span> : <span className={r.status === 'error' ? 'text-red-700' : 'text-amber-700'}>{r.errors.join('; ')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
