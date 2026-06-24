@description('Azure region for the deployment.')
param location string = resourceGroup().location

@description('Name of the Azure Container Instances container group.')
param containerGroupName string = 'slm-ollama'

@description('DNS name label for the public FQDN. Must be unique within the region.')
param dnsNameLabel string = 'slm-ollama-${uniqueString(resourceGroup().id)}'

@description('Ollama models to pull on startup.')
param models string[] = [
  'qwen2.5:0.5b'
]

@description('Number of CPU cores for the container.')
param cpuCores int = 2

@description('Memory in GB for the container.')
param memoryInGb int = 4

var ollamaPort = 11434

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
  properties: {
    osType: 'Linux'
    restartPolicy: 'Always'
    ipAddress: {
      type: 'Public'
      dnsNameLabel: dnsNameLabel
      ports: [
        {
          protocol: 'TCP'
          port: ollamaPort
        }
      ]
    }
    containers: [
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
    ]
  }
}

@description('Public FQDN of the Ollama endpoint.')
output fqdn string = containerGroup.properties.ipAddress.fqdn

@description('Base URL for the Ollama API.')
output ollamaUrl string = 'http://${containerGroup.properties.ipAddress.fqdn}:${ollamaPort}'

@description('Public IP address of the container group.')
output publicIp string = containerGroup.properties.ipAddress.ip
