import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '@/lib/utils';
import { useAction, useAgents } from '@/hooks/queries';
import { required, useForm } from '@/hooks/useForm';
import { Button } from '@/components/ui/Button';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import type { Property } from '@/types';

const SUGGESTED = ['Gated entry with security', 'Clubhouse', 'Swimming pool', 'Gymnasium', 'Kids play area', 'Landscaped parks', 'Power backup', 'Covered parking', '30 & 40 ft internal roads', 'Street lighting', 'CCTV surveillance', 'Lifts with power backup'];

export function PropertyFormModal({ open, onClose, property, onSaved }: { open: boolean; onClose: () => void; property?: Property | null; onSaved?: (p: Property) => void }) {
  const agents = useAgents();
  const editing = !!property;
  const [amenity, setAmenity] = useState('');
  const f = useForm(
    {
      name: property?.name ?? '',
      project: property?.project ?? 'Green Valley Plots',
      location: property?.location ?? 'Nigohan–Samesi Road, Mohanlalganj',
      city: property?.city ?? 'Lucknow',
      type: property?.type ?? 'Plot',
      unit_number: property?.unit_number ?? '',
      tower: property?.tower ?? '',
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
  const residential = ['Apartment', 'Villa'].includes(f.values.type);
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
          {['Green Valley Plots', 'Green Valley Villas', 'Green Valley Residency', 'Green Valley Commercial'].map((p) => (
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
        <Field label="Phase / tower / block">{(id) => <Input id={id} placeholder="e.g. Phase 1 · Block B" {...f.bind('tower')} />}</Field>
        <Field label="Area (sq ft)" required error={f.errors.area_sqft}>
          {(id) => <Input id={id} type="number" inputMode="numeric" min={50} {...f.bind('area_sqft')} />}
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
