# Deployment Guide

Step-by-step instructions to deploy the **SLM (Ollama) stack** — locally with
Docker Compose and to the cloud with **Azure Container Instances (ACI)** — plus
the interactive **showcase UI**.

For architecture, models, and API details, see [SLM.md](./SLM.md).

---

## Table of contents
- [Prerequisites](#prerequisites)
- [1. Clone the repository](#1-clone-the-repository)
- [2. Deploy locally with Docker](#2-deploy-locally-with-docker)
- [3. Verify the local SLM](#3-verify-the-local-slm)
- [4. Open the showcase UI](#4-open-the-showcase-ui)
- [5. Add or switch models](#5-add-or-switch-models)
- [6. Deploy to Azure (ACI)](#6-deploy-to-azure-aci)
- [7. Wire the showcase to Azure](#7-wire-the-showcase-to-azure)
- [8. Tear down](#8-tear-down)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version (min) | Used for | Check |
|------|---------------|----------|-------|
| Docker Desktop / Engine | 24+ | Local containers | `docker --version` |
| Docker Compose | v2 | Orchestration | `docker compose version` |
| Azure CLI | 2.50+ | Cloud deployment | `az version` |
| Bicep | bundled with Azure CLI | IaC templates | `az bicep version` |
| GitHub CLI (optional) | 2.0+ | Repo management | `gh --version` |

- An **Azure subscription** with rights to create resource groups and Container Instances.
- ~4 GB free RAM for the default model on CPU (more for larger models).

---

## 1. Clone the repository

```bash
git clone https://github.com/KrishnaDistributedcomputing/slm-ollama-stack.git
cd slm-ollama-stack
```

---

## 2. Deploy locally with Docker

The SLM ships as part of the project's `docker-compose.yml`. To start **only**
the SLM services (Ollama + model pull + showcase):

```bash
docker compose up -d ollama ollama-pull showcase
```

This will:

1. Start the **`ollama`** server on `http://localhost:11434`
   (`OLLAMA_ORIGINS=*` lets the browser call it directly in dev).
2. Run the one-shot **`ollama-pull`** job to download the default model
   `qwen2.5:0.5b` (~397 MB) into the shared `ollama-data` volume.
3. Start the **`showcase`** nginx site on `http://localhost:8090`.

> To start the full stack (Temporal, Supabase, mailer, frontend, SLM), run
> `docker compose up -d`.

Watch the model download finish:

```bash
docker compose logs -f ollama-pull
```

When you see `success`, the model is ready.

---

## 3. Verify the local SLM

List installed models:

```bash
docker exec ollama ollama list
```

Send a test prompt to the API:

```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:0.5b",
  "prompt": "Say hello in one short sentence.",
  "stream": false
}'
```

You should receive a JSON response containing a `"response"` field with the
model's reply.

---

## 4. Open the showcase UI

Open the interactive page in a browser:

```
http://localhost:8090/slm.html
```

From the UI you can:

- Pick the **Endpoint** (Local `localhost:11434` or your Azure ACI URL).
- Pick the **Model** from the dropdown (auto-populated from `/api/tags`).
- Chat with the model with streamed responses.

---

## 5. Add or switch models

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

## 6. Deploy to Azure (ACI)

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
public **Ollama endpoint URL**. Skip to [section 7](#7-use-the-azure-endpoint-from-the-app)
to use it from the app. The manual steps below do the same thing.

### 6a. Sign in and pick a subscription

```bash
az login
az account set --subscription "<your-subscription-id-or-name>"
```

### 6b. Create a resource group

```bash
az group create --name rg-slm-ollama --location eastus
```

### 6c. Review / adjust parameters

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

### 6d. (Optional) Validate the template

```bash
az deployment group validate \
  --resource-group rg-slm-ollama \
  --template-file infra/azure/main.bicep \
  --parameters infra/azure/main.bicepparam
```

### 6e. Deploy

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

### 6f. Test the cloud endpoint

```bash
curl http://<fqdn-from-outputs>:11434/api/generate -d '{
  "model": "qwen2.5:0.5b",
  "prompt": "Say hello from Azure.",
  "stream": false
}'
```

---

## 7. Use the Azure endpoint from the app

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

## 8. Tear down

### Local

```bash
docker compose down            # stop containers
docker compose down -v         # also remove volumes (deletes downloaded models)
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
| Showcase can't reach model | Endpoint URL wrong or CORS | Confirm endpoint, ensure `OLLAMA_ORIGINS=*` is set |
| `model not found` | Model not pulled yet | `docker exec ollama ollama pull <model>` or wait for boot pull |
| Slow first response | Model loading into memory | Wait; subsequent calls are faster |
| Azure 404 / no response | Model still downloading on boot | Wait 1–3 min; check `az container logs` |
| Out of memory | Model too large for host/ACI | Use a smaller model or increase `memoryInGb` |
| Showcase shows old content | Stale Docker image | `docker compose build --no-cache showcase && docker compose up -d --force-recreate showcase` |

View Azure container logs:

```bash
az container logs --resource-group rg-slm-ollama --name slm-ollama
```
