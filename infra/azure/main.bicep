@description('Azure region for the deployment.')
param location string = resourceGroup().location

@description('Name of the Azure Container Instances container group.')
param containerGroupName string = 'slm-ollama'

@description('DNS name label for the public FQDN. Must be unique within the region.')
param dnsNameLabel string = 'slm-ollama-${uniqueString(resourceGroup().id)}'

type ResourceTags = {
  workload: string
  environment: string
  owner: string
  region: string
  managedBy: string
  costCenter: string
}

@description('Tags applied to Azure resources created by this template.')
param tags ResourceTags = {
  workload: 'local-slm-playground'
  environment: 'demo'
  owner: 'kvenk'
  region: 'canadaeast'
  managedBy: 'bicep'
  costCenter: 'dev-day'
}

@description('Ollama models to pull on startup.')
param models string[] = [
  'qwen2.5:0.5b'
]

@description('Number of CPU cores for the container.')
param cpuCores int = 2

@description('Memory in GB for the container.')
param memoryInGb int = 4

@description('Optional frontend container image to serve the app UI from the same container group.')
param frontendImage string = ''

@description('Public port for the frontend app UI.')
param frontendPort int = 3000

@description('Container registry server for private images, for example myregistry.azurecr.io.')
param containerRegistryServer string = ''

@description('Contact email used by Caddy for ACME certificate issuers.')
param caddyAcmeEmail string = 'admin@model-comparison-a6y7xc7.canadaeast.azurecontainer.io'

@description('Container registry username for private images.')
param containerRegistryUsername string = ''

@secure()
@description('Container registry password for private images.')
param containerRegistryPassword string = ''

var ollamaPort = 11434
var frontendEnabled = !empty(frontendImage)
var appFqdn = '${dnsNameLabel}.${location}.azurecontainer.io'
var httpPort = 80
var httpsPort = 443
var frontendInternalPort = 3001
var caddyCommand = 'printf "%s\n" "{" "  email ${caddyAcmeEmail}" "}" "" "http://${appFqdn}:${frontendPort} {" "  redir https://${appFqdn}{uri} permanent" "}" "" "${appFqdn} {" "  encode gzip" "" "  handle /api/* {" "    reverse_proxy 127.0.0.1:${ollamaPort}" "  }" "" "  handle {" "    reverse_proxy 127.0.0.1:${frontendInternalPort}" "  }" "}" > /etc/caddy/Caddyfile && caddy run --config /etc/caddy/Caddyfile --adapter caddyfile'

// Pull every requested model on startup, one after another.
var pullCommand = join(map(models, m => 'ollama pull ${m}'), ' && ')

// NOTE: Persistent model storage via Azure Files is intentionally omitted.
// ACI's Azure Files volume mount requires storage account key access, which is
// disabled by org policy (allowSharedKeyAccess=false) on this subscription.
// Instead, the container re-pulls the model on startup (see command below),
// which self-heals after any restart.

resource containerGroup 'Microsoft.ContainerInstance/containerGroups@2023-05-01' = {
  name: containerGroupName
  location: location
  tags: tags
  properties: {
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Public'
      dnsNameLabel: dnsNameLabel
      ports: concat([
        {
          protocol: 'TCP'
          port: ollamaPort
        }
      ], frontendEnabled ? [
        {
          protocol: 'TCP'
          port: httpPort
        }
        {
          protocol: 'TCP'
          port: httpsPort
        }
        {
          protocol: 'TCP'
          port: frontendPort
        }
        {
          protocol: 'TCP'
          port: frontendInternalPort
        }
      ] : [])
    }
    imageRegistryCredentials: empty(containerRegistryServer) ? [] : [
      {
        server: containerRegistryServer
        username: containerRegistryUsername
        password: containerRegistryPassword
      }
    ]
    containers: concat([
      {
        name: 'ollama'
        properties: {
          image: 'ollama/ollama:latest'
          // Start the server in the background, pull the models, then keep serving.
          command: [
            '/bin/sh'
            '-c'
            'ollama serve & sleep 8 && ${pullCommand} && wait'
          ]
          ports: [
            {
              protocol: 'TCP'
              port: ollamaPort
            }
          ]
          environmentVariables: [
            {
              name: 'OLLAMA_ORIGINS'
              value: '*'
            }
            {
              name: 'OLLAMA_HOST'
              value: '0.0.0.0:${ollamaPort}'
            }
          ]
          resources: {
            requests: {
              cpu: cpuCores
              memoryInGB: memoryInGb
            }
          }
        }
      }
    ], frontendEnabled ? [
      {
        name: 'https-proxy'
        properties: {
          image: 'caddy:2-alpine'
          command: [
            '/bin/sh'
            '-c'
            caddyCommand
          ]
          ports: [
            {
              protocol: 'TCP'
              port: httpPort
            }
            {
              protocol: 'TCP'
              port: httpsPort
            }
            {
              protocol: 'TCP'
              port: frontendPort
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
        }
      }
      {
        name: 'frontend'
        properties: {
          image: frontendImage
          command: [
            'npm'
            'run'
            'preview'
            '--'
            '--host'
            '0.0.0.0'
            '--port'
            '${frontendInternalPort}'
          ]
          ports: [
            {
              protocol: 'TCP'
              port: frontendInternalPort
            }
          ]
          environmentVariables: [
            {
              name: 'VITE_OLLAMA_URL'
              value: 'https://${appFqdn}'
            }
            {
              name: 'VITE_OLLAMA_MODEL'
              value: contains(models, 'phi3.5:3.8b') ? 'phi3.5:3.8b' : models[0]
            }
          ]
          resources: {
            requests: {
              cpu: 1
              memoryInGB: 1
            }
          }
        }
      }
    ] : [])
  }
}

@description('Public FQDN of the Ollama endpoint.')
output fqdn string = containerGroup.properties.ipAddress.fqdn

@description('Base URL for the Ollama API.')
output ollamaUrl string = 'http://${containerGroup.properties.ipAddress.fqdn}:${ollamaPort}'

@description('Base URL for the frontend app UI when a frontend image is supplied.')
output appUrl string = frontendEnabled ? 'https://${containerGroup.properties.ipAddress.fqdn}' : ''

@description('HTTP URL that redirects to the secure frontend app URL when a frontend image is supplied.')
output appRedirectUrl string = frontendEnabled ? 'http://${containerGroup.properties.ipAddress.fqdn}:${frontendPort}' : ''

@description('Public IP address of the container group.')
output publicIp string = containerGroup.properties.ipAddress.ip
