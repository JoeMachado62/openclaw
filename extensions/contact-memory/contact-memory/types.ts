/**
 * Contact Memory Types
 * Unified memory system for cross-channel contact context
 */

export interface ContactMemoryEntry {
  contactId: string;
  locationId: string;
  lastUpdated: number;
  metadata: ContactMetadata;
  interactions: Interaction[];
  keyFacts: KeyFact[];
  preferences: Record<string, any>;
  sentiment: SentimentAnalysis;
}

export interface ContactMetadata {
  name: string;
  email?: string;
  phone?: string;
  tags: string[];
  source: string;
  firstSeen: number;
  lastSeen: number;
}

export interface Interaction {
  id: string;
  timestamp: number;
  channel: 'phone' | 'sms' | 'email' | 'whatsapp' | 'webchat' | 'other';
  direction: 'inbound' | 'outbound';
  summary: string;
  fullContent?: string;
  entities: ExtractedEntity[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  topics: string[];
}

export interface KeyFact {
  id: string;
  fact: string;
  source: string; // interaction ID or 'note'
  confidence: number;
  timestamp: number;
  category: 'preference' | 'commitment' | 'objection' | 'question' | 'other';
}

export interface ExtractedEntity {
  type: 'date' | 'time' | 'product' | 'price' | 'person' | 'location' | 'other';
  value: string;
  confidence: number;
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  history: Array<{
    timestamp: number;
    sentiment: 'positive' | 'neutral' | 'negative';
    score: number;
  }>;
}

export interface MemoryQueryOptions {
  maxInteractions?: number;
  maxAge?: number; // milliseconds
  channels?: string[];
  includeFullContent?: boolean;
  minConfidence?: number;
}

export interface MemoryContext {
  contactId: string;
  summary: string;
  recentInteractions: Interaction[];
  keyFacts: KeyFact[];
  preferences: Record<string, any>;
  sentiment: SentimentAnalysis;
  recommendations: string[];
}

export interface CompactionResult {
  originalCount: number;
  compactedCount: number;
  summarized: number;
  removed: number;
}
