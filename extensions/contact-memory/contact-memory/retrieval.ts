/**
 * Contact Memory Retrieval
 * Context assembly and retrieval for AI agents
 */

import type {
  ContactMemoryEntry,
  MemoryContext,
  MemoryQueryOptions,
  Interaction,
  KeyFact,
} from './types.js';

export class MemoryRetrieval {
  /**
   * Assemble context for AI agent
   */
  assembleContext(memory: ContactMemoryEntry, options: MemoryQueryOptions = {}): MemoryContext {
    const {
      maxInteractions = 10,
      maxAge = 30 * 24 * 60 * 60 * 1000, // 30 days
      channels,
      minConfidence = 0.5,
    } = options;

    // Filter interactions
    let interactions = memory.interactions;

    if (maxAge) {
      const cutoff = Date.now() - maxAge;
      interactions = interactions.filter((i) => i.timestamp >= cutoff);
    }

    if (channels && channels.length > 0) {
      interactions = interactions.filter((i) => channels.includes(i.channel));
    }

    // Sort by timestamp (newest first) and limit
    interactions = interactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxInteractions);

    // Filter key facts by confidence
    const keyFacts = memory.keyFacts
      .filter((f) => f.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    // Generate summary
    const summary = this.generateSummary(memory, interactions, keyFacts);

    // Generate recommendations
    const recommendations = this.generateRecommendations(memory, interactions, keyFacts);

    return {
      contactId: memory.contactId,
      summary,
      recentInteractions: interactions,
      keyFacts,
      preferences: memory.preferences,
      sentiment: memory.sentiment,
      recommendations,
    };
  }

  /**
   * Generate natural language summary
   */
  private generateSummary(
    memory: ContactMemoryEntry,
    interactions: Interaction[],
    keyFacts: KeyFact[]
  ): string {
    const { metadata, sentiment } = memory;

    let summary = `${metadata.name} `;

    if (interactions.length > 0) {
      const lastInteraction = interactions[0];
      const daysSinceLastContact = Math.floor(
        (Date.now() - lastInteraction.timestamp) / (24 * 60 * 60 * 1000)
      );

      if (daysSinceLastContact === 0) {
        summary += 'contacted you today';
      } else if (daysSinceLastContact === 1) {
        summary += 'contacted you yesterday';
      } else if (daysSinceLastContact < 7) {
        summary += `contacted you ${daysSinceLastContact} days ago`;
      } else {
        summary += `last contacted you ${Math.floor(daysSinceLastContact / 7)} weeks ago`;
      }

      summary += ` via ${lastInteraction.channel}`;
    }

    summary += `. Overall sentiment: ${sentiment.overall}.`;

    if (keyFacts.length > 0) {
      const commitments = keyFacts.filter((f) => f.category === 'commitment');
      if (commitments.length > 0) {
        summary += ` ${commitments.length} open commitment(s).`;
      }
    }

    return summary;
  }

  /**
   * Generate recommendations for the agent
   */
  private generateRecommendations(
    memory: ContactMemoryEntry,
    interactions: Interaction[],
    keyFacts: KeyFact[]
  ): string[] {
    const recommendations: string[] = [];

    // Check for pending commitments
    const commitments = keyFacts.filter((f) => f.category === 'commitment');
    if (commitments.length > 0) {
      recommendations.push(
        `Reference previous commitments: ${commitments[0].fact.replace('Commitment: ', '')}`
      );
    }

    // Check for objections
    const objections = keyFacts.filter((f) => f.category === 'objection');
    if (objections.length > 0) {
      recommendations.push('Address previously mentioned concerns');
    }

    // Check for preferences
    const preferences = keyFacts.filter((f) => f.category === 'preference');
    if (preferences.length > 0) {
      recommendations.push(
        `Align with preferences: ${preferences[0].fact.replace('Preference: ', '')}`
      );
    }

    // Check sentiment trend
    if (memory.sentiment.history.length >= 3) {
      const recent = memory.sentiment.history.slice(0, 3);
      const negativeCount = recent.filter((h) => h.sentiment === 'negative').length;
      if (negativeCount >= 2) {
        recommendations.push('Exercise extra care - recent negative sentiment detected');
      }
    }

    // Check for long gaps
    if (interactions.length > 0) {
      const daysSinceLastContact = Math.floor(
        (Date.now() - interactions[0].timestamp) / (24 * 60 * 60 * 1000)
      );
      if (daysSinceLastContact > 14) {
        recommendations.push('It has been a while since last contact - acknowledge the gap');
      }
    }

    return recommendations;
  }

  /**
   * Format context as text for AI prompt
   */
  formatForAI(context: MemoryContext, options: { verbose?: boolean } = {}): string {
    const { verbose = false } = options;

    let text = `# Contact: ${context.summary}\n\n`;

    // Recent interactions
    if (context.recentInteractions.length > 0) {
      text += `## Recent Interactions (${context.recentInteractions.length})\n\n`;
      for (const interaction of context.recentInteractions.slice(0, verbose ? 10 : 5)) {
        const date = new Date(interaction.timestamp).toLocaleDateString();
        const direction = interaction.direction === 'inbound' ? '📥' : '📤';
        text += `**${date}** ${direction} ${interaction.channel}: ${interaction.summary}\n`;
        if (verbose && interaction.topics.length > 0) {
          text += `  _Topics: ${interaction.topics.join(', ')}_\n`;
        }
      }
      text += '\n';
    }

    // Key facts
    if (context.keyFacts.length > 0) {
      text += `## Key Facts\n\n`;
      for (const fact of context.keyFacts.slice(0, verbose ? 10 : 5)) {
        text += `- ${fact.fact} (confidence: ${Math.round(fact.confidence * 100)}%)\n`;
      }
      text += '\n';
    }

    // Preferences
    const prefKeys = Object.keys(context.preferences);
    if (prefKeys.length > 0) {
      text += `## Preferences\n\n`;
      for (const key of prefKeys.slice(0, 5)) {
        text += `- **${key}**: ${context.preferences[key]}\n`;
      }
      text += '\n';
    }

    // Recommendations
    if (context.recommendations.length > 0) {
      text += `## Recommendations\n\n`;
      for (const rec of context.recommendations) {
        text += `- ${rec}\n`;
      }
      text += '\n';
    }

    return text;
  }

  /**
   * Calculate relevance score for an interaction
   */
  calculateRelevance(interaction: Interaction, currentTopics: string[] = []): number {
    let score = 0;

    // Recency score (0-0.5)
    const age = Date.now() - interaction.timestamp;
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 days
    score += 0.5 * (1 - Math.min(age / maxAge, 1));

    // Topic relevance (0-0.3)
    if (currentTopics.length > 0 && interaction.topics.length > 0) {
      const overlap = interaction.topics.filter((t) => currentTopics.includes(t)).length;
      score += 0.3 * (overlap / currentTopics.length);
    }

    // Sentiment (0-0.2)
    if (interaction.sentiment === 'positive') score += 0.2;
    if (interaction.sentiment === 'negative') score += 0.1; // Negative is important to remember

    return score;
  }
}
