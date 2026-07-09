using './main.bicep'

param location = 'canadaeast'
param containerGroupName = 'slm-ollama'
param dnsNameLabel = 'slm-notify-hub-a6y7xc7'
param tags = {
  workload: 'local-slm-playground'
  environment: 'demo'
  owner: 'kvenk'
  region: 'canadaeast'
  managedBy: 'bicep'
  costCenter: 'dev-day'
}
param models = [
  'qwen2.5:0.5b'
  'llama3.2:1b'
  'gemma2:2b'
  'deepseek-r1:1.5b'
  'phi3:mini'
  'phi3.5:3.8b'
  'phi4-mini'
]
param cpuCores = 4
param memoryInGb = 12
