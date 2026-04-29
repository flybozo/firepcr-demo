import type { Provider, ProviderID } from '../types.js'
import { anthropicProvider } from './anthropic.js'
import { openaiProvider } from './openai.js'
import { openclawGatewayProvider } from './openclaw-gateway.js'

/**
 * Provider registry. To add a new provider:
 * 1. Create providers/<name>.ts implementing the Provider interface
 * 2. Import and add it to REGISTRY below
 * 3. Update routes.ts to route task categories to it
 * 4. Set baaSigned: true once a BAA is executed
 */
const REGISTRY: Record<ProviderID, Provider> = {
  'anthropic':        anthropicProvider,
  'openai':           openaiProvider,
  'openclaw-gateway': openclawGatewayProvider,
}

export function getProvider(id: ProviderID): Provider {
  const provider = REGISTRY[id]
  if (!provider) throw new Error(`Unknown provider: "${id}" — add it to providers/index.ts`)
  return provider
}

export { anthropicProvider, openaiProvider, openclawGatewayProvider }
