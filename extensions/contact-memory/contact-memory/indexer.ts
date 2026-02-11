/**
 * Contact Memory Indexer
 * Processes incoming data into searchable memory
 */

import type { GHLContact, GHLMessage } from '../../plugins/ghl/types.js';
import type {
  ContactMemoryEntry,
  Interaction,
  KeyFact,
  ExtractedEntity,
  ContactMetadata,
} from './types.js';
import { nanoid } from 'nanoid';

export class ContactMemoryIndexer {
  /**
   * Process GHL contact into memory entry
   */
  indexContact(contact: GHLContact): Partial<ContactMemoryEntry> {
    const now = Date.now();

    const metadata: ContactMetadata = {
      name: contact.contactName || `${contact.firstName} ${contact.lastName}`.trim() || 'Unknown',
      email: contact.email,
      phone: contact.phone,
      tags: contact.tags || [],
      source: contact.source || 'unknown',
      firstSeen: contact.dateAdded ? new Date(contact.dateAdded).getTime() : now,
      lastSeen: contact.dateUpdated ? new Date(contact.dateUpdated).getTime() : now,
    };

    return {
      contactId: contact.id,
      locationId: contact.locationId,
      lastUpdated: now,
      metadata,
      preferences: contact.customFields || {},
    };
  }

  /**
   * Process GHL messages into interactions
   */
  indexMessages(messages: GHLMessage[]): Interaction[] {
    return messages.map((msg) => this.indexMessage(msg));
  }

  /**
   * Process single message into interaction
   */
  indexMessage(message: GHLMessage): Interaction {
    const entities = this.extractEntities(message.body);
    const topics = this.extractTopics(message.body);
    const sentiment = this.analyzeSentiment(message.body);

    return {
      id: message.id,
      timestamp: new Date(message.dateAdded).getTime(),
      channel: this.mapChannelType(message.type),
      direction: message.direction,
      summary: this.summarizeMessage(message.body),
      fullContent: message.body,
      entities,
      sentiment,
      topics,
    };
  }

  /**
   * Extract entities from text (simple pattern matching for now)
   */
  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract dates (simple patterns)
    const datePatterns = [
      /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
      /\b(?:tomorrow|today|next week|next month)\b/gi,
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
    ];

    for (const pattern of datePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type: 'date',
          value: match[0],
          confidence: 0.8,
        });
      }
    }

    // Extract times
    const timePattern = /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi;
    const timeMatches = text.matchAll(timePattern);
    for (const match of timeMatches) {
      entities.push({
        type: 'time',
        value: match[0],
        confidence: 0.8,
      });
    }

    // Extract prices
    const pricePattern = /\$\d+(?:,\d{3})*(?:\.\d{2})?/g;
    const priceMatches = text.matchAll(pricePattern);
    for (const match of priceMatches) {
      entities.push({
        type: 'price',
        value: match[0],
        confidence: 0.9,
      });
    }

    return entities;
  }

  /**
   * Extract topics from text (keyword-based for now)
   */
  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    // Topic keywords
    const topicKeywords: Record<string, string[]> = {
      pricing: ['price', 'cost', 'pricing', 'quote', 'estimate', 'budget', 'expensive', 'cheap'],
      scheduling: ['appointment', 'schedule', 'meeting', 'book', 'calendar', 'available'],
      support: ['help', 'issue', 'problem', 'question', 'support', 'assist'],
      product: ['product', 'service', 'feature', 'plan', 'package'],
      billing: ['bill', 'invoice', 'payment', 'charge', 'subscription'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((keyword) => lowerText.includes(keyword))) {
        topics.push(topic);
      }
    }

    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Analyze sentiment (simple for now, will be enhanced with AI)
   */
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const lowerText = text.toLowerCase();

    const positiveWords = ['thank', 'great', 'excellent', 'perfect', 'happy', 'love', 'amazing'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'frustrated', 'angry', 'disappointed'];

    let score = 0;
    for (const word of positiveWords) {
      if (lowerText.includes(word)) score += 1;
    }
    for (const word of negativeWords) {
      if (lowerText.includes(word)) score -= 1;
    }

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  /**
   * Summarize message (first 100 chars for now)
   */
  private summarizeMessage(text: string): string {
    if (text.length <= 100) return text;
    return text.substring(0, 97) + '...';
  }

  /**
   * Map GHL channel type to our channel type
   */
  private mapChannelType(
    ghlType: string
  ): 'phone' | 'sms' | 'email' | 'whatsapp' | 'webchat' | 'other' {
    const typeMap: Record<string, 'phone' | 'sms' | 'email' | 'whatsapp' | 'webchat' | 'other'> = {
      SMS: 'sms',
      Email: 'email',
      WhatsApp: 'whatsapp',
      Live_Chat: 'webchat',
      Custom: 'other',
      GMB: 'other',
      FB: 'other',
      Instagram: 'other',
    };

    return typeMap[ghlType] || 'other';
  }

  /**
   * Extract key facts from conversation
   */
  extractKeyFacts(interactions: Interaction[], contactId: string): KeyFact[] {
    const facts: KeyFact[] = [];

    for (const interaction of interactions) {
      // Look for commitments
      const commitmentPatterns = [
        /(?:I'll|I will|let me|I can)\s+(.+?)(?:\.|$)/gi,
        /(?:we'll|we will)\s+(.+?)(?:\.|$)/gi,
      ];

      for (const pattern of commitmentPatterns) {
        const matches = interaction.fullContent?.matchAll(pattern) || [];
        for (const match of matches) {
          const commitment = match[1]?.trim();
          if (commitment && commitment.length > 5 && commitment.length < 200) {
            facts.push({
              id: nanoid(),
              fact: `Commitment: ${commitment}`,
              source: interaction.id,
              confidence: 0.7,
              timestamp: interaction.timestamp,
              category: 'commitment',
            });
          }
        }
      }

      // Look for preferences
      const preferencePatterns = [
        /(?:I prefer|I like|I want|I need)\s+(.+?)(?:\.|$)/gi,
        /(?:prefer|like|want|need)\s+(.+?)(?:\.|$)/gi,
      ];

      for (const pattern of preferencePatterns) {
        const matches = interaction.fullContent?.matchAll(pattern) || [];
        for (const match of matches) {
          const preference = match[1]?.trim();
          if (preference && preference.length > 5 && preference.length < 200) {
            facts.push({
              id: nanoid(),
              fact: `Preference: ${preference}`,
              source: interaction.id,
              confidence: 0.6,
              timestamp: interaction.timestamp,
              category: 'preference',
            });
          }
        }
      }

      // Look for objections
      const objectionWords = ['but', 'however', 'concern', 'worried', 'expensive', 'too much'];
      const text = interaction.fullContent?.toLowerCase() || '';
      for (const word of objectionWords) {
        if (text.includes(word)) {
          facts.push({
            id: nanoid(),
            fact: `Potential objection mentioned: ${word}`,
            source: interaction.id,
            confidence: 0.5,
            timestamp: interaction.timestamp,
            category: 'objection',
          });
          break; // Only one objection per interaction
        }
      }
    }

    return facts;
  }
}
