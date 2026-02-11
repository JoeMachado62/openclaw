/**
 * Contact Memory Schema
 * Database schema for contact memory storage
 */

export const CONTACT_MEMORY_SCHEMA = `
-- Contact Memory Table
CREATE TABLE IF NOT EXISTS contact_memory (
  contact_id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  last_updated INTEGER NOT NULL,
  metadata TEXT NOT NULL,
  preferences TEXT,
  sentiment TEXT,
  created_at INTEGER NOT NULL
);

-- Interactions Table
CREATE TABLE IF NOT EXISTS interactions (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  channel TEXT NOT NULL,
  direction TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_content TEXT,
  entities TEXT,
  sentiment TEXT,
  topics TEXT,
  FOREIGN KEY (contact_id) REFERENCES contact_memory(contact_id)
);

-- Key Facts Table
CREATE TABLE IF NOT EXISTS key_facts (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  fact TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL,
  timestamp INTEGER NOT NULL,
  category TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES contact_memory(contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_key_facts_contact ON key_facts(contact_id);
CREATE INDEX IF NOT EXISTS idx_key_facts_confidence ON key_facts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_contact_memory_location ON contact_memory(location_id);
`;

export interface ContactMemoryRow {
  contact_id: string;
  location_id: string;
  last_updated: number;
  metadata: string; // JSON
  preferences: string; // JSON
  sentiment: string; // JSON
  created_at: number;
}

export interface InteractionRow {
  id: string;
  contact_id: string;
  timestamp: number;
  channel: string;
  direction: string;
  summary: string;
  full_content: string | null;
  entities: string; // JSON
  sentiment: string | null;
  topics: string; // JSON
}

export interface KeyFactRow {
  id: string;
  contact_id: string;
  fact: string;
  source: string;
  confidence: number;
  timestamp: number;
  category: string;
}
