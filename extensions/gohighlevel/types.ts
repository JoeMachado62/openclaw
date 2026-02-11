/**
 * GoHighLevel Plugin Types
 * Type definitions for GHL API integration
 */

export interface GHLConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  webhookSecret?: string;
  pitToken?: string; // Private Integration Token for development
  locationId?: string; // Default GHL Location ID
}

export interface GHLTokenSet {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number; // Computed timestamp
  scope: string;
  locationId?: string;
  companyId?: string;
  userId?: string;
}

export interface GHLContact {
  id: string;
  locationId: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  source?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

export interface GHLConversation {
  id: string;
  locationId: string;
  contactId: string;
  type: 'SMS' | 'Email' | 'WhatsApp' | 'GMB' | 'FB' | 'Instagram' | 'Live_Chat' | 'Custom';
  lastMessageBody?: string;
  lastMessageDate?: string;
  unreadCount?: number;
  starred?: boolean;
}

export interface GHLMessage {
  id: string;
  conversationId: string;
  type: 'SMS' | 'Email' | 'WhatsApp' | 'GMB' | 'FB' | 'Instagram' | 'Live_Chat' | 'Custom';
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'scheduled' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered';
  dateAdded: string;
  attachments?: GHLAttachment[];
}

export interface GHLAttachment {
  id: string;
  url: string;
  type: string;
  name: string;
}

export interface GHLTask {
  id: string;
  title: string;
  body?: string;
  contactId: string;
  assignedTo?: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
}

export interface GHLNote {
  id: string;
  contactId: string;
  body: string;
  userId?: string;
  dateAdded: string;
}

export interface GHLAppointment {
  id: string;
  locationId: string;
  contactId: string;
  calendarId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled' | 'showed' | 'noshow' | 'invalid';
  notes?: string;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string;
  monetaryValue?: number;
  status: 'open' | 'won' | 'lost' | 'abandoned';
  source?: string;
}

export interface GHLCalendar {
  id: string;
  locationId: string;
  name: string;
  description?: string;
  slug?: string;
}

export interface GHLWebhookEvent {
  type: string;
  locationId: string;
  id: string;
  timestamp: string;
  payload: any;
}

export interface ContactMemoryContext {
  contactId: string;
  contactName: string;
  conversations: Array<{
    date: string;
    channel: string;
    summary: string;
    sentiment?: string;
  }>;
  tasks: Array<{
    title: string;
    dueDate?: string;
    completed: boolean;
  }>;
  appointments: Array<{
    title: string;
    startTime: string;
    status: string;
  }>;
  keyFacts: string[];
  preferences: Record<string, any>;
  lastInteraction: string;
}

export interface GHLPluginOptions {
  config: GHLConfig;
  redisUrl?: string;
  sessionPrefix?: string;
}

export interface SessionStorage {
  get(key: string): Promise<GHLTokenSet | null>;
  set(key: string, value: GHLTokenSet): Promise<void>;
  delete(key: string): Promise<void>;
}
