// The API contract lives in @estateflow/shared; the dashboard re-exports it under its own alias.
export type * from '@estateflow/shared';
export type { Role } from '@estateflow/shared';

import type { PageMeta } from '@estateflow/shared';
/** A paginated list response: `{ data, meta }` with optional per-endpoint aggregates on `meta`. */
export interface Paged<T, M extends object = {}> {
  data: T[];
  meta: PageMeta & M;
}
