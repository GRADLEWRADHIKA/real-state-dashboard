import clsx, { type ClassValue } from 'clsx';
import { toCsv } from '@estateflow/shared';

export const cn = (...v: ClassValue[]) => clsx(v);

export {
  LEAD_STATUSES,
  LEAD_SOURCES,
  LEAD_PRIORITIES,
  PROPERTY_TYPES,
  PROPERTY_STATUSES,
  PAYMENT_METHODS,
  FOLLOWUP_TYPES,
  VISIT_STATUSES,
  VISIT_OUTCOMES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  DEAL_STAGES,
  DOCUMENT_TYPES,
  BUDGET_RANGES,
  ROLE_LABEL,
  CONSTRUCTION_STAGES,
  CONTACT_CHANNELS,
  CUSTOMER_REQUEST_STATUSES,
  CUSTOMER_REQUEST_TYPES,
  telHref,
  waHref,
  smsHref,
  mapsHref,
} from '@estateflow/shared';

/** Chart palette — validated for colour-vision deficiency on white. */
export const SERIES = ['#2e8b57', '#2a78d6', '#e0a526', '#e8607a', '#7b5cd6', '#e5793b', '#a35bd0'];
export const STATUS_COLORS = {
  good: '#2e8b57',
  warning: '#e0a526',
  critical: '#d03b3b',
  neutral: '#a8a29e',
};

/** Client-side CSV for data already on screen (server exports are used for full datasets). */
export function downloadCsv(filename: string, rows: Record<string, any>[], columns: { key: string; label: string; value?: (r: any) => unknown }[]) {
  const blob = new Blob([toCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
