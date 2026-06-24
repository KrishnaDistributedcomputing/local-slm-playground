# Boilerplate Stack

Phase 1 scaffolding for the JSON-driven Supabase + Temporal starter.

## Screenshots

A live walkthrough of the running stack (`docker compose up -d`), captured from the deployment at http://localhost:3000.

### Local Models Playground
Small language models served locally in Docker. Models are grouped with the Microsoft Phi family first, each card showing parameters, on-disk size, quantization and "best for" guidance.

![Local Models Playground](docs/screenshots/01-models.png)

### Sales Force Automation CRM
A durable sales pipeline where every lead is a long-running **Temporal** workflow persisted to **Supabase**, with the local language model layered on top for drafting outreach, suggesting the next best action, summarizing deals and qualifying leads (BANT).

![Sales Force Automation CRM](docs/screenshots/02-crm.png)

### System Monitoring
Live health for every service in the stack (Ollama, CRM API, Frontend, Temporal, Mailpit, Supabase DB) plus cumulative **token usage** captured from each local model request — totals, per-model breakdown and throughput.

![System Monitoring](docs/screenshots/03-monitor.png)

### AI Chat
Streaming chat against any locally pulled model, with a model picker, stop control and copy/error states.

![AI Chat](docs/screenshots/04-chat.png)

## Apps

Once the stack is running, open **http://localhost:3000** and pick an app from the left sidebar. Every app runs against the local models — no API keys, no per-token cost, fully private.

### Core

| App | Route | What it does |
| --- | --- | --- |
| **Local Models Playground** | `/` | Gallery of every model installed locally — parameters, on-disk size, quantization and "best for" guidance, grouped with Microsoft Phi first. |
| **AI Chat** | `/chat` | Streaming chat against any installed model, with a model picker, stop control, and copy/error states. |

### Text & code tools

| App | Route | What it does |
| --- | --- | --- |
| **Summarizer** | `/apps/summarizer` | Condense long text into clear bullet points. |
| **Translator** | `/apps/translator` | Translate text into another language. |
| **Code Reviewer** | `/apps/code-reviewer` | Review code for bugs, edge cases, security issues and improvements. |
| **Data Extractor** | `/apps/extractor` | Turn unstructured text (emails, invoices, notes) into structured JSON. |
| **Email Writer** | `/apps/email-writer` | Turn a few notes into a polished email. |
| **Proofreader** | `/apps/proofreader` | Fix grammar, spelling and punctuation. |
| **Tone Rewriter** | `/apps/rewriter` | Rewrite text in a different tone or style. |
| **Brainstormer** | `/apps/brainstorm` | Generate fresh ideas around any topic. |
| **Explainer** | `/apps/explain` | Explain any concept at the level you choose. |
| **SQL Generator** | `/apps/sql` | Turn a plain-English request into a SQL query. |
| **JSON Builder** | `/apps/json-builder` | Describe the data you need and get well-formed JSON. |
| **Azure Architecture Advisor** | `/apps/azure-architecture` | Assess a workload through the Azure Well-Architected Framework. |
| **Polymarket Analyst** | `/apps/polymarket` | Estimate market odds for a real-world event (research only — not financial advice). |
| **Kalshi Analyst** | `/apps/kalshi` | Turn an event question into a Kalshi-style YES/NO contract (research only — not financial advice). |

### Full-stack apps (Temporal + Supabase)

| App | Route | What it does |
| --- | --- | --- |
| **CRM (Sales Force Automation)** | `/apps/crm` | A durable sales pipeline where each lead is a long-running **Temporal** workflow persisted to **Supabase**, with the local model layered on top for outreach drafting, next-best-action, deal summaries and BANT qualification. |
| **System Monitoring** | `/apps/monitor` | Live health for every service (Ollama, CRM API, Frontend, Temporal, Mailpit, Supabase DB) plus cumulative **token usage** captured from every model request, broken down per model. |

## How to use

### Text & code tools
1. Open the app from the left sidebar.
2. Choose a model from the **model dropdown** (defaults to `qwen2.5:0.5b`; larger Phi/Gemma/Llama models give stronger results).
3. Paste or type your input in the left panel.
4. Click the action button (e.g. **Summarize**, **Translate**, **Review**) — the response streams in on the right.
5. Use **Stop** to cancel, **Copy** to grab the output, then tweak the input and re-run.

