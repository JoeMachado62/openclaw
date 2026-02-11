/**
 * Unified Contact Memory System
 * Main entry point for contact memory management
 */

import type { Database } from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import type { GHLPlugin } from '../../plugins/ghl/index.js';
import type {
  ContactMemoryEntry,
  MemoryContext,
  MemoryQueryOptions,
  Interaction,
  KeyFact,
  SentimentAnalysis,
} from './types.js';
import type { ContactMemoryRow, InteractionRow, KeyFactRow } from './schema.js';
import { CONTACT_MEMORY_SCHEMA } from './schema.js';
import { ContactMemoryIndexer } from './indexer.js';
import { MemoryCompactor } from './compaction.js';
import { MemoryRetrieval } from './retrieval.js';

export * from './types.js';

export interface ContactMemoryConfig {
  dbPath?: string;
  ghlPlugin?: GHLPlugin;
}

export class ContactMemoryManager {
  private ghlPlugin?: GHLPlugin;
  private db: Database | null = null;
  private dbPath: string;
  private indexer: ContactMemoryIndexer;
  private compactor: MemoryCompactor;
  private retrieval: MemoryRetrieval;

  constructor(config: ContactMemoryConfig | GHLPlugin, db?: Database) {
    // Support both old and new constructor signatures
    if (config && typeof config === 'object' && 'dbPath' in config) {
      // New config-based constructor
      this.dbPath = config.dbPath || './data/contact-memory.db';
      this.ghlPlugin = config.ghlPlugin;
      this.db = null;
    } else {
      // Legacy constructor: (ghlPlugin, db)
      this.ghlPlugin = config as GHLPlugin;
      this.db = db || null;
      this.dbPath = './data/contact-memory.db';
    }

    this.indexer = new ContactMemoryIndexer();
    this.compactor = new MemoryCompactor();
    this.retrieval = new MemoryRetrieval();
  }

