/**
 * Model Router Configuration
 * Default tier assignments and routing rules
 */

import type { RouterConfig, RouterRule, TaskType, ModelTier } from './types.js';

/**
 * Default model configuration for each tier
 */
export const DEFAULT_MODEL_CONFIG: RouterConfig = {
  models: {
    T0: {
      tier: 'T0',
      provider: 'ollama',
      model: 'llama3.1:8b',
      costPer1MTokens: 0, // Local/free
      maxTokens: 2048,
      temperature: 0.7,
    },
    T1: {
      tier: 'T1',
      provider: 'anthropic',
      model: 'claude-haiku-4.5',
      costPer1MTokens: 0.25, // $0.25 per 1M input tokens
      maxTokens: 4096,
      temperature: 0.7,
    },
    T2: {
      tier: 'T2',
      provider: 'anthropic',
      model: 'claude-sonnet-4.5',
      costPer1MTokens: 3.0, // $3 per 1M input tokens
      maxTokens: 8192,
      temperature: 0.7,
    },
    T3: {
      tier: 'T3',
      provider: 'anthropic',
      model: 'claude-opus-4.5',
      costPer1MTokens: 15.0, // $15 per 1M input tokens
      maxTokens: 16384,
      temperature: 0.7,
    },
  },
  rules: [],
  fallbackTier: 'T2',
  enableCostTracking: true,
};

/**
 * Task type to tier mapping
 */
export const TASK_TIER_MAP: Record<TaskType, ModelTier> = {
  heartbeat: 'T0',
  simple_query: 'T1',
  contact_lookup: 'T1',
  data_formatting: 'T1',
  classification: 'T1',
  conversation_handling: 'T2',
  task_extraction: 'T2',
  workflow_orchestration: 'T2',
  complex_reasoning: 'T3',
  error_recovery: 'T3',
  strategy_decision: 'T3',
};

/**
 * Default routing rules
 */
export const DEFAULT_ROUTING_RULES: RouterRule[] = [
  // T0 Rules - Free local inference
  {
    name: 'heartbeat_check',
    condition: (ctx) => ctx.taskType === 'heartbeat',
    tier: 'T0',
    priority: 100,
  },
  {
    name: 'simple_status_check',
    condition: (ctx) =>
      ctx.taskType === 'simple_query' && ctx.inputLength < 100 && !ctx.requiresTools,
    tier: 'T0',
    priority: 90,
  },

  // T1 Rules - Fast and cheap
  {
    name: 'contact_lookup',
    condition: (ctx) => ctx.taskType === 'contact_lookup',
    tier: 'T1',
    priority: 80,
  },
  {
    name: 'simple_classification',
    condition: (ctx) => ctx.taskType === 'classification' && ctx.inputLength < 500,
    tier: 'T1',
    priority: 75,
  },
  {
    name: 'data_formatting',
    condition: (ctx) => ctx.taskType === 'data_formatting',
    tier: 'T1',
    priority: 75,
  },

  // T2 Rules - Standard operations
  {
    name: 'conversation_handling',
    condition: (ctx) => ctx.taskType === 'conversation_handling',
    tier: 'T2',
    priority: 60,
  },
  {
    name: 'task_extraction',
    condition: (ctx) => ctx.taskType === 'task_extraction',
    tier: 'T2',
    priority: 60,
  },
  {
    name: 'workflow_orchestration',
    condition: (ctx) => ctx.taskType === 'workflow_orchestration',
    tier: 'T2',
    priority: 60,
  },
  {
    name: 'complex_with_tools',
    condition: (ctx) => ctx.requiresTools && ctx.complexity === 'complex',
    tier: 'T2',
    priority: 55,
  },

  // T3 Rules - Advanced reasoning
  {
    name: 'complex_reasoning',
    condition: (ctx) => ctx.taskType === 'complex_reasoning',
    tier: 'T3',
    priority: 40,
  },
  {
    name: 'error_recovery',
    condition: (ctx) => ctx.taskType === 'error_recovery',
    tier: 'T3',
    priority: 40,
  },
  {
    name: 'strategy_decision',
    condition: (ctx) => ctx.taskType === 'strategy_decision',
    tier: 'T3',
    priority: 40,
  },
  {
    name: 'very_long_input',
    condition: (ctx) => ctx.inputLength > 10000,
    tier: 'T3',
    priority: 35,
  },
];

/**
 * Escalation thresholds
 */
export const ESCALATION_CONFIG = {
  lowConfidenceThreshold: 0.6,
  errorKeywords: ['error', 'failed', 'cannot', 'unable', 'invalid'],
  retryLimit: 1,
};
