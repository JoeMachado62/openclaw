/**
 * Cost Tracker
 * Monitors and reports model usage costs
 */

import type { ModelTier, CostMetrics, ModelResponse } from './types.js';

export class CostTracker {
  private metrics: Map<ModelTier, CostMetrics> = new Map();

  constructor() {
    // Initialize metrics for all tiers
    for (const tier of ['T0', 'T1', 'T2', 'T3'] as ModelTier[]) {
      this.metrics.set(tier, {
        tier,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        escalations: 0,
      });
    }
  }

  /**
   * Record a model response
   */
  record(response: ModelResponse): void {
    const metrics = this.metrics.get(response.tier);
    if (!metrics) return;

    metrics.totalRequests++;
    metrics.totalTokens += response.tokensUsed;
    metrics.totalCost += response.cost;

    // Update average latency (running average)
    metrics.averageLatency =
      (metrics.averageLatency * (metrics.totalRequests - 1) + response.latencyMs) /
      metrics.totalRequests;
  }

  /**
   * Record an escalation
   */
  recordEscalation(fromTier: ModelTier): void {
    const metrics = this.metrics.get(fromTier);
    if (metrics) {
      metrics.escalations++;
    }
  }

  /**
   * Get metrics for a tier
   */
  getMetrics(tier: ModelTier): CostMetrics | undefined {
    return this.metrics.get(tier);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): CostMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get total cost across all tiers
   */
  getTotalCost(): number {
    return Array.from(this.metrics.values()).reduce((sum, m) => sum + m.totalCost, 0);
  }

  /**
   * Get cost savings estimate
   * Compares actual cost vs if everything used T2 (Sonnet)
   */
  getCostSavings(t2CostPer1M: number): number {
    const totalTokens = Array.from(this.metrics.values()).reduce(
      (sum, m) => sum + m.totalTokens,
      0
    );
    const actualCost = this.getTotalCost();
    const t2OnlyCost = (totalTokens / 1_000_000) * t2CostPer1M;

    return t2OnlyCost - actualCost;
  }

  /**
   * Generate cost report
   */
  generateReport(): string {
    const metrics = this.getAllMetrics();
    const totalCost = this.getTotalCost();
    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);

    let report = '# Model Router Cost Report\n\n';
    report += `**Total Requests:** ${totalRequests}\n`;
    report += `**Total Cost:** $${totalCost.toFixed(4)}\n\n`;

    report += '## Per-Tier Breakdown\n\n';

    for (const tier of ['T0', 'T1', 'T2', 'T3'] as ModelTier[]) {
      const m = this.metrics.get(tier)!;
      if (m.totalRequests === 0) continue;

      report += `### ${tier}\n`;
      report += `- Requests: ${m.totalRequests}\n`;
      report += `- Tokens: ${m.totalTokens.toLocaleString()}\n`;
      report += `- Cost: $${m.totalCost.toFixed(4)}\n`;
      report += `- Avg Latency: ${Math.round(m.averageLatency)}ms\n`;
      if (m.escalations > 0) {
        report += `- Escalations: ${m.escalations}\n`;
      }
      report += '\n';
    }

    // Calculate savings
    const t2Model = 3.0; // $3/1M tokens
    const savings = this.getCostSavings(t2Model);
    if (savings > 0) {
      report += `## Cost Savings\n\n`;
      report += `Using tier routing saved approximately **$${savings.toFixed(4)}** `;
      report += `compared to using Sonnet (T2) for all requests.\n`;
      report += `That's a **${((savings / (totalCost + savings)) * 100).toFixed(1)}%** reduction.\n`;
    }

    return report;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    for (const tier of ['T0', 'T1', 'T2', 'T3'] as ModelTier[]) {
      this.metrics.set(tier, {
        tier,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        escalations: 0,
      });
    }
  }
}
