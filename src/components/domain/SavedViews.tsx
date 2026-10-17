import { useState } from 'react';
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Form';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Misc';
import { Modal } from '@/components/ui/Modal';

interface View {
  name: string;
  query: string;
}

/** Filter presets saved per user in this browser (they are a convenience, not shared data). */
function load(key: string): View[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as View[];
  } catch {
    return [];
  }
}
function store(key: string, views: View[]) {
  try {
    localStorage.setItem(key, JSON.stringify(views));
  } catch {
    toast.error('This browser is not letting EstateFlow save views.');
  }
}

export function SavedViews({ storageKey, current, onApply }: { storageKey: string; current: URLSearchParams; onApply: (query: string) => void }) {
  const [views, setViews] = useState<View[]>(() => load(storageKey));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const query = (() => {
    const q = new URLSearchParams(current);
    q.delete('page');
    q.delete('new');
    return q.toString();
  })();
  const save = () => {
    const n = name.trim();
    if (!n) return toast.error('Give the view a name');
    const next = [...views.filter((v) => v.name !== n), { name: n, query }];
    setViews(next);
    store(storageKey, next);
    setNaming(false);
    setName('');
    toast.success(`Saved view “${n}”`);
  };
  const remove = (n: string) => {
    const next = views.filter((v) => v.name !== n);
    setViews(next);
    store(storageKey, next);
  };
  const active = views.find((v) => v.query === query);

  return (
    <>
      <Menu
        trigger={
          <Button size="sm" variant={active ? 'subtle' : 'ghost'} icon={<Bookmark />}>
            {active ? active.name : 'Views'}
          </Button>
        }
        align="start"
      >
        {views.length > 0 && <MenuLabel>Saved views</MenuLabel>}
        {views.map((v) => (
          <MenuItem key={v.name} onSelect={() => onApply(v.query)}>
            <span className="flex w-full items-center justify-between gap-3">
              {v.name}
              <span
                role="button"
                tabIndex={0}
                aria-label={`Delete view ${v.name}`}
                className="text-stone-400 hover:text-red-600"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(v.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    remove(v.name);
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </span>
            </span>
          </MenuItem>
        ))}
        {views.length > 0 && <MenuSeparator />}
        <MenuItem icon={<BookmarkPlus />} disabled={!query} onSelect={() => setNaming(true)}>
          Save current filters…
        </MenuItem>
      </Menu>
      <Modal
        open={naming}
        onClose={() => setNaming(false)}
        size="sm"
        title="Save view"
        description="Keeps the current tab, filters and sort for one-click access"
        onSubmit={save}
        footer={
          <>
            <Button onClick={() => setNaming(false)}>Cancel</Button>
            <Button type="submit" variant="primary">
              Save view
            </Button>
          </>
        }
      >
        <Field label="Name">{(id) => <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hot website leads" maxLength={40} />}</Field>
      </Modal>
    </>
  );
}
