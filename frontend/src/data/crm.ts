/**
 * Client for the Temporal-backed CRM API (sales-force automation).
 *
 * The CRM service (`crm-web`) bridges HTTP to Temporal: each contact is a
 * long-running `CrmLeadWorkflow`, and the pipeline is persisted to Supabase.
 * This module is a thin fetch wrapper used by the CRM app in the frontend.
 *
 * Configure the base URL via `VITE_CRM_URL` (defaults to http://localhost:8096).
 */

const CRM_URL = (
  import.meta.env.VITE_CRM_URL || 'http://localhost:8096'
).replace(/\/$/, '');

/** Ordered sales pipeline stages exposed by the CRM workflow. */
export const CRM_STAGES = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal',
  'Won',
] as const;

export type CrmStage = (typeof CRM_STAGES)[number];
export type CrmStatus = 'active' | 'won' | 'lost';

export interface CrmContact {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  owner: string | null;
  value: number;
  stage: string;
  stage_index?: number;
  stages?: string[];
  status: CrmStatus;
  over?: boolean;
  notes?: CrmTimelineEntry[];
  notes_count: number;
}

export interface CrmTimelineEntry {
  kind: string;
  detail: string;
  at?: string;
  created_at?: string;
}

export interface CrmDetail {
  state: CrmContact;
  timeline: CrmTimelineEntry[];
}

export interface NewContactInput {
  name: string;
  email?: string;
  company?: string;
  value?: number;
  owner?: string;
  followup_minutes?: number;
}

/** The configured CRM base URL. */
export function getCrmUrl(): string {
  return CRM_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CRM_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `CRM request failed (${res.status}). ${detail || 'Is the crm-web service running?'}`,
    );
  }
  return (await res.json()) as T;
}

/** Health probe — true when the CRM API responds. */
export async function pingCrm(): Promise<boolean> {
  try {
    const res = await fetch(`${CRM_URL}/api/contacts?limit=1`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listContacts(limit = 50): Promise<CrmContact[]> {
  const data = await request<{ rows: CrmContact[] }>(
    `/api/contacts?limit=${limit}`,
  );
  return data.rows ?? [];
}

export async function createContact(
  body: NewContactInput,
): Promise<{ id: string; state: CrmContact }> {
  return request(`/api/contacts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getContact(id: string): Promise<CrmDetail> {
  return request(`/api/contacts/${encodeURIComponent(id)}`);
}

export async function advanceContact(
  id: string,
): Promise<{ state: CrmContact }> {
  return request(`/api/contacts/${encodeURIComponent(id)}/advance`, {
    method: 'POST',
  });
}

export async function setContactStage(
  id: string,
  stage: string,
): Promise<{ state: CrmContact }> {
  return request(`/api/contacts/${encodeURIComponent(id)}/stage`, {
    method: 'POST',
    body: JSON.stringify({ stage }),
  });
}

export async function addContactNote(
  id: string,
  text: string,
): Promise<{ state: CrmContact }> {
  return request(`/api/contacts/${encodeURIComponent(id)}/note`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function winContact(id: string): Promise<{ state: CrmContact }> {
  return request(`/api/contacts/${encodeURIComponent(id)}/win`, {
    method: 'POST',
  });
}

export async function disqualifyContact(
  id: string,
  reason = '',
): Promise<{ state: CrmContact }> {
  return request(`/api/contacts/${encodeURIComponent(id)}/disqualify`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
