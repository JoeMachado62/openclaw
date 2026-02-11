/**
 * Model Router Types
 * T0-T3 tier system for cost optimization
 */

export type ModelTier = 'T0' | 'T1' | 'T2' | 'T3';

export type ModelProvider = 'ollama' | 'anthropic' | 'openai';

export interface ModelConfig {
  tier: ModelTier;
  provider: ModelProvider;
  model: string;
  costPer1MTokens: number;
  maxTokens?: number;
  temperature?: number;
}

export interface RouterConfig {
  models: {
    T0: ModelConfig;
    T1: ModelConfig;
    T2: ModelConfig;
    T3: ModelConfig;
  };
  rules: RouterRule[];
  fallbackTier: ModelTier;
  enableCostTracking: boolean;
}

export interface RouterRule {
  name: string;
  condition: (context: RouteContext) => boolean;
  tier: ModelTier;
  priority: number; // Higher = evaluated first
}

export interface RouteContext {
  taskType: TaskType;
  complexity: TaskComplexity;
  inputLength: number;
  requiresTools: boolean;
  confidenceThreshold?: number;
  maxCost?: number;
  metadata?: Record<string, any>;
}

export type TaskType =
  | 'heartbeat'
  | 'simple_query'
  | 'contact_lookup'
  | 'data_formatting'
  | 'classification'
  | 'conversation_handling'
  | 'task_extraction'
  | 'workflow_orchestration'
  | 'complex_reasoning'
  | 'error_recovery'
  | 'strategy_decision';

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'advanced';

export interface RouteDecision {
  tier: ModelTier;
  model: ModelConfig;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  alternatives?: ModelTier[];
}

export interface ModelResponse {
  content: string;
  tier: ModelTier;
  model: string;
  tokensUsed: number;
  cost: number;
  latencyMs: number;
  confidence?: number;
}

export interface EscalationResult {
  escalated: boolean;
  fromTier: ModelTier;
  toTier: ModelTier;
  reason: string;
  response: ModelResponse;
}

export interface CostMetrics {
  tier: ModelTier;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  escalations: number;
}
