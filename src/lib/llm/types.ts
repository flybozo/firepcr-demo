export type TaskCategory =
  | 'clinical-evidence'
  | 'clinical-extraction'
  | 'clinical-summary'
  | 'clinical-reasoning'
  | 'operational'
  | 'documentation-help'
  | 'schedule-generation'

export type PHIClass = 'none' | 'limited' | 'full'

export type ProviderID = 'anthropic' | 'openai' | 'openclaw-gateway'

export interface LLMMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  task: TaskCategory
  phiClass: PHIClass
  messages: LLMMessage[]
  system?: string
  /** Override the default model for this task's provider */
  model?: string
  maxTokens?: number
  temperature?: number
  userId?: string
  routeEndpoint?: string
  /**
   * Override cacheability for limited-PHI calls.
   * Has no effect on full-PHI (always skipped) or tasks that are never cached.
   */
  allowCache?: boolean
  /** Pass an existing Supabase service client; if omitted one is created from env vars */
  supabase?: SupabaseClientLike
}

export interface LLMCallParams {
  model: string
  messages: LLMMessage[]
  system?: string
  maxTokens?: number
  temperature?: number
}

export interface LLMResponse {
  content: string
  model: string
  provider: ProviderID
  tokensIn: number
  tokensOut: number
  tokensCached: number
  cacheHit: boolean
  latencyMs: number
}

export interface Provider {
  id: ProviderID
  /** Set to true only after a BAA is signed with this provider */
  baaSigned: boolean
  models: Record<string, string>
  call: (params: LLMCallParams) => Promise<Omit<LLMResponse, 'cacheHit' | 'latencyMs'>>
  healthCheck: () => Promise<boolean>
}

/** Minimal Supabase client interface we use — avoids complex generic type imports */
export interface SupabaseClientLike {
  from: (table: string) => any
}

export class LLMRoutingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMRoutingError'
  }
}
