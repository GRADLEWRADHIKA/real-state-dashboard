import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Globe, GripVertical, ImagePlus, Pencil, Sparkles, Star, Trash2, X } from 'lucide-react';
import { IMAGE_KINDS } from '@estateflow/shared';
import { sitePropertyPath } from '@estateflow/site';
import { api, serverUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, Select } from '@/components/ui/Form';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { PropertyArt } from './PropertyArt';
import type { Property, PropertyImage } from '@/types';

export const mediaUrl = (path: string) => `${serverUrl()}${path}`;
export const srcSet = (img: PropertyImage) => `${mediaUrl(img.urls.thumb)} 400w, ${mediaUrl(img.urls.medium)} 900w, ${mediaUrl(img.urls.large)} 1600w`;

export function AiBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur', className)}>
      <Sparkles className="size-3" /> Artist's impression
    </span>
  );
}

/** One gallery image: lazy, responsive, skeleton while loading, PropertyArt if it fails. */
export function GalleryImage({ img, fallback, className, sizes = '(min-width: 1280px) 30vw, 100vw', eager }: { img: PropertyImage | null | undefined; fallback: Pick<Property, 'type' | 'project' | 'id'>; className?: string; sizes?: string; eager?: boolean }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => setState('loading'), [img?.id]);
  if (!img || state === 'error') return <PropertyArt type={fallback.type} project={fallback.project} seed={fallback.id} className={className} />;
  return (
    <div className={cn('relative overflow-hidden bg-stone-100', state === 'loading' && 'animate-pulse', className)}>
      <img
        src={mediaUrl(img.urls.medium)}
        srcSet={srcSet(img)}
        sizes={sizes}
        alt={img.alt_text}
        width={img.width ?? undefined}
        height={img.height ?? undefined}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        className={cn('absolute inset-0 size-full object-cover transition-opacity duration-300', state === 'ok' ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}

/** The property's cover (or the line-art fallback). */
export function PropertyCover({ property, className, sizes, badge }: { property: Pick<Property, 'type' | 'project' | 'id' | 'cover'>; className?: string; sizes?: string; badge?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <GalleryImage img={property.cover} fallback={property} className="size-full" sizes={sizes} />
      {badge && property.cover?.is_ai_generated && <AiBadge className="absolute bottom-2 left-2" />}
    </div>
  );
}

/** Covers for every property, from one cached list request; used where a property is mentioned. */
export function usePropertyCovers() {
  const { data } = useQuery({
    queryKey: ['properties', 'covers'],
    queryFn: () => api.get<{ data: Property[] }>('/properties', { limit: 100 }),
    staleTime: 5 * 60_000,
  });
  return new Map((data?.data ?? []).map((p) => [p.id, p]));
}

export function PropertyThumb({ id, type, project, className }: { id?: number | null; type?: string | null; project?: string | null; className?: string }) {
  const covers = usePropertyCovers();
  if (!id) return null;
  const p = covers.get(id);
  return <PropertyCover property={p ?? { id, type: type ?? 'Apartment', project: project ?? '', cover: null }} className={cn('shrink-0 overflow-hidden', className ?? 'h-10 w-14 rounded-lg')} sizes={className ? '400px' : '64px'} />;
}

// ─── Viewer: hero carousel, thumbnail strip, keyboard lightbox ───────────
export function GalleryViewer({ property }: { property: Property }) {
  const images = property.images ?? [];
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const n = images.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  useEffect(() => {
    if (i >= n) setI(0);
  }, [i, n]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, go]);
  if (!n) return <PropertyArt type={property.type} project={property.project} seed={property.id} className="h-56 sm:h-80" label={`${property.unit_number} · ${property.tower ?? property.project}`} />;
  const cur = images[Math.min(i, n - 1)];
  return (
    <div>
      <div className="group relative h-56 sm:h-96">
        <button type="button" className="absolute inset-0 cursor-zoom-in" onClick={() => setOpen(true)} aria-label={`Open ${cur.alt_text} full screen`}>
          <GalleryImage img={cur} fallback={property} className="size-full" sizes="(min-width: 1280px) 60vw, 100vw" eager />
        </button>
        {cur.is_ai_generated && <AiBadge className="absolute bottom-3 left-3" />}
        {cur.caption && <span className="absolute right-3 bottom-3 rounded-md bg-black/50 px-2 py-0.5 text-[11.5px] text-white">{cur.caption}</span>}
        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute top-1/2 left-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow opacity-0 transition group-hover:opacity-100 focus:opacity-100">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-ink shadow opacity-0 transition group-hover:opacity-100 focus:opacity-100">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex gap-1.5 overflow-x-auto bg-stone-50 p-2" role="tablist" aria-label="Gallery">
          {images.map((img, k) => (
            <button key={img.id} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)} className={cn('h-14 w-20 shrink-0 overflow-hidden rounded-md ring-2 transition', k === i ? 'ring-brand-700' : 'ring-transparent opacity-75 hover:opacity-100')}>
              <GalleryImage img={img} fallback={property} className="size-full" sizes="80px" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-50 flex flex-col bg-black/92" onClick={() => setOpen(false)}>
          <div className="flex items-center justify-between p-3 text-white">
            <span className="text-[13px]">
              {i + 1} / {n} · {cur.caption ?? cur.alt_text}
            </span>
            <button type="button" aria-label="Close" className="grid size-9 place-items-center rounded-full hover:bg-white/10" onClick={() => setOpen(false)} autoFocus>
              <X className="size-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <img src={mediaUrl(cur.urls.large)} alt={cur.alt_text} className="max-h-full max-w-full object-contain" />
            {cur.is_ai_generated && <AiBadge className="absolute bottom-6 left-6" />}
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-4 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <ChevronLeft />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-4 grid size-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manager: upload, reorder, cover, edit, delete, generate, publish ────
type Upload = { name: string; progress: number; error?: string };

export function GalleryManager({ property }: { property: Property & { generating?: boolean } }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const images = property.images ?? [];
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const [editing, setEditing] = useState<PropertyImage | null>(null);
  const [order, setOrder] = useState<PropertyImage[]>(images);
  const [busy, setBusy] = useState(false);
  const dragId = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setOrder(images), [property.images]); // eslint-disable-line react-hooks/exhaustive-deps
  const refresh = () => qc.invalidateQueries({ queryKey: ['property'] }).then(() => qc.invalidateQueries({ queryKey: ['properties'] }));
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const list = files.map((f) => ({ name: f.name, progress: 0 }) as Upload);
    setUploads(list);
    // One request per file: each shows its own progress and its own error.
    for (const [k, f] of files.entries()) {
      const form = new FormData();
      form.append('files', f);
      try {
        const res = await api.upload<{ errors: { file: string; error: string }[] }>(`/properties/${property.id}/images`, form, {
          onProgress: (x) => setUploads((u) => u.map((it, j) => (j === k ? { ...it, progress: x } : it))),
        });
        setUploads((u) => u.map((it, j) => (j === k ? { ...it, progress: 1, error: res.errors?.[0]?.error } : it)));
      } catch (e) {
        setUploads((u) => u.map((it, j) => (j === k ? { ...it, error: e instanceof Error ? e.message : 'Upload failed' } : it)));
      }
    }
    await refresh();
    setTimeout(() => setUploads((u) => u.filter((x) => x.error)), 1500);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name));
    if (files.length) void uploadFiles(files);
  };

  const dropOn = (target: number) => {
    const from = dragId.current;
    dragId.current = null;
    if (from === null || from === target) return;
    const ids = order.map((x) => x.id);
    ids.splice(ids.indexOf(from), 1);
    ids.splice(ids.indexOf(target), 0, from);
    setOrder(ids.map((id) => order.find((x) => x.id === id)!));
    void run(() => api.put(`/properties/${property.id}/images/order`, { ids }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] font-semibold text-stone-700">
          <span className="relative inline-flex">
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={!!property.is_published}
              disabled={busy}
              onChange={(e) => run(() => api.put(`/properties/${property.id}`, { is_published: e.target.checked }), e.target.checked ? 'Published to the website' : 'Removed from the website')}
            />
            <span className="h-5 w-9 rounded-full bg-stone-300 transition peer-checked:bg-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400" />
            <span className="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
          </span>
          <Globe className="size-4 text-stone-400" /> Publish to website
        </label>
        {!!property.is_published && property.slug && (
          <Link to={sitePropertyPath(property.slug)} target="_blank" className="mr-auto text-[13.5px] font-semibold text-brand-700 hover:underline">
            View on website
          </Link>
        )}
        <div className="flex gap-2">
          <Button
            icon={<Sparkles />}
            loading={property.generating}
            disabled={busy}
            onClick={async () => {
              if (images.some((x) => x.source === 'generated') && !(await confirm({ title: 'Regenerate illustrations?', message: 'Generated images are replaced. Photos you uploaded are kept.', confirmLabel: 'Regenerate' }))) return;
              await run(() => api.post(`/properties/${property.id}/generate-images`, { force: true }), 'Generating images. They appear here in a moment.');
            }}
          >
            Generate images
          </Button>
          <Button variant="primary" icon={<ImagePlus />} onClick={() => input.current?.click()}>
            Add photos
          </Button>
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files && uploadFiles([...e.target.files])} />
      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={cn('rounded-xl border-2 border-dashed p-3 transition', over ? 'border-brand-600 bg-brand-50' : 'border-stone-200')}
      >
        {order.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {order.map((img) => (
              <li
                key={img.id}
                draggable
                onDragStart={() => (dragId.current = img.id)}
                onDragOver={(e) => dragId.current !== null && e.preventDefault()}
                onDrop={(e) => {
                  if (dragId.current === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  dropOn(img.id);
                }}
                className="group relative overflow-hidden rounded-lg border border-stone-200 bg-white"
              >
                <GalleryImage img={img} fallback={property} className="aspect-[4/3]" sizes="240px" />
                <span className="absolute top-1.5 left-1.5 cursor-grab rounded bg-white/85 p-0.5 text-stone-500" title="Drag to reorder">
                  <GripVertical className="size-4" />
                </span>
                {img.is_cover && <span className="absolute top-1.5 right-1.5 rounded bg-gold-400 px-1.5 py-0.5 text-[10.5px] font-bold text-ink">Cover</span>}
                {img.is_ai_generated && <AiBadge className="absolute bottom-10 left-1.5 text-[10px]" />}
                <div className="flex items-center justify-between gap-1 border-t border-stone-100 px-1.5 py-1">
                  <span className="truncate text-[11.5px] text-stone-500" title={img.alt_text}>
                    {img.kind.replace('_', ' ')}
                  </span>
                  <span className="flex">
                    {!img.is_cover && (
                      <button type="button" className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-brand-700" aria-label="Set as cover" title="Set as cover" onClick={() => run(() => api.post(`/properties/${property.id}/images/${img.id}/cover`), 'Cover updated')}>
                        <Star className="size-3.5" />
                      </button>
                    )}
                    <button type="button" className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-brand-700" aria-label="Edit details" title="Edit details" onClick={() => setEditing(img)}>
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete image"
                      title="Delete"
                      onClick={async () => {
                        if (await confirm({ title: 'Delete this image?', message: 'It is removed from the gallery and the website.', confirmLabel: 'Delete' })) await run(() => api.delete(`/properties/${property.id}/images/${img.id}`), 'Image deleted');
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-[13px] text-stone-500">Drop photos here, or use Add photos. JPG, PNG or WebP.</p>
        )}
      </div>
      {uploads.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {uploads.map((u, k) => (
            <li key={k} className="text-[12.5px]">
              <div className="flex justify-between">
                <span className="truncate text-stone-600">{u.name}</span>
                <span className={u.error ? 'text-red-600' : 'text-stone-500'}>{u.error ?? `${Math.round(u.progress * 100)}%`}</span>
              </div>
              {!u.error && (
                <div className="mt-1 h-1 overflow-hidden rounded bg-stone-100">
                  <div className="h-full bg-brand-600 transition-all" style={{ width: `${u.progress * 100}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && <EditImageModal img={editing} propertyId={property.id} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function EditImageModal({ img, propertyId, onClose, onSaved }: { img: PropertyImage; propertyId: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ alt_text: img.alt_text, caption: img.caption ?? '', kind: img.kind, is_ai_generated: img.is_ai_generated });
  const [saving, setSaving] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title="Image details"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await api.patch(`/properties/${propertyId}/images/${img.id}`, form);
          toast.success('Image updated');
          onSaved();
          onClose();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Could not save');
        } finally {
          setSaving(false);
        }
      }}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Alt text" required hint="Describes the image for screen readers and search engines.">
          {(id) => <Input id={id} value={form.alt_text} onChange={(e) => setForm({ ...form, alt_text: e.target.value })} required minLength={3} maxLength={240} />}
        </Field>
        <Field label="Caption">{(id) => <Input id={id} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} maxLength={240} />}</Field>
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {IMAGE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace('_', ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Checkbox label="Artist's impression (not a photograph)" checked={form.is_ai_generated} onChange={(e) => setForm({ ...form, is_ai_generated: e.target.checked })} />
      </div>
    </Modal>
  );
}
