/**
 * Contact Memory Compaction
 * Summarizes old interactions to save space and improve retrieval
 */

import type { Interaction, CompactionResult } from './types.js';

export class MemoryCompactor {
  private maxAge: number = 90 * 24 * 60 * 60 * 1000; // 90 days
  private maxInteractions: number = 100;
  private summaryThreshold: number = 30 * 24 * 60 * 60 * 1000; // 30 days

  /**
   * Compact interactions for a contact
   */
  compact(interactions: Interaction[]): CompactionResult {
    const now = Date.now();
    const original = interactions.length;

    // Sort by timestamp (newest first)
    interactions.sort((a, b) => b.timestamp - a.timestamp);

    // Keep recent interactions as-is
    const recent: Interaction[] = [];
    const old: Interaction[] = [];

    for (const interaction of interactions) {
      const age = now - interaction.timestamp;
      if (age < this.summaryThreshold || recent.length < 20) {
        recent.push(interaction);
      } else {
        old.push(interaction);
      }
    }

    // Remove very old interactions
    const toKeep = old.filter((i) => now - i.timestamp < this.maxAge);
    const removed = old.length - toKeep.length;

    // Summarize old interactions by grouping
    const summarized = this.summarizeInteractions(toKeep);

    // Combine recent + summarized
    const compacted = [...recent, ...summarized];

    // Limit total count
    const final = compacted.slice(0, this.maxInteractions);

    return {
      originalCount: original,
      compactedCount: final.length,
      summarized: summarized.length,
      removed: removed + (compacted.length - final.length),
    };
  }

  /**
   * Summarize interactions by grouping similar ones
   */
  private summarizeInteractions(interactions: Interaction[]): Interaction[] {
    if (interactions.length === 0) return [];

    // Group by week
    const groups = new Map<string, Interaction[]>();

    for (const interaction of interactions) {
      const weekKey = this.getWeekKey(interaction.timestamp);
      if (!groups.has(weekKey)) {
        groups.set(weekKey, []);
      }
      groups.get(weekKey)!.push(interaction);
    }

    // Create summary interaction for each group
    const summaries: Interaction[] = [];

    for (const [weekKey, groupInteractions] of groups) {
      if (groupInteractions.length === 1) {
        summaries.push(groupInteractions[0]);
        continue;
      }

      // Create summary
      const channels = [...new Set(groupInteractions.map((i) => i.channel))];
      const topics = [...new Set(groupInteractions.flatMap((i) => i.topics))];
      const sentiments = groupInteractions.map((i) => i.sentiment).filter(Boolean);
      const overallSentiment = this.determineOverallSentiment(sentiments as Array<'positive' | 'neutral' | 'negative'>);

      const summary: Interaction = {
        id: `summary_${weekKey}`,
        timestamp: groupInteractions[0].timestamp, // Use first interaction timestamp
        channel: 'other',
        direction: 'inbound',
        summary: `Week of ${new Date(groupInteractions[0].timestamp).toLocaleDateString()}: ${groupInteractions.length} interactions across ${channels.join(', ')}. Topics: ${topics.slice(0, 3).join(', ')}`,
        entities: [],
        sentiment: overallSentiment,
        topics,
      };

      summaries.push(summary);
    }

    return summaries;
  }

  /**
   * Get week key for grouping
   */
  private getWeekKey(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const week = Math.floor((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week}`;
  }

  /**
   * Determine overall sentiment from multiple sentiments
   */
  private determineOverallSentiment(
    sentiments: Array<'positive' | 'neutral' | 'negative'>
  ): 'positive' | 'neutral' | 'negative' {
    if (sentiments.length === 0) return 'neutral';

    const counts = {
      positive: sentiments.filter((s) => s === 'positive').length,
      neutral: sentiments.filter((s) => s === 'neutral').length,
      negative: sentiments.filter((s) => s === 'negative').length,
    };

    if (counts.positive > counts.negative) return 'positive';
    if (counts.negative > counts.positive) return 'negative';
    return 'neutral';
  }

  /**
   * Check if compaction is needed
   */
  shouldCompact(interactions: Interaction[]): boolean {
    if (interactions.length < this.maxInteractions) {
      return false;
    }

    const now = Date.now();
    const old = interactions.filter((i) => now - i.timestamp > this.summaryThreshold);

    return old.length > 20;
  }
}
