/**
 * Model Router - T0-T3 Tier System
 * Main entry point for intelligent model routing
 */

import type {
  RouterConfig,
  RouteContext,
  RouteDecision,
  ModelResponse,
  ModelTier,
  EscalationResult,
} from './types.js';
import { DEFAULT_MODEL_CONFIG, DEFAULT_ROUTING_RULES } from './config.js';
import { TaskClassifier } from './classifier.js';
import { ModelEscalator } from './escalation.js';
import { CostTracker } from './cost-tracker.js';

export * from './types.js';
export * from './config.js';

export class ModelRouter {
  private config: RouterConfig;
  private classifier: TaskClassifier;
  private escalator: ModelEscalator;
  private costTracker: CostTracker;

  constructor(config?: Partial<RouterConfig>) {
    this.config = {
      ...DEFAULT_MODEL_CONFIG,
      ...config,
      rules: [...DEFAULT_ROUTING_RULES, ...(config?.rules || [])],
    };

    this.classifier = new TaskClassifier();
    this.escalator = new ModelEscalator();
    this.costTracker = new CostTracker();
  }

  /**
   * Route a request to the appropriate tier
   */
  route(prompt: string, options?: Partial<RouteContext>): RouteDecision {
    // Build context
    const context = options
      ? { ...this.classifier.buildContext(prompt, options), ...options }
      : this.classifier.buildContext(prompt);

    // Sort rules by priority
    const sortedRules = [...this.config.rules].sort((a, b) => b.priority - a.priority);

    // Find matching rule
    for (const rule of sortedRules) {
      if (rule.condition(context)) {
        const model = this.config.models[rule.tier];
        const estimatedCost = this.estimateCost(context.inputLength, model.costPer1MTokens);

        return {
          tier: rule.tier,
          model,
          confidence: 0.9,
          reasoning: `Matched rule: ${rule.name}`,
          estimatedCost,
        };
      }
    }

    // Fallback to default tier
    const fallbackTier = this.config.fallbackTier;
    const model = this.config.models[fallbackTier];

    return {
      tier: fallbackTier,
      model,
      confidence: 0.5,
      reasoning: 'No matching rule, using fallback',
      estimatedCost: this.estimateCost(context.inputLength, model.costPer1MTokens),
    };
  }

  /**
   * Execute request with automatic escalation
   */
  async execute(
    prompt: string,
    options?: Partial<RouteContext> & {
      maxRetries?: number;
      executor?: (tier: ModelTier, prompt: string) => Promise<ModelResponse>;
    }
  ): Promise<EscalationResult> {
    const maxRetries = options?.maxRetries || 1;
    const executor = options?.executor || this.defaultExecutor.bind(this);

    // Initial routing decision
    let decision = this.route(prompt, options);
    let currentTier = decision.tier;
    let attempts = 0;

    while (attempts < maxRetries + 1) {
      attempts++;

      // Execute at current tier
      const response = await executor(currentTier, prompt);

      // Track metrics
      if (this.config.enableCostTracking) {
        this.costTracker.record(response);
      }

      // Check if escalation needed
      if (this.escalator.shouldEscalate(response, currentTier)) {
        const nextTier = this.escalator.getNextTier(currentTier);

        if (nextTier === currentTier) {
          // Can't escalate further
          return this.escalator.buildEscalationResult(
            response,
            decision.tier,
            currentTier,
            'Max tier reached'
          );
        }

        console.log(`[Model Router] Escalating ${currentTier} → ${nextTier}: ${this.escalator.getEscalationReason(response)}`);

        this.costTracker.recordEscalation(currentTier);
        currentTier = nextTier;
        continue;
      }

      // Success - no escalation needed
      return this.escalator.buildEscalationResult(
        response,
        decision.tier,
        currentTier,
        currentTier !== decision.tier ? `Escalated to ${currentTier}` : 'Initial tier succeeded'
      );
    }

    // Max retries reached
    throw new Error(`Max retries (${maxRetries}) reached`);
  }

  /**
   * Default executor (placeholder - will be replaced with actual LLM calls)
   */
  private async defaultExecutor(tier: ModelTier, prompt: string): Promise<ModelResponse> {
    const startTime = Date.now();
    const model = this.config.models[tier];

    // This is a placeholder - actual implementation will call Ollama/Anthropic/OpenAI
    const mockResponse = `[${tier}/${model.model}] Response to: ${prompt.substring(0, 50)}...`;

    const tokensUsed = Math.floor(prompt.length / 4) + Math.floor(mockResponse.length / 4);
    const cost = (tokensUsed / 1_000_000) * model.costPer1MTokens;

    return {
      content: mockResponse,
      tier,
      model: model.model,
      tokensUsed,
      cost,
      latencyMs: Date.now() - startTime,
      confidence: 0.8,
    };
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(inputLength: number, costPer1M: number): number {
    const estimatedTokens = Math.floor(inputLength / 4) * 1.5; // Input + estimated output
    return (estimatedTokens / 1_000_000) * costPer1M;
  }

  /**
   * Get cost metrics
   */
  getCostMetrics() {
    return this.costTracker.getAllMetrics();
  }

  /**
   * Get cost report
   */
  getCostReport(): string {
    return this.costTracker.generateReport();
  }

  /**
   * Reset cost tracking
   */
  resetCostTracking(): void {
    this.costTracker.reset();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RouterConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      rules: config.rules ? [...this.config.rules, ...config.rules] : this.config.rules,
    };
  }
}

/**
 * Create model router instance
 */
export function createModelRouter(config?: Partial<RouterConfig>): ModelRouter {
  return new ModelRouter(config);
}
