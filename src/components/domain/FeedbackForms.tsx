import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAction } from '@/hooks/queries';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import type { SiteVisit } from '@/types';

const LABELS = ['', 'Very poor', 'Poor', 'Okay', 'Good', 'Excellent'];

/** Read-only row of five stars. */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${rating} out of 5`} title={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= rating ? 'fill-gold-400 text-gold-500' : 'text-stone-300')} />
      ))}
    </span>
  );
}

/** Clickable 1–5 star picker. */
export function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-600/20"
          >
            <Star className={cn('size-7', n <= shown ? 'fill-gold-400 text-gold-500' : 'text-stone-300')} />
          </button>
        ))}
      </div>
      <span className="text-[13px] font-semibold text-stone-600">{LABELS[shown]}</span>
    </div>
  );
}

/** The executive records how the visitor rated a site visit (a second rating replaces the first). */
export function VisitRatingModal({ visit, onClose }: { visit: SiteVisit | null; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (visit) {
      setRating(0);
      setComment('');
      setError('');
    }
  }, [visit]);
  const save = useAction((v: { site_visit_id: number; rating: number; comment: string | null }) => api.post('/feedback/site-visit', v), {
    success: 'Visitor rating saved',
    invalidate: [['feedback'], ['site-visits'], ['lead']],
    onSuccess: onClose,
  });
  const submit = () => {
    if (!visit) return;
    if (!rating) return setError('Choose 1 to 5 stars');
    save.mutate({ site_visit_id: visit.id, rating, comment: comment.trim() || null });
  };
  return (
    <Modal
      open={!!visit}
      onClose={onClose}
      title="Record visitor rating"
      description={visit ? `${visit.lead_name} · ${fmtDate(visit.visit_date)}${visit.property_project ? ` · ${visit.property_project}` : ''}` : undefined}
      size="sm"
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            Save rating
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="How did the visitor rate the visit?" required error={error}>
          {() => (
            <StarInput
              value={rating}
              onChange={(n) => {
                setRating(n);
                setError('');
              }}
            />
          )}
        </Field>
        <Field label="Comment">{(id) => <Textarea id={id} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What they liked or didn’t" maxLength={1000} />}</Field>
      </div>
    </Modal>
  );
}
