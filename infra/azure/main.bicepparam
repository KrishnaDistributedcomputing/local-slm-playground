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
