<#
.SYNOPSIS
  Deploy the SLM (Ollama) models to Azure Container Instances.

.DESCRIPTION
  Creates the resource group (if needed) and deploys the Bicep template in
  infra/azure, pulling the requested models on container startup. Prints the
  public Ollama endpoint URL you can paste into the app's "Add Azure endpoint".

.EXAMPLE
  ./scripts/deploy-azure.ps1
  Deploys the default model set (qwen2.5:0.5b, llama3.2:1b, gemma2:2b, deepseek-r1:1.5b).

.EXAMPLE
  ./scripts/deploy-azure.ps1 -Models 'qwen2.5:0.5b','llama3.2:1b'
  Deploys only the two specified models.
#>
[CmdletBinding()]
param(
  [string]$ResourceGroup = 'rg-slm-ollama',
  [string]$Location = 'eastus',
  [string[]]$Models = @('qwen2.5:0.5b', 'llama3.2:1b', 'gemma2:2b', 'deepseek-r1:1.5b'),
  [int]$CpuCores = 2,
  [int]$MemoryInGb = 6
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $repoRoot 'infra/azure/main.bicep'

Write-Host "Ensuring resource group '$ResourceGroup' in '$Location'..." -ForegroundColor Cyan
az group create --name $ResourceGroup --location $Location --output none

# Build a JSON array literal for the models parameter, e.g. ["a","b"].
$modelsJson = '[' + (($Models | ForEach-Object { '"' + $_ + '"' }) -join ',') + ']'

Write-Host "Deploying models: $($Models -join ', ')" -ForegroundColor Cyan
az deployment group create `
  --resource-group $ResourceGroup `
  --template-file $template `
  --parameters location=$Location `
  --parameters models=$modelsJson `
  --parameters cpuCores=$CpuCores `
  --parameters memoryInGb=$MemoryInGb `
  --output none

$ollamaUrl = az deployment group show `
  --resource-group $ResourceGroup `
  --name main `
  --query properties.outputs.ollamaUrl.value `
  --output tsv

Write-Host ''
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Ollama endpoint: $ollamaUrl"
Write-Host "Paste this into the app header's 'Add Azure endpoint' to use it."
Write-Host ''
Write-Host "Models pull on startup; the first request may take 1-3 minutes."
Write-Host "Tear down with: az group delete --name $ResourceGroup --yes --no-wait"
