/**
 * Model Escalation Logic
 * Automatically escalates to higher tiers when needed
 */

import type { ModelTier, ModelResponse, EscalationResult } from './types.js';
import { ESCALATION_CONFIG } from './config.js';

export class ModelEscalator {
  /**
   * Determine if response should be escalated
   */
  shouldEscalate(response: ModelResponse, originalTier: ModelTier): boolean {
    // Don't escalate if already at T3
    if (originalTier === 'T3') {
      return false;
    }

    // Check confidence threshold
    if (response.confidence !== undefined && response.confidence < ESCALATION_CONFIG.lowConfidenceThreshold) {
      return true;
    }

    // Check for error keywords
    const lower = response.content.toLowerCase();
    const hasErrorKeyword = ESCALATION_CONFIG.errorKeywords.some((keyword) =>
      lower.includes(keyword)
    );
    if (hasErrorKeyword) {
      return true;
    }

    // Check response length (too short might indicate failure)
    if (response.content.length < 20 && originalTier !== 'T0') {
      return true;
    }

    return false;
  }

  /**
   * Get next tier for escalation
   */
  getNextTier(currentTier: ModelTier): ModelTier {
    const tierOrder: ModelTier[] = ['T0', 'T1', 'T2', 'T3'];
    const currentIndex = tierOrder.indexOf(currentTier);

    if (currentIndex < tierOrder.length - 1) {
      return tierOrder[currentIndex + 1];
    }

    return currentTier; // Already at max
  }

  /**
   * Build escalation result
   */
  buildEscalationResult(
    response: ModelResponse,
    fromTier: ModelTier,
    toTier: ModelTier,
    reason: string
  ): EscalationResult {
    return {
      escalated: fromTier !== toTier,
      fromTier,
      toTier,
      reason,
      response,
    };
  }

  /**
   * Format escalation reason
   */
  getEscalationReason(response: ModelResponse): string {
    const reasons: string[] = [];

    if (response.confidence !== undefined && response.confidence < ESCALATION_CONFIG.lowConfidenceThreshold) {
      reasons.push(`low confidence (${(response.confidence * 100).toFixed(1)}%)`);
    }

    const lower = response.content.toLowerCase();
    for (const keyword of ESCALATION_CONFIG.errorKeywords) {
      if (lower.includes(keyword)) {
        reasons.push(`error indicator: "${keyword}"`);
        break;
      }
    }

    if (response.content.length < 20) {
      reasons.push('response too short');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'quality check failed';
  }
}
