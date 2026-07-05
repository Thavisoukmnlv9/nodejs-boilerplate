/** Branch shape returned by the branches feature (only fields the schema actually has). */
export interface BranchView {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  address: string | null;
  type: string | null;
  vertical: string | null;
  is_active: boolean;
  is_main: boolean;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency_code: string;
  locale: string;
  tax_rate_bps: number;
  service_fee_bps: number;
  prices_include_tax: boolean;
  created_at: string;
  updated_at: string;
}

/** Aggregate counts for the branches-page stat cards (respects branch scope). */
export interface BranchStats {
  total: number;
  active: number;
  archived: number;
  by_vertical: Record<string, number>;
}
