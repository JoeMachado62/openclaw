/**
 * Context Provider
 * Assembles and provides contact context for LiveKit agents
 */

import type { ContactMemoryManager } from '../memory/contact-memory/index.js';

export class ContextProvider {
  constructor(private memoryManager: ContactMemoryManager) {}

  /**
   * Get context for a voice call
   */
  async getContextForCall(contactId: string | null | undefined): Promise<any> {
    if (!contactId) {
      return {
        summary: 'New caller - no history available',
        recent_interactions: [],
        key_facts: [],
        recommendations: ['Collect caller information', 'Be extra welcoming'],
      };
    }

    try {
      const context = await this.memoryManager.getContactContext(contactId);

      if (!context) {
        return {
          summary: 'Contact found but no interaction history',
          recent_interactions: [],
          key_facts: [],
          recommendations: ['Introduce yourself', 'Ask about their needs'],
        };
      }

      // Format for LiveKit agent consumption
      return {
        summary: context.summary,
        recent_interactions: context.recentInteractions.map((i) => ({
          date: new Date(i.timestamp).toLocaleDateString(),
          channel: i.channel,
          summary: i.summary,
          topics: i.topics,
        })),
        key_facts: context.keyFacts.map((f) => f.fact),
        preferences: context.preferences,
        sentiment: context.sentiment.overall,
        recommendations: context.recommendations,
        days_since_last_contact: this.calculateDaysSince(
          context.recentInteractions[0]?.timestamp
        ),
      };
    } catch (error) {
      console.error('[ContextProvider] Failed to get context:', error);
      return {
        summary: 'Error loading contact history',
        recent_interactions: [],
        key_facts: [],
        recommendations: ['Proceed with standard greeting'],
      };
    }
  }

  /**
   * Calculate days since timestamp
   */
  private calculateDaysSince(timestamp: number | undefined): number {
    if (!timestamp) return 999;
    return Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  }

  /**
   * Format context as text for system prompt
   */
  async formatContextForPrompt(contactId: string): Promise<string> {
    const context = await this.getContextForCall(contactId);
    return this.memoryManager.formatContextForAI(contactId, false) || '';
  }
}
