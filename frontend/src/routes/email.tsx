/**
 * Email Route - Local SMTP playground (Mailpit + mailer API)
 *
 * Compose & send mail (captured by Mailpit) and browse the inbox.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Mail,
  Send,
  RefreshCw,
  Trash2,
  Inbox as InboxIcon,
  CheckCircle2,
} from 'lucide-react';
import {
  sendEmail,
  listMessages,
  getMessage,
  clearMessages,
  type MessageSummary,
  type MessageDetail,
} from '@/data/mailer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/email')({
  component: EmailPage,
});

function EmailPage() {
  const [sender, setSender] = useState('noreply@example.test');
  const [to, setTo] = useState('user@example.test');
  const [subject, setSubject] = useState('Hello from the dev stack');
  const [body, setBody] = useState('This is a test email sent via Mailpit.');
  const [html, setHtml] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentOk, setSentOk] = useState(false);

  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [selected, setSelected] = useState<MessageDetail | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setInboxError(null);
    try {
      const data = await listMessages();
      setMessages(data.messages ?? []);
    } catch (err) {
      setInboxError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  async function onSend() {
    setSending(true);
    setSendError(null);
    setSentOk(false);
    try {
      await sendEmail({ sender, to, subject, body, html });
      setSentOk(true);
      setTimeout(() => setSentOk(false), 2500);
      await refresh();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function open(id: string) {
    try {
      setSelected(await getMessage(id));
    } catch (err) {
      setInboxError((err as Error).message);
    }
  }

  async function onClear() {
    await clearMessages();
    setSelected(null);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <Mail className="h-5 w-5 text-primary" />
          Email Playground
        </h2>
        <p className="text-sm text-muted-foreground">
          Send mail via SMTP (Mailpit) and browse the captured inbox.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Compose */}
        <Card className="space-y-3 p-4">
          <h3 className="font-medium">Compose</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input value={sender} onChange={(e) => setSender(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Body</label>
            <Textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={html}
              onChange={(e) => setHtml(e.target.checked)}
            />
            Send as HTML
          </label>
          {sendError && (
            <p className="text-sm text-destructive">{sendError}</p>
          )}
          <Button onClick={onSend} disabled={sending || !to || !subject}>
            {sentOk ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Sent
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
              </>
            )}
          </Button>
        </Card>

        {/* Inbox */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b p-3">
            <h3 className="flex items-center gap-2 font-medium">
              <InboxIcon className="h-4 w-4" />
              Inbox ({messages.length})
            </h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refresh}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                disabled={!messages.length}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {inboxError && (
            <div className="bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {inboxError}
            </div>
          )}

          <div className="max-h-[480px] overflow-y-auto">
            {messages.length === 0 && !inboxError && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No messages yet. Send one to see it here.
              </p>
            )}
            {messages.map((m) => (
              <button
                key={m.ID}
                onClick={() => open(m.ID)}
                className={cn(
                  'block w-full border-b px-3 py-2 text-left transition-colors hover:bg-muted',
                  selected?.ID === m.ID && 'bg-muted',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {m.Subject || '(no subject)'}
                  </span>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {new Date(m.Created).toLocaleTimeString()}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {m.From?.Address} → {m.To?.map((t) => t.Address).join(', ')}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.Snippet}
                </p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Message viewer */}
      {selected && (
        <Card className="space-y-2 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {selected.Subject || '(no subject)'}
              </h3>
              <p className="text-sm text-muted-foreground">
                From {selected.From?.Address} ·{' '}
                {new Date(selected.Date).toLocaleString()}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <div className="rounded-md border bg-background p-3">
            {selected.HTML ? (
              <div
                className="prose prose-sm max-w-none"
                // Mailpit sanitizes message HTML; this is local dev mail only.
                dangerouslySetInnerHTML={{ __html: selected.HTML }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm">{selected.Text}</pre>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