### CRM (full-stack)
1. Open **CRM (Sales)**. The CRM API (`crm-web`), Temporal and Supabase start automatically with `docker compose up -d`.
2. Add a lead in **New lead** → this starts a durable `CrmLeadWorkflow` in Temporal, persisted to Supabase.
3. Click a lead to open it, then drive the pipeline with **Advance / Mark won / Disqualify** (these are Temporal signals) — `New → Contacted → Qualified → Proposal → Won`.
4. Use the **AI assistant** (Draft outreach email, Next best action, Summarize deal, Qualify BANT) and **Save to timeline** to write the result back to the lead's durable history.

### System Monitoring
1. Open **Monitoring** to see every service's status and latency; toggle **Auto-refresh** for 10s polling.
2. **Token usage** accrues automatically as you use any app — totals, per-model prompt/completion split and throughput. Use **Reset** to clear local counters.

## Prerequisites
- Docker Desktop with Compose v2
- `make` (comes with macOS/Linux; install via Xcode CLT on macOS)
- Node 18+ (optional for running the frontend outside Docker)
- Supabase CLI (optional) if you want the full Supabase stack locally

## Quick Start
1) Copy environment defaults  
   `cp .env.example .env`
2) Start everything  
   `make up`  
   (add `USE_DEV=1` for live-reload mounts)
3) Open services  
   - Frontend placeholder: http://localhost:3000  
   - Temporal UI: http://localhost:8080  
   - Temporal gRPC: localhost:7234  
   - Supabase Postgres stub: localhost:55432

Common commands:
- `make down` — stop containers
- `make reset` — tear down volumes and recreate containers
- `make logs` — stream all service logs
- `make logs-temporal` / `make logs-frontend` — targeted logs

## Deployment

End-to-end instructions for running the stack locally with Docker Compose and
deploying the SLM to **Azure Container Instances (ACI)**. For the full
step-by-step walkthrough see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md); for SLM
architecture and the API reference see [docs/SLM.md](docs/SLM.md).

### Prerequisites

| Tool | Version (min) | Used for | Check |
| --- | --- | --- | --- |
| Docker Desktop / Engine | 24+ | Local containers | `docker --version` |
| Docker Compose | v2 | Orchestration | `docker compose version` |
| `make` | any | Lifecycle shortcuts (optional) | `make --version` |
| Node | 18+ | Running the frontend outside Docker (optional) | `node --version` |
| Azure CLI | 2.50+ | Cloud deployment (optional) | `az version` |
| Bicep | bundled with Azure CLI | IaC templates | `az bicep version` |
| GitHub CLI | 2.0+ | Repo management (optional) | `gh --version` |

- An **Azure subscription** with rights to create resource groups and Container Instances (only for cloud deploy).
- **~4 GB free RAM** for the default model on CPU; more for larger Phi/Gemma/Llama models.
- Ports listed below must be free on the host.

### Service ports

| Service | URL / Port | Purpose |
| --- | --- | --- |
| Frontend | http://localhost:3000 | React app (playground, chat, all apps) |
| Ollama | http://localhost:11434 | Local model server (`OLLAMA_ORIGINS=*`) |
| CRM API | http://localhost:8096 | FastAPI for the CRM app (`/api/health`) |
| Showcase | http://localhost:8090 | Static SLM showcase (`/slm.html`) |
| Temporal UI | http://localhost:8080 | Workflow dashboard |
| Temporal gRPC | localhost:7234 | Worker/client endpoint |
| Supabase Postgres | localhost:55432 | App database |
| Mailpit | http://localhost:8025 | Email UI (SMTP on `:1025`) |
| Mailer | http://localhost:8200 | Mailer service |
| Chess / game-web | http://localhost:8095 | Demo game app |

### 1. Local deployment (Docker)

```bash
cp .env.example .env          # copy environment defaults
docker compose up -d          # start the full stack
# or: make up                 # (add USE_DEV=1 for live-reload mounts)
```

Start only the SLM services (server + default model pull + showcase):

```bash
docker compose up -d ollama ollama-pull showcase
docker compose logs -f ollama-pull   # wait for "success" — model is ready
```

### 2. Verify

```bash
docker compose ps                     # all services Up / healthy
docker exec ollama ollama list        # installed models
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:0.5b",
  "prompt": "Say hello in one short sentence.",
  "stream": false
}'
curl http://localhost:8096/api/health # CRM API + Temporal + Supabase status
```

