/**
 * Task Complexity Classifier
 * Analyzes tasks to determine appropriate tier
 */

import type { TaskType, TaskComplexity, RouteContext } from './types.js';

export class TaskClassifier {
  /**
   * Classify task complexity
   */
  classifyComplexity(context: RouteContext): TaskComplexity {
    const { taskType, inputLength, requiresTools } = context;

    // Trivial - very simple operations
    if (taskType === 'heartbeat' || inputLength < 50) {
      return 'trivial';
    }

    // Simple - basic lookups and formatting
    if (
      ['simple_query', 'contact_lookup', 'data_formatting'].includes(taskType) &&
      inputLength < 500
    ) {
      return 'simple';
    }

    // Moderate - standard operations
    if (
      ['classification', 'conversation_handling', 'task_extraction'].includes(taskType) &&
      inputLength < 2000
    ) {
      return 'moderate';
    }

    // Complex - multi-step operations
    if (
      ['workflow_orchestration'].includes(taskType) ||
      requiresTools ||
      inputLength > 2000
    ) {
      return 'complex';
    }

    // Advanced - highest complexity
    if (
      ['complex_reasoning', 'error_recovery', 'strategy_decision'].includes(taskType) ||
      inputLength > 5000
    ) {
      return 'advanced';
    }

    return 'moderate'; // Default
  }

  /**
   * Infer task type from prompt
   */
  inferTaskType(prompt: string, metadata?: Record<string, any>): TaskType {
    const lower = prompt.toLowerCase();

    // Check metadata first
    if (metadata?.taskType) {
      return metadata.taskType as TaskType;
    }

    // Heartbeat patterns
    if (lower.includes('status') || lower.includes('health') || lower.length < 20) {
      return 'heartbeat';
    }

    // Contact lookup patterns
    if (lower.includes('find contact') || lower.includes('lookup') || lower.includes('search')) {
      return 'contact_lookup';
    }

    // Task extraction patterns
    if (
      lower.includes('extract task') ||
      lower.includes('action item') ||
      lower.includes('follow up')
    ) {
      return 'task_extraction';
    }

    // Conversation handling patterns
    if (
      lower.includes('respond to') ||
      lower.includes('reply to') ||
      lower.includes('conversation')
    ) {
      return 'conversation_handling';
    }

    // Error recovery patterns
    if (lower.includes('error') || lower.includes('failed') || lower.includes('fix')) {
      return 'error_recovery';
    }

    // Complex reasoning patterns
    if (
      lower.includes('analyze') ||
      lower.includes('decide') ||
      lower.includes('determine') ||
      lower.includes('explain why')
    ) {
      return 'complex_reasoning';
    }

    // Strategy patterns
    if (lower.includes('strategy') || lower.includes('plan') || lower.includes('approach')) {
      return 'strategy_decision';
    }

    // Default to simple query
    return 'simple_query';
  }

  /**
   * Build route context from prompt
   */
  buildContext(
    prompt: string,
    options?: {
      taskType?: TaskType;
      requiresTools?: boolean;
      metadata?: Record<string, any>;
    }
  ): RouteContext {
    const taskType = options?.taskType || this.inferTaskType(prompt, options?.metadata);
    const inputLength = prompt.length;
    const requiresTools = options?.requiresTools || false;

    const context: RouteContext = {
      taskType,
      complexity: 'moderate', // Will be set by router
      inputLength,
      requiresTools,
      metadata: options?.metadata,
    };

    // Set complexity
    context.complexity = this.classifyComplexity(context);

    return context;
  }

  /**
   * Analyze response confidence
   */
  analyzeConfidence(response: string): number {
    // Simple heuristic-based confidence scoring
    let confidence = 0.8; // Default

    const lower = response.toLowerCase();

    // High confidence indicators
    if (
      lower.includes('definitely') ||
      lower.includes('certainly') ||
      lower.includes('confirmed')
    ) {
      confidence = 0.95;
    }

    // Low confidence indicators
    if (
      lower.includes('maybe') ||
      lower.includes('perhaps') ||
      lower.includes('might') ||
      lower.includes("i'm not sure") ||
      lower.includes('unclear')
    ) {
      confidence = 0.4;
    }

    // Error indicators
    if (
      lower.includes('error') ||
      lower.includes('cannot') ||
      lower.includes('unable to') ||
      lower.includes('failed')
    ) {
      confidence = 0.2;
    }

    return confidence;
  }
}
