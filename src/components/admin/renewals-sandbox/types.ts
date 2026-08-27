export interface SandboxCustomer {
  id?: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  registration_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  assigned_to?: string | null;
}

export interface SandboxRow {
  id: string;
  customer_id?: string | null;
  policy_number: string | null;
  plan_type: string | null;
  payment_type?: string | null;
  policy_start_date?: string | null;
  policy_end_date: string | null;
  claim_limit: number | null;
  retention_outcome?: string | null;
  customer_full_name?: string | null;
  email?: string | null;
  customers?: SandboxCustomer | null;
}