  /**
   * Initialize the memory system
   */
  async initialize(db?: Database): Promise<void> {
    if (db) {
      this.db = db;
    } else if (!this.db) {
      // Create database from dbPath
      this.db = new BetterSqlite3(this.dbPath);
    }

    // Create schema
    this.db.exec(CONTACT_MEMORY_SCHEMA);

    console.log('[Contact Memory] Initialized at', this.dbPath);
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[Contact Memory] Database closed');
    }
  }

  /**
   * Sync contact from GHL to memory
   */
  async syncContactFromGHL(locationId: string, contactId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Build context from GHL
    const ghlContext = await this.ghlPlugin.buildContactContext(locationId, contactId, {
      maxMessages: 100,
      includeTasks: true,
      includeAppointments: true,
    });

    // Get all messages for detailed indexing
    const messages = await this.ghlPlugin.conversations.getAllContactMessages(
      locationId,
      contactId,
      100
    );

    // Index messages into interactions
    const interactions = this.indexer.indexMessages(messages);

    // Extract key facts
    const keyFacts = this.indexer.extractKeyFacts(interactions, contactId);

    // Build sentiment analysis
    const sentiment: SentimentAnalysis = {
      overall: this.calculateOverallSentiment(interactions),
      history: interactions
        .filter((i) => i.sentiment)
        .map((i) => ({
          timestamp: i.timestamp,
          sentiment: i.sentiment!,
          score: i.sentiment === 'positive' ? 1 : i.sentiment === 'negative' ? -1 : 0,
        }))
        .slice(0, 20),
    };

    // Check if compaction needed
    let finalInteractions = interactions;
    if (this.compactor.shouldCompact(interactions)) {
      const result = this.compactor.compact(interactions);
      console.log(`[Contact Memory] Compacted ${contactId}: ${result.originalCount} → ${result.compactedCount}`);
      finalInteractions = interactions.slice(0, result.compactedCount);
    }

    // Store in database
    await this.storeContactMemory({
      contactId,
      locationId,
      lastUpdated: Date.now(),
      metadata: {
        name: ghlContext.contactName,
        tags: [],
        source: 'ghl',
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      },
      interactions: finalInteractions,
      keyFacts,
      preferences: ghlContext.preferences,
      sentiment,
    });

    console.log(`[Contact Memory] Synced ${contactId}: ${finalInteractions.length} interactions, ${keyFacts.length} facts`);
  }

  /**
   * Store contact memory in database
   */
  private async storeContactMemory(memory: ContactMemoryEntry): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contact_memory (
        contact_id, location_id, last_updated, metadata, preferences, sentiment, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      memory.contactId,
      memory.locationId,
      memory.lastUpdated,
      JSON.stringify(memory.metadata),
      JSON.stringify(memory.preferences),
      JSON.stringify(memory.sentiment),
      memory.metadata.firstSeen
    );

    // Clear old interactions
    this.db.prepare('DELETE FROM interactions WHERE contact_id = ?').run(memory.contactId);
    this.db.prepare('DELETE FROM key_facts WHERE contact_id = ?').run(memory.contactId);

    // Store interactions
    const interactionStmt = this.db.prepare(`
      INSERT INTO interactions (
        id, contact_id, timestamp, channel, direction, summary, full_content, entities, sentiment, topics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const interaction of memory.interactions) {
      interactionStmt.run(
        interaction.id,
        memory.contactId,
        interaction.timestamp,
        interaction.channel,
        interaction.direction,
        interaction.summary,
        interaction.fullContent || null,
        JSON.stringify(interaction.entities),
        interaction.sentiment || null,
        JSON.stringify(interaction.topics)
      );
    }

    // Store key facts
    const factStmt = this.db.prepare(`
      INSERT INTO key_facts (
        id, contact_id, fact, source, confidence, timestamp, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const fact of memory.keyFacts) {
      factStmt.run(
        fact.id,
        memory.contactId,
        fact.fact,
        fact.source,
        fact.confidence,
        fact.timestamp,
        fact.category
      );
    }
  }

  /**
   * Get contact memory from database
   */
  async getContactMemory(contactId: string): Promise<ContactMemoryEntry | null> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT * FROM contact_memory WHERE contact_id = ?')
      .get(contactId) as ContactMemoryRow | undefined;

    if (!row) return null;

    // Get interactions
    const interactions = this.db
      .prepare('SELECT * FROM interactions WHERE contact_id = ? ORDER BY timestamp DESC')
      .all(contactId) as InteractionRow[];

    // Get key facts
    const keyFacts = this.db
      .prepare('SELECT * FROM key_facts WHERE contact_id = ? ORDER BY confidence DESC')
      .all(contactId) as KeyFactRow[];

    return {
      contactId: row.contact_id,
      locationId: row.location_id,
      lastUpdated: row.last_updated,
      metadata: JSON.parse(row.metadata),
      interactions: interactions.map((i) => ({
        id: i.id,
        timestamp: i.timestamp,
        channel: i.channel as any,
        direction: i.direction as any,
        summary: i.summary,
        fullContent: i.full_content || undefined,
        entities: JSON.parse(i.entities),
        sentiment: i.sentiment as any,
        topics: JSON.parse(i.topics),
      })),
      keyFacts: keyFacts.map((f) => ({
        id: f.id,
        fact: f.fact,
        source: f.source,
        confidence: f.confidence,
        timestamp: f.timestamp,
        category: f.category as any,
      })),
      preferences: JSON.parse(row.preferences || '{}'),
      sentiment: JSON.parse(row.sentiment),
    };
  }

  /**
   * Get contact context for AI
   */
  async getContactContext(
    contactId: string,
    options?: MemoryQueryOptions
  ): Promise<MemoryContext | null> {
    const memory = await this.getContactMemory(contactId);
    if (!memory) return null;

    return this.retrieval.assembleContext(memory, options);
  }

  /**
   * Format context for AI prompt
   */
  async formatContextForAI(contactId: string, verbose: boolean = false): Promise<string | null> {
    const context = await this.getContactContext(contactId);
    if (!context) return null;

    return this.retrieval.formatForAI(context, { verbose });
  }

  /**
   * Add new interaction (called by bridge layer)
   */
  async addInteraction(contactId: string, interaction: Interaction): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO interactions (
        id, contact_id, timestamp, channel, direction, summary, full_content, entities, sentiment, topics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      interaction.id,
      contactId,
      interaction.timestamp,
      interaction.channel,
      interaction.direction,
      interaction.summary,
      interaction.fullContent || null,
      JSON.stringify(interaction.entities),
      interaction.sentiment || null,
      JSON.stringify(interaction.topics)
    );

    // Update last_updated
    this.db
      .prepare('UPDATE contact_memory SET last_updated = ? WHERE contact_id = ?')
      .run(Date.now(), contactId);
  }

  /**
   * Calculate overall sentiment from interactions
   */
  private calculateOverallSentiment(
    interactions: Interaction[]
  ): 'positive' | 'neutral' | 'negative' {
    const recent = interactions.slice(0, 10);
    const sentiments = recent.map((i) => i.sentiment).filter(Boolean);

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
   * Search contacts by query
   */
  async searchContacts(query: string, limit: number = 10): Promise<ContactMemoryEntry[]> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare(
        `
      SELECT * FROM contact_memory
      WHERE metadata LIKE ?
      ORDER BY last_updated DESC
      LIMIT ?
    `
      )
      .all(`%${query}%`, limit) as ContactMemoryRow[];

    const results: ContactMemoryEntry[] = [];
    for (const row of rows) {
      const memory = await this.getContactMemory(row.contact_id);
      if (memory) results.push(memory);
    }

    return results;
  }
}
