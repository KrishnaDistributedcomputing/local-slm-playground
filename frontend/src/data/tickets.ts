/**
 * Client for the Temporal-backed Support Ticket Desk API.
 *
 * The Ops service (`ops-web`) bridges HTTP to Temporal: each ticket is a
 * long-running `SupportTicketWorkflow`, and the pipeline is persisted to
 * Supabase. This module is a thin fetch wrapper used by the Support Desk app.
 *
 * Configure the base URL via `VITE_OPS_URL` (defaults to http://localhost:8097).
 */

const OPS_URL = (
  import.meta.env.VITE_OPS_URL || 'http://localhost:8097'
).replace(/\/$/, '');

/** Ordered support pipeline stages exposed by the ticket workflow. */
export const TICKET_STAGES = [
  'New',
  'Triaged',
  'Replied',
  'Escalated',
  'Resolved',
] as const;

export type TicketStage = (typeof TICKET_STAGES)[number];
export type TicketStatus = 'open' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  subject: string;
  requester: string | null;
  channel: string | null;
  priority: string;
  stage: string;
  stage_index?: number;
  stages?: string[];
  status: TicketStatus;
  over?: boolean;
  notes?: TicketTimelineEntry[];
  notes_count: number;
}

export interface TicketTimelineEntry {
  kind: string;
  detail: string;
  at?: string;
  created_at?: string;
}

export interface TicketDetail {
  state: Ticket;
  timeline: TicketTimelineEntry[];
}

export interface NewTicketInput {
  subject: string;
  requester?: string;
  channel?: string;
  priority?: string;
  sla_minutes?: number;
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
export async function pingOps(): Promise<boolean> {
  try {
    const res = await fetch(`${OPS_URL}/api/tickets?limit=1`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listTickets(limit = 50): Promise<Ticket[]> {
  const data = await request<{ rows: Ticket[] }>(`/api/tickets?limit=${limit}`);
  return data.rows ?? [];
}

export async function createTicket(
  body: NewTicketInput,
): Promise<{ id: string; state: Ticket }> {
  return request(`/api/tickets`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getTicket(id: string): Promise<TicketDetail> {
  return request(`/api/tickets/${encodeURIComponent(id)}`);
}

export async function advanceTicket(id: string): Promise<{ state: Ticket }> {
  return request(`/api/tickets/${encodeURIComponent(id)}/advance`, {
    method: 'POST',
  });
}

export async function setTicketStage(
  id: string,
  stage: string,
): Promise<{ state: Ticket }> {
  return request(`/api/tickets/${encodeURIComponent(id)}/stage`, {
    method: 'POST',
    body: JSON.stringify({ stage }),
  });
}

export async function addTicketNote(
  id: string,
  text: string,
): Promise<{ state: Ticket }> {
  return request(`/api/tickets/${encodeURIComponent(id)}/note`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function escalateTicket(
  id: string,
  reason = '',
): Promise<{ state: Ticket }> {
  return request(`/api/tickets/${encodeURIComponent(id)}/escalate`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function resolveTicket(id: string): Promise<{ state: Ticket }> {
  return request(`/api/tickets/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
  });
}