Then open the app at **http://localhost:3000** and the **Monitoring** app
(`/apps/monitor`) to confirm every service is reporting healthy.

### 3. Add or switch models

```bash
docker exec ollama ollama pull phi4-mini:latest
docker exec ollama ollama pull gemma2:2b
```

New models appear automatically in the model pickers and the gallery.

### 4. Deploy the SLM to Azure (ACI)

```powershell
az login
./scripts/deploy-azure.ps1                                   # default model set
# custom set:
./scripts/deploy-azure.ps1 -Models 'qwen2.5:0.5b','llama3.2:1b'
```

The script creates the resource group, deploys the Bicep template under
`infra/azure/`, and prints the public **Ollama endpoint URL**. In the app's
**header endpoint selector**, choose **+ Add Azure endpoint…** and paste
`http://<fqdn>:11434` to point the playground and every app at the cloud
deployment.

### 5. Rebuilding after changes

- **Frontend** changes (anything under `frontend/`): `docker compose up -d --build frontend`
- **CRM API** changes (`temporal/src/crm_api.py`): `docker compose up -d --build crm-web`
- **Showcase** changes: `docker compose build --no-cache showcase && docker compose up -d --force-recreate showcase`
- **Docs / README only:** no rebuild needed.

### 6. Tear down

```bash
docker compose down                      # stop containers
docker compose down -v                   # also remove volumes (deletes pulled models + DB)
az group delete --name rg-slm-ollama --yes --no-wait   # remove Azure resources
```

### Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `port is already allocated` | A host port (3000, 11434, 8096, 8080, 55432…) is in use | Stop the conflicting process or change the mapping in `docker-compose.yml` |
| Frontend shows `ERR_EMPTY_RESPONSE` / blank | Vite still starting after a rebuild | Wait a few seconds for the container to be ready, then reload |
| `model not found` | Model not pulled yet | `docker exec ollama ollama pull <model>` or wait for the boot pull |
| Chat/app can't reach the model | Wrong endpoint or CORS | Confirm the endpoint selector; ensure `OLLAMA_ORIGINS=*` on the `ollama` service |
| Slow first response | Model loading into memory | Wait; subsequent calls are faster |
| CRM app shows no data / errors | `crm-web`, Temporal or Supabase not up | `docker compose ps`; check `docker compose logs crm-web temporal-worker supabase-db` |
| Monitoring shows a service **down** | That container is unhealthy | Inspect its logs: `docker compose logs <service>` |
| Out of memory | Model too large for host/ACI | Use a smaller model or raise `memoryInGb` in `main.bicepparam` |
| Azure 404 / no response | Models still downloading on boot | Wait 1–3 min; `az container logs --resource-group rg-slm-ollama --name slm-ollama` |
| Showcase shows old content | Stale Docker image | `docker compose build --no-cache showcase && docker compose up -d --force-recreate showcase` |

## Local & Cloud SLM (Ollama)
A GPT‑style small language model runs locally in Docker and can be deployed to Azure.
- **Server:** `ollama` service on http://localhost:11434 (default model `qwen2.5:0.5b`; also `llama3.2:1b`, `gemma2:2b`)
- **Showcase UI:** http://localhost:8090/slm.html — live streaming demo with endpoint + model dropdowns
- **Cloud:** Bicep IaC under `infra/azure/` deploys Ollama to Azure Container Instances

Quick start:
```bash
docker compose up -d ollama ollama-pull   # start server + pull default model
```
See [docs/SLM.md](docs/SLM.md) for full architecture, model management, Azure deployment, API reference, and troubleshooting.
For a step‑by‑step local + Azure deployment walkthrough, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## What’s Included (Phase 1)
- Docker Compose stack with Temporal server, UI, worker, frontend dev server, and stub Supabase Postgres
- Development overrides in `docker-compose.dev.yml` for live-reloading frontend and worker code
- Makefile wrappers for the usual lifecycle commands
- `.env.example` capturing required variables for frontend, Temporal, and Supabase placeholders

## Notes
- Supabase services are intentionally stubbed for Phase 1; use `supabase start --config supabase/config.toml` when you need the full Supabase stack.
- Frontend and Temporal code are minimal placeholders to keep containers healthy; replace with real implementations in Phases 2–3.
