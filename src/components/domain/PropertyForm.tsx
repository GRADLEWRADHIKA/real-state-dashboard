import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '@/lib/utils';
import { useAction, useAgents, useProjects } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import type { PriceListResponse, Property } from '@/types';

const SUGGESTED = ['Gated entry with security', 'Clubhouse', 'Swimming pool', 'Gymnasium', 'Kids play area', 'Landscaped parks', 'Power backup', 'Covered parking', '30 & 40 ft internal roads', 'Street lighting', 'CCTV surveillance', 'Lifts with power backup'];

export function PropertyFormModal({ open, onClose, property, onSaved }: { open: boolean; onClose: () => void; property?: Property | null; onSaved?: (p: Property) => void }) {
  const agents = useAgents();
  const projects = useProjects().data ?? [];
  const editing = !!property;
  const [amenity, setAmenity] = useState('');
  const f = useForm(
    {
      name: property?.name ?? '',
      project: property?.project ?? '',
      location: property?.location ?? '',
      city: property?.city ?? 'Lucknow',
      type: property?.type ?? 'Plot',
      unit_number: property?.unit_number ?? '',
      tower: property?.tower ?? '',
      block: property?.block ?? '',
      rate_per_sqft: (property?.rate_per_sqft ?? '') as number | '',
      floor: (property?.floor ?? '') as number | string,
      bedrooms: (property?.bedrooms ?? '') as number | string,
      bathrooms: (property?.bathrooms ?? '') as number | string,
      area_sqft: (property?.area_sqft ?? '') as number | string,
      price: (property?.price ?? '') as number | '',
      status: property?.status ?? 'Available',
      facing: property?.facing ?? '',
      furnishing: property?.furnishing ?? '',
      parking: (property?.parking ?? '') as number | string,
      possession: property?.possession ?? '',
      rera_number: property?.rera_number ?? '',
      description: property?.description ?? '',
      amenities: property?.amenities ?? ([] as string[]),
      assigned_to: property?.assigned_to ? String(property.assigned_to) : '',
      slug: property?.slug ?? '',
      is_published: !!property?.is_published,
      // New properties get illustrated starter images (rendered in the background).
      generate_images: !property,
    },
    (v) => ({
      name: required(v.name),
      project: required(v.project),
      unit_number: required(v.unit_number),
      area_sqft: required(v.area_sqft),
      price: required(v.price),
    }),
  );
  useEffect(() => {
    if (open) f.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const n = (v: number | string) => (v === '' || v === null ? null : Number(v));
  const save = useAction(
    (v: typeof f.values) => {
      const body = {
        ...v,
        floor: n(v.floor),
        bedrooms: n(v.bedrooms),
        bathrooms: n(v.bathrooms),
        parking: n(v.parking),
        area_sqft: Number(v.area_sqft),
        price: Number(v.price),
        block: v.block.trim() || null,
        rate_per_sqft: v.rate_per_sqft === '' ? null : Number(v.rate_per_sqft),
        assigned_to: v.assigned_to ? Number(v.assigned_to) : null,
        slug: v.slug.trim() || null,
        generate_images: editing ? undefined : v.generate_images,
      };
      return editing ? api.put<Property>(`/properties/${property!.id}`, body) : api.post<Property>('/properties', body);
    },
    {
      success: editing ? 'Property updated' : 'Property added to inventory',
      onSuccess: (p) => {
        onClose();
        onSaved?.(p);
      },
    },
  );
  const priceList = useQuery({
    queryKey: ['price-list', 'all'],
    queryFn: () => api.get<PriceListResponse>('/price-list'),
    enabled: open,
    staleTime: 60_000,
  });
  const listRate = priceList.data?.meta.current.find((e) => e.project === f.values.project.trim() && (e.block ?? '') === f.values.block.trim());
  const residential = ['Apartment', 'Villa'].includes(f.values.type);
  /** Price follows rate × area whenever both are filled; it stays editable afterwards. */
  const setSize = (key: 'area_sqft' | 'rate_per_sqft', value: number | string) => {
    f.set(key, value as never);
    const area = Number(key === 'area_sqft' ? value : f.values.area_sqft);
    const rate = Number(key === 'rate_per_sqft' ? value : f.values.rate_per_sqft);
    if (area > 0 && rate > 0) f.set('price', Math.round(area * rate));
  };
  const addAmenity = (a: string) => {
    const t = a.trim();
    if (t && !f.values.amenities.includes(t)) f.set('amenities', [...f.values.amenities, t]);
    setAmenity('');
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit ${property!.project} · ${property!.unit_number}` : 'Add property'}
      onSubmit={() => f.submit((v) => save.mutateAsync(v))}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={f.busy}>
            {editing ? 'Save changes' : 'Add property'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" required error={f.errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} placeholder="e.g. 3 BHK Premium Villa" {...f.bind('name')} />}
        </Field>
        <Field label="Project" required error={f.errors.project}>
          {(id) => <Input id={id} list="projects" {...f.bind('project')} />}
        </Field>
        <datalist id="projects">
          {projects.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Field label="Type">
          {(id) => (
            <Select id={id} {...f.bind('type')}>
              {PROPERTY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Unit / plot number" required error={f.errors.unit_number}>
          {(id) => <Input id={id} placeholder="e.g. B-15" {...f.bind('unit_number')} />}
        </Field>
        <Field label="Block" hint="Groups plots on the plot map, e.g. A, B, C" error={f.errors.block}>
          {(id) => <Input id={id} placeholder="e.g. A" maxLength={30} {...f.bind('block')} />}
        </Field>
        <Field label="Phase / tower">{(id) => <Input id={id} placeholder="e.g. Phase 1" {...f.bind('tower')} />}</Field>
        <Field label="Area (sq ft)" required error={f.errors.area_sqft}>
          {(id) => <Input id={id} type="number" inputMode="numeric" min={50} value={f.values.area_sqft} onChange={(e) => setSize('area_sqft', e.target.value)} aria-invalid={!!f.errors.area_sqft} />}
        </Field>
        <Field
          label="Rate per sq ft (₹)"
          hint={
            listRate ? (
              <span data-testid="price-list-hint">
                Current price-list rate for {listRate.project}
                {listRate.block ? ` block ${listRate.block}` : ''}: <b className="font-semibold text-brand-800">₹{listRate.rate_per_sqft.toLocaleString('en-IN')}/sq ft</b>
                {Number(f.values.rate_per_sqft) !== listRate.rate_per_sqft && (
                  <button type="button" className="ml-1.5 font-semibold text-brand-800 underline underline-offset-2" onClick={() => setSize('rate_per_sqft', listRate.rate_per_sqft)}>
                    Use it
                  </button>
                )}
              </span>
            ) : (
              'Price is worked out as rate × area'
            )
          }
          error={f.errors.rate_per_sqft}
        >
          {(id) => <MoneyInput id={id} value={f.values.rate_per_sqft} onChange={(v) => setSize('rate_per_sqft', v)} aria-invalid={!!f.errors.rate_per_sqft} />}
        </Field>
        <Field label="Price" required error={f.errors.price}>
          {(id) => <MoneyInput id={id} value={f.values.price} onChange={(v) => f.set('price', v)} />}
        </Field>
        {residential && (
          <>
            <Field label="Bedrooms">{(id) => <Input id={id} type="number" min={0} {...f.bind('bedrooms')} />}</Field>
            <Field label="Bathrooms">{(id) => <Input id={id} type="number" min={0} {...f.bind('bathrooms')} />}</Field>
          </>
        )}
        {f.values.type !== 'Plot' && <Field label="Floor">{(id) => <Input id={id} type="number" {...f.bind('floor')} />}</Field>}
        <Field label="Facing">{(id) => <Input id={id} placeholder="East, North-East, Park facing…" {...f.bind('facing')} />}</Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} {...f.bind('status')}>
              {PROPERTY_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Assigned salesperson">
          {(id) => (
            <Select id={id} {...f.bind('assigned_to')}>
              <option value="">Unassigned</option>
              {agents.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Possession">{(id) => <Input id={id} placeholder="Ready to move / Dec 2027" {...f.bind('possession')} />}</Field>
        <Field label="RERA registration">{(id) => <Input id={id} placeholder="Optional" {...f.bind('rera_number')} />}</Field>
        <Field label="Location" className="sm:col-span-2">
          {(id) => <Input id={id} {...f.bind('location')} />}
        </Field>
        <Field label="Amenities" className="sm:col-span-2">
          {(id) => (
            <div>
              <div className="flex gap-2">
                <Input id={id} value={amenity} onChange={(e) => setAmenity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity(amenity))} placeholder="Type and press Enter" />
                <Button onClick={() => addAmenity(amenity)}>Add</Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.values.amenities.map((a) => (
                  <span key={a} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-800">
                    {a}
                    <button
                      type="button"
                      aria-label={`Remove ${a}`}
                      onClick={() =>
                        f.set(
                          'amenities',
                          f.values.amenities.filter((x) => x !== a),
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {SUGGESTED.filter((s) => !f.values.amenities.includes(s))
                  .slice(0, 6)
                  .map((s) => (
                    <button key={s} type="button" onClick={() => addAmenity(s)} className="rounded-full border border-dashed border-stone-300 px-2.5 py-1 text-[12px] font-medium text-stone-500 hover:border-brand-400 hover:text-brand-800">
                      + {s}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(id) => <Textarea id={id} rows={3} {...f.bind('description')} />}
        </Field>
        <Field label="Web address" hint="Used on the public website: /properties/<address>. Leave empty to create one from the project and unit.">
          {(id) => <Input id={id} placeholder="green-valley-villas-v-14" {...f.bind('slug')} />}
        </Field>
        <div className="flex flex-col justify-center gap-2.5 sm:pt-5">
          <Checkbox label="Publish to website" checked={f.values.is_published} onChange={(e) => f.set('is_published', e.target.checked)} />
          {!editing && <Checkbox label="Generate starter images" checked={f.values.generate_images} onChange={(e) => f.set('generate_images', e.target.checked)} />}
        </div>
      </div>
    </Modal>
  );
}
