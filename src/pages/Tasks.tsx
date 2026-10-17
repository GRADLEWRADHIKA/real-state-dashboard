import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ListChecks, MoreHorizontal, Pencil, Plus, Trash2, PlayCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { relativeDay, todayStr } from '@/lib/format';
import { TASK_PRIORITIES, cn } from '@/lib/utils';
import { useAction, useDebounce } from '@/hooks/queries';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Form';
import { StatusBadge, TaskPriorityBadge } from '@/components/ui/Badge';
import { Avatar, Menu, MenuItem, MenuSeparator, PageHeader, Tabs } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useConfirm } from '@/components/ui/Modal';
import { TaskFormModal } from '@/components/domain/ScheduleForms';
import { CalendarPill, MonthCalendar, currentMonth } from '@/components/ui/Calendar';
import type { Paged, Task } from '@/types';

export default function Tasks() {
  const user = useUser();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'open' | 'Todo' | 'In Progress' | 'Completed' | 'calendar'>('open');
  const [month, setMonth] = useState(currentMonth());
  const [priority, setPriority] = useState('');
  const [mine, setMine] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [edit, setEdit] = useState<Task | null>(null);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tasks', priority, mine, dq],
    queryFn: () => api.get<Paged<Task>>('/tasks', { priority, mine, q: dq, limit: 500 }).then((r) => r.data),
  });
  const update = useAction((v: { id: number; body: Partial<Task> }) => api.put(`/tasks/${v.id}`, v.body), {
    success: (r: any) => (r.status === 'Completed' ? 'Task completed' : 'Task updated'),
  });
  const del = useAction((id: number) => api.delete(`/tasks/${id}`), {
    success: 'Task deleted',
  });

  const rows = useMemo(() => (data ?? []).filter((t) => (tab === 'open' ? t.status !== 'Completed' : t.status === tab)), [data, tab]);
  const count = (s: string) => (data ?? []).filter((t) => (s === 'open' ? t.status !== 'Completed' : t.status === s)).length;
  const isManager = user.role === 'admin' || user.role === 'manager';

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle={isManager ? 'Team to-dos across sales, accounts and site operations' : 'Your to-dos and tasks you have assigned'}
        crumbs={[{ label: 'Home', to: '/' }, { label: 'Tasks' }]}
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setParams({ new: '1' }, { replace: true })}>
            New task
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <Tabs
          className="px-4 pt-1 sm:px-5"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'open', label: 'Open', count: count('open') },
            { value: 'Todo', label: 'To do', count: count('Todo') },
            {
              value: 'In Progress',
              label: 'In progress',
              count: count('In Progress'),
            },
            {
              value: 'Completed',
              label: 'Completed',
              count: count('Completed'),
            },
            { value: 'calendar', label: 'Calendar' },
          ]}
        />
        <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search tasks…" className="sm:w-64" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect value={priority} onChange={setPriority} placeholder="Any priority" options={[...TASK_PRIORITIES]} />
            {isManager && <FilterSelect value={mine} onChange={setMine} placeholder="Everyone" options={[{ value: '1', label: 'Assigned to me' }]} />}
          </div>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : tab === 'calendar' ? (
          <div className="p-3 sm:p-4">
            <MonthCalendar
              month={month}
              onMonth={setMonth}
              items={(data ?? []).filter((t) => t.due_date?.startsWith(month))}
              dateOf={(t) => t.due_date!}
              keyOf={(t) => t.id}
              renderItem={(t) => (
                <CalendarPill tone={t.status === 'Completed' ? 'gray' : t.due_date! < todayStr() ? 'red' : t.priority === 'High' || t.priority === 'Urgent' ? 'amber' : 'blue'} title={`${t.title} · ${t.assignee_name} · ${t.status}`} onClick={() => setEdit(t)}>
                  {t.title}
                </CalendarPill>
              )}
            />
          </div>
        ) : !rows.length ? (
          <EmptyState icon={<ListChecks />} title={tab === 'Completed' ? 'Nothing completed yet' : 'You’re all clear'} message="Create a task to track cost sheets, documentation and reminders." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((t) => {
              const done = t.status === 'Completed';
              const overdue = !done && t.due_date && t.due_date < todayStr();
              return (
                <li key={t.id} className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-stone-50/60 sm:px-5">
                  <button
                    onClick={() =>
                      update.mutate({
                        id: t.id,
                        body: { status: done ? 'Todo' : 'Completed' },
                      })
                    }
                    aria-label={done ? 'Mark as not done' : 'Mark as done'}
                    className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors', done ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 hover:border-brand-600')}
                  >
                    {done && <Check className="size-3.5" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[14px] font-semibold', done ? 'text-stone-400 line-through' : 'text-ink')}>{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-stone-500">
                      <span className="flex items-center gap-1.5">
                        <Avatar name={t.assignee_name} size="xs" />
                        {t.assignee_name}
                      </span>
                      {t.due_date && <span className={cn(overdue && 'font-semibold text-red-600')}>Due {relativeDay(t.due_date).toLowerCase()}</span>}
                      {t.lead_name && (
                        <Link to={`/leads/${t.lead_id}`} className="font-medium text-brand-800 hover:underline">
                          {t.lead_name}
                        </Link>
                      )}
                      {t.customer_name && (
                        <Link to={`/customers/${t.customer_id}`} className="font-medium text-brand-800 hover:underline">
                          {t.customer_name}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden sm:inline-flex">
                      <StatusBadge status={t.status} />
                    </span>
                    <TaskPriorityBadge priority={t.priority} />
                    <Menu trigger={<Button size="icon-sm" variant="ghost" aria-label="More" icon={<MoreHorizontal />} />}>
                      <MenuItem icon={<Pencil />} onSelect={() => setEdit(t)}>
                        Edit
                      </MenuItem>
                      {t.status === 'Todo' && (
                        <MenuItem
                          icon={<PlayCircle />}
                          onSelect={() =>
                            update.mutate({
                              id: t.id,
                              body: { status: 'In Progress' },
                            })
                          }
                        >
                          Start
                        </MenuItem>
                      )}
                      <MenuSeparator />
                      <MenuItem
                        icon={<Trash2 />}
                        danger
                        onSelect={async () => {
                          if (
                            await confirm({
                              title: 'Delete task?',
                              message: t.title,
                              confirmLabel: 'Delete',
                            })
                          )
                            del.mutate(t.id);
                        }}
                      >
                        Delete
                      </MenuItem>
                    </Menu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <TaskFormModal
        open={params.get('new') === '1'}
        onClose={() => {
          const n = new URLSearchParams(params);
          n.delete('new');
          setParams(n, { replace: true });
        }}
      />
      <TaskFormModal open={!!edit} onClose={() => setEdit(null)} task={edit} />
    </div>
  );
}
