/**
 * Mailer API client.
 *
 * Talks to the local `mailer` FastAPI service, which sends mail via SMTP
 * (captured by Mailpit) and proxies Mailpit's inbox API.
 * Configure via VITE_MAILER_URL.
 */

export const MAILER_URL =
  import.meta.env.VITE_MAILER_URL || 'http://localhost:8200';

export interface SendEmailInput {
  sender: string;
  to: string;
  subject: string;
  body: string;
  html: boolean;
}

export interface MessageSummary {
  ID: string;
  From: { Name: string; Address: string };
  To: { Name: string; Address: string }[];
  Subject: string;
  Snippet: string;
  Created: string;
  Read: boolean;
}

export interface MessageListResponse {
  messages: MessageSummary[];
  total: number;
  count: number;
}

export interface MessageDetail {
  ID: string;
  From: { Name: string; Address: string };
  To: { Name: string; Address: string }[];
  Subject: string;
  Date: string;
  Text: string;
  HTML: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const res = await fetch(`${MAILER_URL}/api/email/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Send failed (${res.status}). ${detail}`);
  }
}

export async function listMessages(limit = 50): Promise<MessageListResponse> {
  const res = await fetch(`${MAILER_URL}/api/email/messages?limit=${limit}`);
  if (!res.ok) throw new Error(`Inbox unavailable (${res.status})`);
  return res.json();
}

export async function getMessage(id: string): Promise<MessageDetail> {
  const res = await fetch(`${MAILER_URL}/api/email/messages/${id}`);
  if (!res.ok) throw new Error(`Message unavailable (${res.status})`);
  return res.json();
}

export async function clearMessages(): Promise<void> {
  const res = await fetch(`${MAILER_URL}/api/email/messages`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Clear failed (${res.status})`);
}
