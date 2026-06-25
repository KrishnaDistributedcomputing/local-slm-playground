/**
 * Client for the Temporal-backed Recruiting Pipeline (ATS) API.
 *
 * The Ops service (`ops-web`) bridges HTTP to Temporal: each candidate is a
 * long-running `RecruitCandidateWorkflow`, and the pipeline is persisted to
 * Supabase. This module is a thin fetch wrapper used by the Recruiting app.
 *
 * Configure the base URL via `VITE_OPS_URL` (defaults to http://localhost:8097).
 */

const OPS_URL = (
  import.meta.env.VITE_OPS_URL || 'http://localhost:8097'
).replace(/\/$/, '');

/** Ordered recruiting pipeline stages exposed by the candidate workflow. */
export const CANDIDATE_STAGES = [
  'Applied',
  'Screened',
  'Interview',
  'Offer',
  'Hired',
] as const;

export type CandidateStage = (typeof CANDIDATE_STAGES)[number];
export type CandidateStatus = 'active' | 'hired' | 'rejected';

export interface Candidate {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  source: string | null;
  stage: string;
  stage_index?: number;
  stages?: string[];
  status: CandidateStatus;
  over?: boolean;
  notes?: CandidateTimelineEntry[];
  notes_count: number;
}

export interface CandidateTimelineEntry {
  kind: string;
  detail: string;
  at?: string;
  created_at?: string;
}

export interface CandidateDetail {
  state: Candidate;
  timeline: CandidateTimelineEntry[];
}

export interface NewCandidateInput {
  name: string;
  role?: string;
  email?: string;
  source?: string;
  followup_minutes?: number;
}

/** The configured Ops base URL. */
export function getOpsUrl(): string {
  return OPS_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OPS_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Ops request failed (${res.status}). ${detail || 'Is the ops-web service running?'}`,
    );
  }
  return (await res.json()) as T;
}

/** Health probe — true when the Ops API responds. */
export async function pingRecruiting(): Promise<boolean> {
  try {
    const res = await fetch(`${OPS_URL}/api/candidates?limit=1`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listCandidates(limit = 50): Promise<Candidate[]> {
  const data = await request<{ rows: Candidate[] }>(
    `/api/candidates?limit=${limit}`,
  );
  return data.rows ?? [];
}

export async function createCandidate(
  body: NewCandidateInput,
): Promise<{ id: string; state: Candidate }> {
  return request(`/api/candidates`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getCandidate(id: string): Promise<CandidateDetail> {
  return request(`/api/candidates/${encodeURIComponent(id)}`);
}

export async function advanceCandidate(
  id: string,
): Promise<{ state: Candidate }> {
  return request(`/api/candidates/${encodeURIComponent(id)}/advance`, {
    method: 'POST',
  });
}

export async function setCandidateStage(
  id: string,
  stage: string,
): Promise<{ state: Candidate }> {
  return request(`/api/candidates/${encodeURIComponent(id)}/stage`, {
    method: 'POST',
    body: JSON.stringify({ stage }),
  });
}

export async function addCandidateNote(
  id: string,
  text: string,
): Promise<{ state: Candidate }> {
  return request(`/api/candidates/${encodeURIComponent(id)}/note`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function hireCandidate(
  id: string,
): Promise<{ state: Candidate }> {
  return request(`/api/candidates/${encodeURIComponent(id)}/hire`, {
    method: 'POST',
  });
}

export async function rejectCandidate(
  id: string,
  reason = '',
): Promise<{ state: Candidate }> {
  return request(`/api/candidates/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
