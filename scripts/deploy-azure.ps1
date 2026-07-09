<#
.SYNOPSIS
  Deploy the SLM (Ollama) models to Azure Container Instances.

.DESCRIPTION
  Creates the resource group (if needed) and deploys the Bicep template in
  infra/azure, pulling the requested models on container startup. Prints the
  public Ollama endpoint URL you can paste into the app's "Add Azure endpoint".

.EXAMPLE
  ./scripts/deploy-azure.ps1
  Deploys the playground's seven small language models.

.EXAMPLE
  ./scripts/deploy-azure.ps1 -Models 'qwen2.5:0.5b','llama3.2:1b'
  Deploys only the two specified models.
#>
[CmdletBinding()]
param(
  [string]$ResourceGroup = 'rg-slm-ollama',
  [string]$Location = 'canadaeast',
  [string]$DnsNameLabel = 'model-comparison-tech-a6y7xc7',
  [string[]]$Models = @('qwen2.5:0.5b', 'llama3.2:1b', 'gemma2:2b', 'deepseek-r1:1.5b', 'phi3:mini', 'phi3.5:3.8b', 'phi4-mini'),
  [int]$CpuCores = 4,
  [int]$MemoryInGb = 12,
  [string]$FrontendImage = '',
  [string]$ContainerRegistryServer = '',
  [string]$ContainerRegistryUsername = '',
  [string]$ContainerRegistryPassword = '',
  [string]$CaddyAcmeEmail = 'admin@model-comparison-tech-a6y7xc7.canadaeast.azurecontainer.io'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$template = Join-Path $repoRoot 'infra/azure/main.bicep'

function Invoke-AzChecked {
  param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI failed with exit code ${LASTEXITCODE}: az $($Arguments -join ' ')"
  }
}

$groupExists = & az group exists --name $ResourceGroup
if ($LASTEXITCODE -ne 0) {
  throw "Azure CLI failed while checking resource group '$ResourceGroup'."
}

if ($groupExists -eq 'true') {
  $groupLocation = & az group show --name $ResourceGroup --query location --output tsv
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI failed while reading resource group '$ResourceGroup'."
  }
  Write-Host "Using existing resource group '$ResourceGroup' in '$groupLocation'." -ForegroundColor Cyan
}
else {
  Write-Host "Creating resource group '$ResourceGroup' in '$Location'..." -ForegroundColor Cyan
  Invoke-AzChecked group create --name $ResourceGroup --location $Location --output none
}

$parametersPath = Join-Path ([System.IO.Path]::GetTempPath()) "slm-ollama-parameters-$([System.Guid]::NewGuid()).json"
$parameters = @{
  '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
  contentVersion = '1.0.0.0'
  parameters = @{
    location = @{ value = $Location }
    dnsNameLabel = @{ value = $DnsNameLabel }
    models = @{ value = $Models }
    cpuCores = @{ value = $CpuCores }
    memoryInGb = @{ value = $MemoryInGb }
    frontendImage = @{ value = $FrontendImage }
    containerRegistryServer = @{ value = $ContainerRegistryServer }
    containerRegistryUsername = @{ value = $ContainerRegistryUsername }
    containerRegistryPassword = @{ value = $ContainerRegistryPassword }
    caddyAcmeEmail = @{ value = $CaddyAcmeEmail }
  }
} | ConvertTo-Json -Depth 10

Set-Content -Path $parametersPath -Value $parameters -Encoding utf8

Write-Host "Deploying models: $($Models -join ', ')" -ForegroundColor Cyan
try {
  Invoke-AzChecked deployment group create `
    --resource-group $ResourceGroup `
    --template-file $template `
    --parameters "@$parametersPath" `
    --output none
}
finally {
  Remove-Item -Path $parametersPath -ErrorAction SilentlyContinue
}

$ollamaUrl = & az deployment group show `
  --resource-group $ResourceGroup `
  --name main `
  --query properties.outputs.ollamaUrl.value `
  --output tsv
if ($LASTEXITCODE -ne 0) {
  throw "Azure CLI failed while reading the deployment output."
}

$appUrl = & az deployment group show `
  --resource-group $ResourceGroup `
  --name main `
  --query properties.outputs.appUrl.value `
  --output tsv
if ($LASTEXITCODE -ne 0) {
  throw "Azure CLI failed while reading the frontend deployment output."
}

Write-Host ''
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Ollama endpoint: $ollamaUrl"
if ($appUrl) {
  Write-Host "Application URL: $appUrl"
}
Write-Host "Paste this into the app header's 'Add Azure endpoint' to use it."
Write-Host ''
Write-Host "Models pull on startup; the first request may take 1-3 minutes."
Write-Host "Tear down with: az group delete --name $ResourceGroup --yes --no-wait"
