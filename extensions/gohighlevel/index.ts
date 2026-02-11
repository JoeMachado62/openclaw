/**
 * GoHighLevel Plugin for OpenClaw
 * Main entry point for GHL integration
 */

import { GHLAuth, MemorySessionStorage, RedisSessionStorage } from './auth.js';
import { GHLContacts } from './contacts.js';
import { GHLConversations } from './conversations.js';
import { GHLTasks } from './tasks.js';
import { GHLWebhooks } from './webhooks.js';
import type {
  GHLConfig,
  GHLPluginOptions,
  SessionStorage,
  GHLContact,
  GHLConversation,
  GHLMessage,
  GHLTask,
  ContactMemoryContext,
} from './types.js';

export * from './types.js';
export * from './auth.js';
export * from './contacts.js';
export * from './conversations.js';
export * from './tasks.js';
export * from './webhooks.js';

/**
 * Main GHL Plugin class
 */
export class GHLPlugin {
  public auth: GHLAuth;
  public contacts: GHLContacts;
  public conversations: GHLConversations;
  public tasks: GHLTasks;
  public webhooks: GHLWebhooks;

  private config: GHLConfig;
  private sessionStorage: SessionStorage;

  constructor(options: GHLPluginOptions) {
    this.config = options.config;

    // Initialize session storage (Redis or in-memory)
    if (options.redisUrl) {
      // TODO: Initialize Redis client
      // For now, using in-memory storage
      this.sessionStorage = new MemorySessionStorage();
    } else {
      this.sessionStorage = new MemorySessionStorage();
    }

    // Initialize authentication
    this.auth = new GHLAuth(this.config, this.sessionStorage);

    // Initialize service modules
    this.contacts = new GHLContacts(this.auth);
    this.conversations = new GHLConversations(this.auth);
    this.tasks = new GHLTasks(this.auth);
    this.webhooks = new GHLWebhooks(this.config.webhookSecret || '');
  }

  /**
   * Initialize the plugin with OpenClaw
   */
  async initialize(): Promise<void> {
    console.log('[GHL Plugin] Initializing GoHighLevel integration...');

    // Setup webhook handlers
    this.setupWebhookHandlers();

    console.log('[GHL Plugin] Initialization complete');
  }

  /**
   * Setup default webhook handlers
   */
  private setupWebhookHandlers(): void {
    this.webhooks.setupDefaultHandlers({
      onInboundMessage: async (event) => {
        console.log('[GHL Plugin] Inbound message received:', event.id);
        // This will be handled by the bridge layer
      },
      onContactCreate: async (event) => {
        console.log('[GHL Plugin] New contact created:', event.id);
      },
      onContactUpdate: async (event) => {
        console.log('[GHL Plugin] Contact updated:', event.id);
      },
      onTaskComplete: async (event) => {
        console.log('[GHL Plugin] Task completed:', event.id);
      },
      onAppointmentCreate: async (event) => {
        console.log('[GHL Plugin] Appointment created:', event.id);
      },
    });
  }

  /**
   * Build complete contact context for AI agent
   * This is the main function called by other parts of the system
   */
  async buildContactContext(
    locationId: string,
    contactId: string,
    options?: {
      maxMessages?: number;
      includeTasks?: boolean;
      includeAppointments?: boolean;
    }
  ): Promise<ContactMemoryContext> {
    // Get contact details
    const contact = await this.contacts.getContact(locationId, contactId);
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    // Get conversation history
    const messages = await this.conversations.getAllContactMessages(
      locationId,
      contactId,
      options?.maxMessages || 50
    );

    // Group messages into conversation summaries
    const conversationSummaries = this.summarizeConversations(messages);

    // Get tasks if requested
    let tasks: GHLTask[] = [];
    if (options?.includeTasks !== false) {
      tasks = await this.contacts.getContactTasks(locationId, contactId);
    }

    // Get appointments if requested
    let appointments: any[] = [];
    if (options?.includeAppointments !== false) {
      appointments = await this.contacts.getContactAppointments(locationId, contactId);
    }

    // Get notes
    const notes = await this.contacts.getContactNotes(locationId, contactId);

    // Extract key facts from notes
    const keyFacts = notes.map((note) => note.body).slice(0, 5);

    // Build context object
    const context: ContactMemoryContext = {
      contactId: contact.id,
      contactName: contact.contactName || `${contact.firstName} ${contact.lastName}`.trim(),
      conversations: conversationSummaries,
      tasks: tasks.map((task) => ({
        title: task.title,
        dueDate: task.dueDate,
        completed: task.completed,
      })),
      appointments: appointments.map((apt) => ({
        title: apt.title,
        startTime: apt.startTime,
        status: apt.status,
      })),
      keyFacts,
      preferences: contact.customFields || {},
      lastInteraction:
        messages.length > 0 ? messages[0].dateAdded : contact.dateUpdated || contact.dateAdded || '',
    };

    return context;
  }

  /**
   * Summarize conversations by grouping messages
   */
  private summarizeConversations(messages: GHLMessage[]): Array<{
    date: string;
    channel: string;
    summary: string;
    sentiment?: string;
  }> {
    const summaries: Array<{
      date: string;
      channel: string;
      summary: string;
      sentiment?: string;
    }> = [];

    // Group messages by conversation (simplified - just take chunks of messages)
    const chunkSize = 10;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;

      const date = new Date(chunk[0].dateAdded).toLocaleDateString();
      const channel = chunk[0].type;
      const preview = chunk
        .slice(0, 3)
        .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Agent'}: ${m.body.substring(0, 50)}`)
        .join(' | ');

      summaries.push({
        date,
        channel,
        summary: preview,
      });
    }

