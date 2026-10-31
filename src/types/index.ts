// The API contract lives in @estateflow/shared; the dashboard re-exports it under its own alias.
export type * from '@estateflow/shared';
export type { Role } from '@estateflow/shared';

import type { PageMeta } from '@estateflow/shared';
/** A paginated list response: `{ data, meta }` with optional per-endpoint aggregates on `meta`. */
export interface Paged<T, M extends object = {}> {
  data: T[];
  meta: PageMeta & M;
}

import type { Lead, PriceListEntry, Refund, FeedbackItem } from '@estateflow/shared';

/** GET /leads/insights */
export interface LeadInsights {
  days: number;
  open: number;
  stuck: Lead[];
  hot: Lead[];
  byAgent: { agent_id: number | null; agent_name: string | null; stuck: number }[];
}

/** GET /price-list */
export interface PriceBlock {
  project: string;
  block: string;
  units: number;
  unsold: number;
  min_rate: number | null;
  max_rate: number | null;
}
export interface PriceListResponse {
  data: PriceListEntry[];
  meta: { current: PriceListEntry[]; blocks: PriceBlock[] };
}

/** GET /refunds */
export interface PendingRefund {
  id: number;
  code: string;
  name: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  property_project?: string | null;
  property_unit?: string | null;
  paid: number;
  settled: number;
  open: number;
}
export interface RefundsResponse {
  data: Refund[];
  meta: PageMeta & { totals: { refunded: number; deducted: number }; pending: PendingRefund[] };
}
export interface CustomerRefunds {
  data: Refund[];
  meta: { paid: number; settled: number; open: number };
}

/** GET /feedback */
export interface FeedbackResponse {
  data: FeedbackItem[];
  meta: PageMeta & {
    summary: { kind: FeedbackItem['kind']; n: number; average: number | null; low: number }[];
    distribution: { rating: number; n: number }[];
    byAgent: { agent_id: number | null; agent_name: string | null; n: number; average: number | null }[];
  };
}
