# Deployment Guide

A detailed, step-by-step guide to deploying the **full stack** — the React
frontend (model playground, AI chat, 16 mini-apps, CRM and monitoring), the
**Ollama** small-language-model server, the **Temporal** workflow engine, the
**Supabase** Postgres database, the **CRM API**, **Mailpit**, and the static
**showcase UI** — locally with Docker Compose, and deploying the SLM to **Azure
Container Instances (ACI)**.

For architecture, models, and API details, see [SLM.md](./SLM.md).

---

## Table of contents
- [Prerequisites](#prerequisites)
- [Service map](#service-map)
- [1. Clone the repository](#1-clone-the-repository)
- [2. Configure environment](#2-configure-environment)
- [3. Deploy the full stack locally](#3-deploy-the-full-stack-locally)
- [4. Verify each service](#4-verify-each-service)
- [5. Open the apps](#5-open-the-apps)
- [6. Add or switch models](#6-add-or-switch-models)
- [7. Deploy to Azure (ACI)](#7-deploy-to-azure-aci)
- [8. Use the Azure endpoint from the app](#8-use-the-azure-endpoint-from-the-app)
- [9. Rebuilding after code changes](#9-rebuilding-after-code-changes)
- [10. Tear down](#10-tear-down)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version (min) | Used for | Check |
|------|---------------|----------|-------|
| Docker Desktop / Engine | 24+ | Local containers | `docker --version` |
| Docker Compose | v2 | Orchestration | `docker compose version` |
| `make` (optional) | any | Lifecycle shortcuts | `make --version` |
| Git | 2.0+ | Clone the repo | `git --version` |
| Azure CLI (optional) | 2.50+ | Cloud deployment | `az version` |
| Bicep (optional) | bundled with Azure CLI | IaC templates | `az bicep version` |
| GitHub CLI (optional) | 2.0+ | Repo management | `gh --version` |

- An **Azure subscription** with rights to create resource groups and Container Instances (cloud deploy only).
- **~6 GB free RAM** to comfortably run the full stack plus the default model on CPU; more for larger Phi/Gemma/Llama models.
- The host ports listed in the [service map](#service-map) must be free.

---

## Service map

The full stack starts the following containers. Confirm these host ports are
available before deploying.

| Service | Container | Host URL / Port | Purpose |
|---------|-----------|-----------------|---------|
| Frontend | `frontend` | http://localhost:3000 | React app: playground, chat, all apps |
| Ollama | `ollama` | http://localhost:11434 | Local model server (`OLLAMA_ORIGINS=*`) |
| Model pull | `ollama-pull` | one-shot job | Downloads the default model on first boot |
| CRM API | `crm-web` | http://localhost:8096 | FastAPI for the CRM app (`/api/health`) |
| Temporal server | `temporal` | localhost:7234 (gRPC) | Workflow engine |
| Temporal UI | `temporal-ui` | http://localhost:8080 | Workflow dashboard |
| Temporal worker | `temporal-worker` | — | Runs CRM workflows + activities |
| Temporal DB | `temporal-db` | localhost:5433 | Temporal's own Postgres |
| Supabase Postgres | `supabase-db` | localhost:55432 | App database (CRM data) |
| Mailpit | `mailpit` | http://localhost:8025 (SMTP `:1025`) | Captures outgoing email |
| Mailer | `mailer` | http://localhost:8200 | Mailer service |
| Showcase | `showcase` | http://localhost:8090 | Static SLM showcase (`/slm.html`) |
| Chess / game | `game-web` | http://localhost:8095 | Demo game app |

---

## 1. Clone the repository

```bash
git clone https://github.com/KrishnaDistributedcomputing/local-slm-playground.git
cd local-slm-playground
```

---

## 2. Configure environment

Copy the environment defaults. The provided values work out of the box for local
development:

```bash
cp .env.example .env
```

Key variables (override only if you need to):

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_ORIGINS` | `*` | Lets the browser call Ollama directly in dev |
| `VITE_CRM_URL` | `http://localhost:8096` | Frontend → CRM API base URL |
| `VITE_OLLAMA_AZURE_URL` | _(empty)_ | Optional default Azure model endpoint |

---

## 3. Deploy the full stack locally

Start every service in the background:

```bash
docker compose up -d
# or, using the Makefile wrapper:
make up
# add live-reload mounts for frontend/worker code:
USE_DEV=1 make up
```

This builds the images on first run and starts all containers. The one-shot
**`ollama-pull`** job downloads the default model `qwen2.5:0.5b` (~397 MB) into
the shared `ollama-data` volume.

Watch the initial model download finish:

```bash
docker compose logs -f ollama-pull   # wait for "success", then Ctrl-C
```

> **SLM only:** to start just the model services (server + default-model pull +
> showcase) without Temporal/Supabase/CRM, run:
> ```bash
> docker compose up -d ollama ollama-pull showcase
> ```

---

## 4. Verify each service

Confirm everything is healthy before using the apps.

**All containers up:**

```bash
docker compose ps      # every service should show "Up" / "healthy"
```

**Ollama (models + a test prompt):**

```bash
docker exec ollama ollama list
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:0.5b",
  "prompt": "Say hello in one short sentence.",
  "stream": false
}'
```

You should get JSON containing a `"response"` field with the model's reply.

**CRM API + its dependencies (Temporal + Supabase):**

```bash
curl http://localhost:8096/api/health
```

This returns the overall status plus per-dependency results for Temporal and the
Supabase database (including the current contact count).

**Temporal UI:** open http://localhost:8080 — you should see the default
namespace and (after creating CRM leads) running `CrmLeadWorkflow` executions.

**One-glance check:** open the **Monitoring** app at
http://localhost:3000/apps/monitor — it shows live status and latency for Ollama,
CRM API, Frontend, Temporal, Mailpit and Supabase DB, and should report every
service operational.

---

## 5. Open the apps

Open the frontend at **http://localhost:3000** and pick an app from the left
sidebar:

1. **Local Models Playground** (`/`) — browse every installed model.
2. **AI Chat** (`/chat`) — streaming chat; pick a model from the dropdown.
3. **Text & code tools** (`/apps/...`) — Summarizer, Translator, Code Reviewer,
   Data Extractor, Email Writer, Proofreader, Tone Rewriter, Brainstormer,
   Explainer, SQL Generator, JSON Builder, Azure Architecture Advisor,
   Polymarket and Kalshi analysts.
4. **CRM (Sales)** (`/apps/crm`) — add a lead (starts a durable Temporal
   workflow persisted to Supabase), then drive the pipeline with
   Advance / Mark won / Disqualify and use the AI assistant.
5. **Monitoring** (`/apps/monitor`) — service health and per-model token usage.

The static **showcase** is also available at http://localhost:8090/slm.html with
its own Endpoint/Model dropdowns.

---

## 6. Add or switch models

Pull additional models into the running container:

```bash
docker exec ollama ollama pull llama3.2:1b
docker exec ollama ollama pull gemma2:2b
```

| Model | Params | Size | Notes |
|-------|--------|------|-------|
| `qwen2.5:0.5b` | ~0.5B | ~397 MB | Default, fastest |
| `llama3.2:1b`  | ~1B   | ~1.3 GB | Better quality |
| `gemma2:2b`    | ~2B   | ~1.6 GB | Best quality, slower on CPU |

The showcase **Model** dropdown refreshes automatically from the endpoint's
`/api/tags`, so newly pulled models appear after you switch/refresh the endpoint.

### Strengths & weaknesses guide

The **left navigation sidebar** of the app (`http://localhost:3000`) includes a
**"Which model should I use?"** panel that summarizes the strengths and
trade-offs of each installed model, so you can pick the right one for a task:

| Model | Best for | Watch out for |
|-------|----------|---------------|
| `qwen2.5:0.5b` | Instant replies & simple instructions; very low RAM | Limited reasoning, weaker on long context/code |
| `llama3.2:1b`  | Balanced everyday chat & summaries | Weaker math/code, modest world knowledge |
| `gemma2:2b`    | Higher-quality writing & knowledge, stronger reasoning | Largest/slowest, needs the most RAM |
| `deepseek-r1:1.5b` | Step-by-step reasoning, math & logic | Verbose `<think>` output, slower; overkill for simple chat |

These profiles live in `frontend/src/data/modelProfiles.ts` — add an entry there
to document a newly pulled model.

---

## 7. Deploy to Azure (ACI)

The infrastructure is defined as Bicep in `infra/azure/`. The container pulls
**one or more** models on startup, so you can deploy the same set you run
locally.

### Quick deploy (script)

From the repo root, deploy the default model set with one command:

```powershell
./scripts/deploy-azure.ps1
```

Deploy a custom set of models:

```powershell
./scripts/deploy-azure.ps1 -Models 'qwen2.5:0.5b','llama3.2:1b'
```

The script creates the resource group, deploys the template, and prints the
public **Ollama endpoint URL**. Skip to [section 8](#8-use-the-azure-endpoint-from-the-app)
to use it from the app. The manual steps below do the same thing.

### 7a. Sign in and pick a subscription

```bash
az login
az account set --subscription "<your-subscription-id-or-name>"
```

### 7b. Create a resource group

```bash
az group create --name rg-slm-ollama --location eastus
```

### 7c. Review / adjust parameters

Edit `infra/azure/main.bicepparam` to change the region, the **list of models**,
or the container size:

```bicep
using './main.bicep'

param location = 'eastus'
param containerGroupName = 'slm-ollama'
param models = [
  'qwen2.5:0.5b'
  'llama3.2:1b'
  'gemma2:2b'
  'deepseek-r1:1.5b'
]
param cpuCores = 2
param memoryInGb = 6
```

### 7d. (Optional) Validate the template

```bash
az deployment group validate \
  --resource-group rg-slm-ollama \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam
```

### 7e. Deploy

```bash
az deployment group create \
  --resource-group rg-slm-ollama \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam
```

On success, read the outputs (public FQDN and API URL):

```bash
az deployment group show \
  --resource-group rg-slm-ollama \
  --name main \
  --query properties.outputs
```

The container starts Ollama, pulls the models on boot, then serves on port
`11434`. It can take 1–3 minutes for the models to finish downloading the first
time.

> **Note on persistence:** Azure Files mounting is intentionally omitted because
> some subscriptions disable storage-account key access by org policy. The
> container re-pulls the models on startup, so it self-heals after any restart.

### 7f. Test the cloud endpoint

```bash
curl http://<fqdn-from-outputs>:11434/api/generate -d '{
  "model": "qwen2.5:0.5b",
  "prompt": "Say hello from Azure.",
  "stream": false
}'
```

---

## 8. Use the Azure endpoint from the app

The playground and all mini-apps can target the Azure deployment at runtime:

1. Open the app (`http://localhost:3000`).
2. In the **header endpoint selector** (top right), choose **+ Add Azure
   endpoint…** and paste the `http://<fqdn>:11434` URL from the deploy output.
3. The app reloads pointed at Azure; the model gallery, chat, and apps now use
   the cloud models. Switch back to **Local (Docker)** any time.

You can also set a default Azure endpoint via the `VITE_OLLAMA_AZURE_URL`
environment variable on the `frontend` service.

### Static showcase page

The standalone showcase (`http://localhost:8090/slm.html`) also has an
**Endpoint** dropdown (Local / Azure). To bake your Azure URL into it, update the
Azure option's `value` in `showcase/slm.html`, then rebuild:

```bash
docker compose build --no-cache showcase
docker compose up -d --force-recreate showcase
```

---

## 9. Rebuilding after code changes

The frontend image bakes the source at build time, so code edits require a
rebuild of the affected service:

| You changed… | Rebuild command |
|--------------|-----------------|
| Anything under `frontend/` | `docker compose up -d --build frontend` |
| `temporal/src/crm_api.py` (CRM API) | `docker compose up -d --build crm-web` |
| Temporal workflows/activities (`temporal/src/...`) | `docker compose up -d --build temporal-worker` |
| `showcase/slm.html` | `docker compose build --no-cache showcase && docker compose up -d --force-recreate showcase` |
| Docs / README only | _no rebuild needed_ |

After a frontend rebuild, wait a few seconds for Vite to come up before
reloading the browser (navigating too early returns `ERR_EMPTY_RESPONSE`).

---

## 10. Tear down

### Local

```bash
docker compose down            # stop containers
docker compose down -v         # also remove volumes (deletes models + databases)
```

### Azure

```bash
az group delete --name rg-slm-ollama --yes --no-wait
```

This removes the container group and all associated resources.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `port is already allocated` | A host port (3000, 11434, 8096, 8080, 55432…) is in use | Stop the conflicting process or change the mapping in `docker-compose.yml` |
| Frontend `ERR_EMPTY_RESPONSE` / blank page | Vite still starting after a build | Wait a few seconds, then reload |
| `model not found` | Model not pulled yet | `docker exec ollama ollama pull <model>` or wait for boot pull |
| Chat/app can't reach the model | Endpoint URL wrong or CORS | Confirm the endpoint selector; ensure `OLLAMA_ORIGINS=*` is set |
| Slow first response | Model loading into memory | Wait; subsequent calls are faster |
| CRM app shows no data / errors | `crm-web`, Temporal or Supabase not up | `docker compose ps`; check `docker compose logs crm-web temporal-worker supabase-db` |
| `/api/health` reports a dependency down | Temporal or Supabase unhealthy | Inspect that container's logs and restart it |
| Monitoring app shows a service **down** | That container is unhealthy | `docker compose logs <service>` |
| Out of memory | Model too large for host/ACI | Use a smaller model or increase `memoryInGb` |
| Azure 404 / no response | Model still downloading on boot | Wait 1–3 min; check `az container logs` |
| Showcase shows old content | Stale Docker image | `docker compose build --no-cache showcase && docker compose up -d --force-recreate showcase` |

View logs for any local service:

```bash
docker compose logs -f <service>     # e.g. frontend, crm-web, temporal-worker, ollama
```

View Azure container logs:

```bash
az container logs --resource-group rg-slm-ollama --name slm-ollama
```
