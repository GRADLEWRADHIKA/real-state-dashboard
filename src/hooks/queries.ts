import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { DirectoryUser, Property, ServerMeta, Settings } from '@/types';

export function useDebounce<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Current page of a server-paged list; goes back to page 1 whenever `filters` change. */
export function usePagedFilters(filters: unknown) {
  const key = JSON.stringify(filters);
  const [state, setState] = useState({ key, page: 1 });
  const page = state.key === key ? state.page : 1;
  return [page, (p: number) => setState({ key, page: p })] as const;
}

export const useMeta = () =>
  useQuery({
    queryKey: ['meta'],
    queryFn: () => api.get<ServerMeta>('/meta'),
    staleTime: Infinity,
    retry: 1,
  });

export const useSettings = () =>
  useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<Settings>('/settings'),
    staleTime: 5 * 60_000,
  });

export const useDirectory = () =>
  useQuery({
    queryKey: ['directory'],
    queryFn: () => api.get<{ data: DirectoryUser[] }>('/users/directory').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

export const useAgents = () => {
  const q = useDirectory();
  return {
    ...q,
    data: q.data?.filter((u) => u.role === 'sales' || u.role === 'manager') ?? [],
  };
};

export const usePropertyOptions = (availableOnly = false) =>
  useQuery({
    queryKey: ['properties', 'options', availableOnly],
    queryFn: () =>
      api
        .get<{
          data: Property[];
        }>('/properties', { limit: 500, sort: 'project', order: 'asc', ...(availableOnly ? { available: 1 } : {}) })
        .then((r) => r.data),
    staleTime: 60_000,
  });

/**
 * Mutation with toast feedback that refreshes every cached query touched by the change.
 * Invalidating broadly keeps dashboards, balances and timelines consistent after writes.
 */
export function useAction<TVars, TRes = unknown>(
  fn: (v: TVars) => Promise<TRes>,
  opts: {
    success?: string | ((r: TRes) => string);
    invalidate?: QueryKey[];
    onSuccess?: (r: TRes, v: TVars) => void;
  } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      if (opts.invalidate) opts.invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      else qc.invalidateQueries();
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Project names (from the inventory) for filters. */
export const useProjects = () =>
  useQuery({
    queryKey: ['properties', 'projects'],
    queryFn: () =>
      api
        .get<{
          meta: { projects: { project: string }[] };
        }>('/properties', { limit: 1 })
        .then((r) => r.meta.projects.map((p) => p.project)),
    staleTime: 5 * 60_000,
  });
