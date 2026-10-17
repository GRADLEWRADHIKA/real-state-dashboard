import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { RealtimeResource } from '@estateflow/shared';
import { events } from './api';
import { useAuth } from './auth';

/** Server resource → dashboard query-key prefixes to refetch. */
const KEYS: Record<RealtimeResource, string[]> = {
  leads: ['leads', 'lead', 'lead-options', 'dashboard', 'search'],
  customers: ['customers', 'customer', 'dashboard', 'reports'],
  deals: ['deals', 'dashboard'],
  properties: ['properties', 'property'],
  'site-visits': ['site-visits', 'lead', 'dashboard'],
  followups: ['followups', 'lead', 'dashboard'],
  tasks: ['tasks', 'dashboard'],
  finance: ['finance', 'transactions', 'installments', 'customer', 'receipt', 'reports', 'dashboard'],
  documents: ['documents', 'lead', 'customer', 'property'],
  notifications: ['notifications'],
  'customer-requests': ['customer-requests', 'customer'],
  users: ['users', 'directory', 'reset-requests'],
  settings: ['settings'],
  portal: [],
};

/** Keeps open screens current: the server pushes which resources changed and we refetch them. */
export function RealtimeSync() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    if (!user) return;
    let pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      for (const k of pending) qc.invalidateQueries({ queryKey: [k] });
      pending = new Set();
      timer = null;
    };
    return events((e) => {
      if (e.type === 'notification' && e.notification) {
        toast(e.notification.title, { description: e.notification.message });
      }
      for (const r of e.resources ?? []) for (const k of KEYS[r as RealtimeResource] ?? []) pending.add(k);
      // Batch bursts (a payment touches several resources) into one refetch.
      if (pending.size && !timer) timer = setTimeout(flush, 300);
    });
  }, [user, qc]);
  return null;
}