    return summaries;
  }

  /**
   * Format contact context as text for AI prompt
   */
  formatContextForAI(context: ContactMemoryContext): string {
    let formatted = `# Contact: ${context.contactName}\n\n`;

    formatted += `## Recent Conversations (${context.conversations.length})\n`;
    for (const conv of context.conversations.slice(0, 5)) {
      formatted += `- **${conv.date}** (${conv.channel}): ${conv.summary}\n`;
    }

    if (context.tasks.length > 0) {
      formatted += `\n## Active Tasks (${context.tasks.length})\n`;
      for (const task of context.tasks.filter((t) => !t.completed).slice(0, 5)) {
        formatted += `- [ ] ${task.title}${task.dueDate ? ` (due: ${new Date(task.dueDate).toLocaleDateString()})` : ''}\n`;
      }
    }

    if (context.appointments.length > 0) {
      formatted += `\n## Upcoming Appointments\n`;
      for (const apt of context.appointments.slice(0, 3)) {
        formatted += `- **${new Date(apt.startTime).toLocaleString()}**: ${apt.title} (${apt.status})\n`;
      }
    }

    if (context.keyFacts.length > 0) {
      formatted += `\n## Key Facts\n`;
      for (const fact of context.keyFacts) {
        formatted += `- ${fact}\n`;
      }
    }

    formatted += `\n**Last Interaction**: ${new Date(context.lastInteraction).toLocaleString()}\n`;

    return formatted;
  }
}

/**
 * Factory function to create GHL plugin instance
 */
export function createGHLPlugin(config: GHLConfig, options?: { redisUrl?: string }): GHLPlugin {
  return new GHLPlugin({
    config,
    redisUrl: options?.redisUrl,
  });
}

/**
 * Load GHL configuration from environment variables
 * Supports two modes:
 * 1. Private Integration: Only requires GHL_PIT_TOKEN + GHL_LOCATION_ID
 * 2. OAuth App: Requires GHL_CLIENT_ID + GHL_CLIENT_SECRET + GHL_REDIRECT_URI
 */
export function loadGHLConfigFromEnv(): GHLConfig {
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  // Check if using Private Integration Token mode
  if (pitToken) {
    console.log('[GHL Plugin] Using Private Integration Token mode');
    // OAuth credentials are optional when using PIT
    return {
      clientId: clientId || 'not_required_for_pit',
      clientSecret: clientSecret || 'not_required_for_pit',
      redirectUri: redirectUri || 'not_required_for_pit',
      webhookSecret: process.env.GHL_WEBHOOK_SECRET,
      pitToken,
      locationId,
    };
  }

  // OAuth mode - require all OAuth credentials
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing required GHL configuration. For OAuth apps, set GHL_CLIENT_ID, GHL_CLIENT_SECRET, and GHL_REDIRECT_URI. For private integrations, set GHL_PIT_TOKEN.'
    );
  }

  console.log('[GHL Plugin] Using OAuth mode');
  return {
    clientId,
    clientSecret,
    redirectUri,
    webhookSecret: process.env.GHL_WEBHOOK_SECRET,
    pitToken,
    locationId,
  };
}

/**
 * OpenClaw Plugin Definition
 * This integrates GHL with OpenClaw's plugin system
 */
import type { OpenClawPluginApi, OpenClawPluginDefinition } from '../types.js';
import { createGHLToolsExpanded } from './tool-expanded.js';

const ghlPlugin: OpenClawPluginDefinition = {
  id: 'gohighlevel',
  name: 'GoHighLevel CRM',
  description: 'GoHighLevel CRM integration with comprehensive tools: contacts, conversations, tasks, workflows, opportunities, tags, campaigns',
  version: '1.0.0',
  kind: 'integration',

  register(api: OpenClawPluginApi) {
    api.logger.info('Registering GoHighLevel plugin...');

    // Register comprehensive agent tools
    api.registerTool(createGHLToolsExpanded, {
      names: [
        // Contacts
        'ghl_get_contact', 'ghl_search_contacts',
        // Conversations
        'ghl_get_conversation_history', 'ghl_send_message',
        // Tasks
        'ghl_create_task', 'ghl_get_contact_tasks', 'ghl_update_task',
        // Workflows
        'ghl_list_workflows', 'ghl_trigger_workflow',
        // Opportunities
        'ghl_list_pipelines', 'ghl_get_contact_opportunities', 'ghl_create_opportunity', 'ghl_update_opportunity',
        // Tags & Smart Lists
        'ghl_get_tags', 'ghl_add_tag', 'ghl_remove_tag', 'ghl_get_contacts_by_tag', 'ghl_get_contacts_by_tags',
        // Campaigns
        'ghl_create_campaign', 'ghl_start_campaign', 'ghl_pause_campaign', 'ghl_get_campaign',
        'ghl_get_next_campaign_contact', 'ghl_mark_campaign_contact', 'ghl_bulk_sms_campaign'
      ]
    });

    api.logger.info('GoHighLevel tools registered - 27 tools available');
  },

  activate(api: OpenClawPluginApi) {
    api.logger.info('GoHighLevel plugin activated successfully');
  }
};

export default ghlPlugin;
