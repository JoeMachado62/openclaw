/**
 * Contact Memory Plugin for OpenClaw
 * Unified contact memory with fact extraction and retrieval
 */

import type { OpenClawPluginApi, OpenClawPluginDefinition } from '../types.js';
import type { AnyAgentTool } from '../../agents/tools/common.js';
import type { AgentToolResult } from '@mariozechner/pi-agent-core';
import { ContactMemoryManager } from './contact-memory/index.js';

const contactMemoryPlugin: OpenClawPluginDefinition = {
  id: 'contact-memory',
  name: 'Contact Memory System',
  description: 'Unified contact memory with fact extraction and retrieval',
  version: '1.0.0',
  kind: 'memory',

  register(api: OpenClawPluginApi) {
    api.logger.info('Initializing Contact Memory plugin...');

    // Get data directory for SQLite database
    const dbPath = api.runtime?.getDataPath?.('contact-memory.db') || './data/contact-memory.db';

    let memoryManager: ContactMemoryManager | null = null;

    // Initialize memory manager as a service
    api.registerService({
      name: 'ContactMemory',
      start: async () => {
        try {
          memoryManager = new ContactMemoryManager({
            dbPath
          });
          await memoryManager.initialize();
          api.logger.info('Contact memory initialized successfully');
        } catch (error) {
          api.logger.error('Failed to initialize contact memory:', error);
          throw error;
        }
      },
      stop: async () => {
        if (memoryManager) {
          await memoryManager.close();
          api.logger.info('Contact memory closed');
        }
      }
    });

    // Register memory search and retrieval tools
    api.registerTool((ctx) => {
      if (!memoryManager) {
        api.logger.warn('Contact memory not initialized, tools unavailable');
        return null;
      }

      const tools: AnyAgentTool[] = [
        {
          name: 'memory_search_contacts',
          description: 'Search contact memory by name, facts, or interactions. Returns contacts matching the search query.',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query - can be name, key facts, or interaction content'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                default: 5
              }
            },
            required: ['query']
          },
          execute: async (params): Promise<AgentToolResult<unknown>> => {
            try {
              const results = await memoryManager!.searchContacts(
                params.query,
                params.limit || 5
              );

              if (results.length === 0) {
                return {
                  type: 'success',
                  content: `No contacts found matching "${params.query}"`
                };
              }

              const formatted = results.map(contact => ({
                id: contact.contactId,
                name: contact.contactName,
                keyFacts: contact.keyFacts?.slice(0, 3) || [],
                lastInteraction: contact.lastInteraction,
                sentiment: contact.sentiment
              }));

              return {
                type: 'success',
                content: JSON.stringify(formatted, null, 2)
              };
            } catch (error) {
              return {
                type: 'error',
                error: `Memory search failed: ${error instanceof Error ? error.message : String(error)}`
              };
            }
          }
        },

        {
          name: 'memory_get_contact',
          description: 'Retrieve complete contact memory by ID including all interactions, key facts, and conversation history.',
          parameters: {
            type: 'object',
            properties: {
              contactId: {
                type: 'string',
                description: 'Contact ID to retrieve'
              },
              includeInteractions: {
                type: 'boolean',
                description: 'Include full interaction history (default: true)',
                default: true
              }
            },
            required: ['contactId']
          },
          execute: async (params): Promise<AgentToolResult<unknown>> => {
            try {
              const contact = await memoryManager!.getContact(params.contactId);

              if (!contact) {
                return {
                  type: 'success',
                  content: `Contact ${params.contactId} not found in memory`
                };
              }

              const formatted = memoryManager!.formatContext(contact);
              return {
                type: 'success',
                content: formatted
              };
            } catch (error) {
              return {
                type: 'error',
                error: `Failed to retrieve contact: ${error instanceof Error ? error.message : String(error)}`
              };
            }
          }
        }
      ];

      return tools;
    }, {
      names: ['memory_search_contacts', 'memory_get_contact']
    });

    // Hook into message flow for automatic indexing
    api.on('message_received', async (event, ctx) => {
      if (!memoryManager) return;

      // Only index for specific channels
      const indexableChannels = ['telegram', 'aime-voice', 'whatsapp'];
      if (!event.channel || !indexableChannels.includes(event.channel)) {
        return;
      }

      try {
        await memoryManager.indexInteraction({
          contactId: event.sender?.id || 'unknown',
          channel: event.channel,
          message: event.text || '',
          timestamp: new Date(),
          direction: 'inbound'
        });

        api.logger.debug(`Indexed interaction from ${event.sender?.id}`);
      } catch (error) {
        api.logger.error('Failed to index interaction:', error);
      }
    });

    // Hook into outbound messages for indexing
    api.on('message_sent', async (event, ctx) => {
      if (!memoryManager) return;

      const indexableChannels = ['telegram', 'aime-voice', 'whatsapp'];
      if (!event.channel || !indexableChannels.includes(event.channel)) {
        return;
      }

      try {
        await memoryManager.indexInteraction({
          contactId: event.recipient?.id || 'unknown',
          channel: event.channel,
          message: event.text || '',
          timestamp: new Date(),
          direction: 'outbound'
        });

        api.logger.debug(`Indexed outbound message to ${event.recipient?.id}`);
      } catch (error) {
        api.logger.error('Failed to index outbound message:', error);
      }
    });

    api.logger.info('Contact Memory plugin registered');
  },

  activate(api: OpenClawPluginApi) {
    api.logger.info('Contact Memory plugin activated');
  }
};

export default contactMemoryPlugin;
