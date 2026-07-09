import { createFileRoute } from '@tanstack/react-router';
import {
  Boxes,
  CheckCircle2,
  CloudCog,
  Container,
  DatabaseZap,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Server,
  Tags,
} from 'lucide-react';

export const Route = createFileRoute('/apps/azure-services')({
  component: AzureServices,
});

const appUrl = 'https://model-comparison-tech-a6y7xc7.canadaeast.azurecontainer.io';
const legacyUrl = 'http://model-comparison-tech-a6y7xc7.canadaeast.azurecontainer.io:3000';
const ollamaUrl = 'https://model-comparison-tech-a6y7xc7.canadaeast.azurecontainer.io/api';
const directOllamaUrl = 'http://model-comparison-tech-a6y7xc7.canadaeast.azurecontainer.io:11434';

const resources = [
  {
    name: 'rg-slm-ollama',
    type: 'Resource group',
    region: 'eastus metadata, Canada East resources',
    purpose: 'Deployment boundary for the demo app, ACI, and registry.',
  },
  {
    name: 'slm-ollama',
    type: 'Azure Container Instances',
    region: 'canadaeast',
    purpose: 'Runs Ollama, Caddy HTTPS proxy, and the frontend app containers.',
  },
  {
    name: 'slmollamaa6y7xc7.azurecr.io',
    type: 'Azure Container Registry',
    region: 'canadaeast',
    purpose: 'Stores the frontend container image used by ACI.',
  },
];

const containers = [
  {
    name: 'https-proxy',
    image: 'caddy:2-alpine',
    ports: '80, 443, 3000',
    purpose: 'Terminates HTTPS, redirects the old HTTP app URL, and routes /api to Ollama.',
  },
  {
    name: 'frontend',
    image: 'slmollamaa6y7xc7.azurecr.io/frontend',
    ports: '3001 internal',
    purpose: 'Serves the React/Vite application suite behind the HTTPS proxy.',
  },
  {
    name: 'ollama',
    image: 'ollama/ollama:latest',
    ports: '11434 direct, /api via HTTPS proxy',
    purpose: 'Hosts the seven small playground models for local-model inference.',
  },
];

const tags = [
  ['workload', 'local-slm-playground'],
  ['environment', 'demo'],
  ['owner', 'kvenk'],
  ['region', 'canadaeast'],
  ['managedBy', 'bicep'],
  ['costCenter', 'dev-day'],
];

const checks = [
  'HTTPS app entrypoint is the primary URL.',
  'Legacy HTTP port 3000 redirects to HTTPS.',
  'Browser model calls use the same secure origin via /api.',
  'The seven-model set matches the playground catalog while staying within small-model footprints.',
];

export function AzureServices() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_0.9fr] md:p-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
              <CloudCog className="h-4 w-4" />
              Azure Container Instances - Canada East
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Azure Services Deployment
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                The playground is deployed as a compact Azure-hosted demo with a secure app entrypoint,
                a private frontend image in ACR, and Ollama served behind the same HTTPS origin for browser-safe inference.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={appUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Open secure app <ExternalLink className="h-4 w-4" />
              </a>
              <a
                href={`${appUrl}/apps/car-dealer`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Car dealer route <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <LockKeyhole className="h-4 w-4" /> Secure endpoints
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              <EndpointRow label="App" value={appUrl} />
              <EndpointRow label="Ollama via HTTPS" value={ollamaUrl} />
              <EndpointRow label="Legacy redirect" value={legacyUrl} />
              <EndpointRow label="Direct Ollama" value={directOllamaUrl} muted />
            </dl>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {resources.map((resource) => (
          <InfoCard key={resource.name} icon={resource.type === 'Azure Container Registry' ? Boxes : resource.type === 'Azure Container Instances' ? Container : Globe2} title={resource.name} eyebrow={resource.type}>
            <p className="text-sm text-muted-foreground">{resource.purpose}</p>
            <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
              Region: {resource.region}
            </div>
          </InfoCard>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-semibold">Container group layout</h3>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Container</th>
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Ports</th>
                  <th className="px-4 py-3">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {containers.map((container) => (
                  <tr key={container.name} className="align-top">
                    <td className="px-4 py-3 font-medium">{container.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{container.image}</td>
                    <td className="px-4 py-3 text-muted-foreground">{container.ports}</td>
                    <td className="px-4 py-3 text-muted-foreground">{container.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <InfoCard icon={Tags} title="Resource tags" eyebrow="Governance">
            <div className="grid grid-cols-2 gap-2">
              {tags.map(([key, value]) => (
                <div key={key} className="rounded-lg border bg-background px-3 py-2">
                  <div className="text-xs text-muted-foreground">{key}</div>
                  <div className="text-sm font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </InfoCard>
          <InfoCard icon={DatabaseZap} title="Validation checks" eyebrow="Runtime">
            <ul className="space-y-2 text-sm text-muted-foreground">
              {checks.map((check) => (
                <li key={check} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
          </InfoCard>
        </div>
      </section>
    </div>
  );
}

function EndpointRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 break-all font-mono text-xs ${muted ? 'text-slate-400' : 'text-white'}`}>{value}</dd>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  eyebrow,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}