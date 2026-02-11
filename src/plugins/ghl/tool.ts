/**
 * GoHighLevel Agent Tools
 * OpenClaw tool wrapper for GHL CRM integration
 */

import type { AnyAgentTool } from '../../agents/tools/common.js';
import type { OpenClawPluginToolContext } from '../types.js';
import { GHLPlugin, loadGHLConfigFromEnv } from './index.js';
import type { AgentToolResult } from '@mariozechner/pi-agent-core';

/**
 * Create GHL agent tools for OpenClaw
 */
export function createGHLTool(ctx: OpenClawPluginToolContext): AnyAgentTool[] | null {
  try {
    // Load GHL config from environment or plugin config
    const config = ctx.config?.plugins?.gohighlevel || loadGHLConfigFromEnv();

    // Initialize GHL plugin instance
    const plugin = new GHLPlugin({
      config,
      redisUrl: ctx.config?.redis?.url
    });

    // Get location ID from config or env
    const locationId = config.locationId || process.env.GHL_LOCATION_ID;
    if (!locationId) {
      console.warn('[GHL Tools] No location ID configured, tools will require explicit locationId parameter');
    }

    return [
      {
        name: 'ghl_get_contact',
        description: 'Get complete contact information from GoHighLevel CRM including conversation history, tasks, appointments, and notes',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'GHL Contact ID (required)'
            },
            locationId: {
              type: 'string',
              description: 'GHL Location ID (optional, uses default if not provided)'
            },
            includeConversations: {
              type: 'boolean',
              description: 'Include conversation history (default: true)',
              default: true
            },
            includeTasks: {
              type: 'boolean',
              description: 'Include tasks (default: true)',
              default: true
            },
            includeAppointments: {
              type: 'boolean',
              description: 'Include appointments (default: true)',
              default: true
            },
            maxMessages: {
              type: 'number',
              description: 'Maximum messages to retrieve (default: 50)',
              default: 50
            }
          },
          required: ['contactId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) {
              return {
                type: 'error',
                error: 'Location ID is required. Provide locationId parameter or set GHL_LOCATION_ID environment variable.'
              };
            }

            const context = await plugin.buildContactContext(
              loc,
              params.contactId,
              {
                maxMessages: params.maxMessages,
                includeTasks: params.includeTasks,
                includeAppointments: params.includeAppointments
              }
            );

            const formatted = plugin.formatContextForAI(context);

            return {
              type: 'success',
              content: formatted
            };
          } catch (error) {
            return {
              type: 'error',
              error: `Failed to get contact: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
      },

      {
        name: 'ghl_search_contacts',
        description: 'Search for contacts in GoHighLevel CRM by name, email, phone, or other fields',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (name, email, phone, etc.)'
            },
            locationId: {
              type: 'string',
              description: 'GHL Location ID (optional, uses default if not provided)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 10)',
              default: 10
            }
          },
          required: ['query']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) {
              return {
                type: 'error',
                error: 'Location ID is required. Provide locationId parameter or set GHL_LOCATION_ID environment variable.'
              };
            }

            const contacts = await plugin.contacts.searchContacts(
              loc,
              params.query,
              params.limit
            );

            return {
              type: 'success',
              content: JSON.stringify(contacts.map(c => ({
                id: c.id,
                name: c.contactName || `${c.firstName} ${c.lastName}`.trim(),
                email: c.email,
                phone: c.phone,
                tags: c.tags
              })), null, 2)
            };
          } catch (error) {
            return {
              type: 'error',
              error: `Failed to search contacts: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
      },

      {
        name: 'ghl_create_task',
        description: 'Create a follow-up task in GoHighLevel CRM for a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'GHL Contact ID'
            },
            locationId: {
              type: 'string',
              description: 'GHL Location ID (optional, uses default if not provided)'
            },
            title: {
              type: 'string',
              description: 'Task title/description'
            },
            description: {
              type: 'string',
              description: 'Detailed task description (optional)'
            },
            dueDate: {
              type: 'string',
              description: 'Due date in ISO 8601 format (e.g., 2024-12-31T10:00:00Z)'
            },
            assignedTo: {
              type: 'string',
              description: 'User ID to assign task to (optional)'
            }
          },
          required: ['contactId', 'title']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) {
              return {
                type: 'error',
                error: 'Location ID is required. Provide locationId parameter or set GHL_LOCATION_ID environment variable.'
              };
            }

            const task = await plugin.tasks.createTask(loc, {
              contactId: params.contactId,
              title: params.title,
              body: params.description,
              dueDate: params.dueDate,
              assignedTo: params.assignedTo
            });

            return {
              type: 'success',
              content: `Task created successfully:\nID: ${task.id}\nTitle: ${task.title}\nDue: ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Not set'}`
            };
          } catch (error) {
            return {
              type: 'error',
              error: `Failed to create task: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
      },

      {
        name: 'ghl_send_message',
        description: 'Send a message to a contact via SMS, Email, or WhatsApp through GoHighLevel',
        parameters: {
          type: 'object',
          properties: {
            contactId: {
              type: 'string',
              description: 'GHL Contact ID'
            },
            locationId: {
              type: 'string',
              description: 'GHL Location ID (optional, uses default if not provided)'
            },
            message: {
              type: 'string',
              description: 'Message content to send'
            },
            type: {
              type: 'string',
              enum: ['SMS', 'Email', 'WhatsApp'],
              description: 'Message type (default: SMS)',
              default: 'SMS'
            }
          },
          required: ['contactId', 'message']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) {
              return {
                type: 'error',
                error: 'Location ID is required. Provide locationId parameter or set GHL_LOCATION_ID environment variable.'
              };
            }

            const result = await plugin.conversations.sendMessage(loc, {
              contactId: params.contactId,
              type: params.type || 'SMS',
              message: params.message
            });

            return {
              type: 'success',
              content: `Message sent successfully via ${params.type || 'SMS'}\nMessage ID: ${result.messageId}`
            };
          } catch (error) {
            return {
              type: 'error',
              error: `Failed to send message: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
      }
    ];
  } catch (error) {
    console.error('[GHL Tools] Failed to initialize:', error);
    return null;
  }
}
