/**
 * GoHighLevel Agent Tools - EXPANDED VERSION
 * Comprehensive OpenClaw tool wrapper for GHL CRM integration
 * Includes: Contacts, Conversations, Tasks, Workflows, Opportunities, Tags, Campaigns
 */

import type { AnyAgentTool } from '../../agents/tools/common.js';
import type { OpenClawPluginToolContext } from '../types.js';
import { GHLPlugin, loadGHLConfigFromEnv } from './index.js';
import { GHLWorkflows } from './workflows.js';
import { GHLOpportunities } from './opportunities.js';
import { GHLTags } from './tags.js';
import { GHLCampaigns } from './campaigns.js';
import type { AgentToolResult } from '@mariozechner/pi-agent-core';

/**
 * Create comprehensive GHL agent tools for OpenClaw
 */
export function createGHLToolsExpanded(ctx: OpenClawPluginToolContext): AnyAgentTool[] | null {
  try {
    // Load GHL config from environment or plugin config
    const config = ctx.config?.plugins?.gohighlevel || loadGHLConfigFromEnv();

    // Initialize GHL plugin instance and additional modules
    const plugin = new GHLPlugin({
      config,
      redisUrl: ctx.config?.redis?.url
    });

    const workflows = new GHLWorkflows(plugin.auth);
    const opportunities = new GHLOpportunities(plugin.auth);
    const tags = new GHLTags(plugin.auth);
    const campaigns = new GHLCampaigns(plugin.auth);

    // Get location ID from config or env
    const locationId = config.locationId || process.env.GHL_LOCATION_ID;
    if (!locationId) {
      console.warn('[GHL Tools] No location ID configured, tools will require explicit locationId parameter');
    }

    return [
      // ==================== CONTACTS ====================
      {
        name: 'ghl_get_contact',
        description: 'Get complete contact information from GoHighLevel CRM including conversation history, tasks, appointments, and notes. Use this before replying to a contact to get context.',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'GHL Contact ID (required)' },
            locationId: { type: 'string', description: 'GHL Location ID (optional)' },
            includeConversations: { type: 'boolean', description: 'Include conversation history', default: true },
            includeTasks: { type: 'boolean', description: 'Include tasks', default: true },
            maxMessages: { type: 'number', description: 'Max messages to retrieve', default: 50 }
          },
          required: ['contactId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const context = await plugin.buildContactContext(loc, params.contactId, {
              maxMessages: params.maxMessages,
              includeTasks: params.includeTasks
            });

            return { type: 'success', content: plugin.formatContextForAI(context) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_search_contacts',
        description: 'Search for contacts in GoHighLevel CRM by name, email, phone, or other fields',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            locationId: { type: 'string' },
            limit: { type: 'number', default: 10 }
          },
          required: ['query']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const contacts = await plugin.contacts.searchContacts(loc, params.query, params.limit);
            return { type: 'success', content: JSON.stringify(contacts.map(c => ({
              id: c.id, name: c.contactName, email: c.email, phone: c.phone, tags: c.tags
            })), null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      // ==================== CONVERSATIONS ====================
      {
        name: 'ghl_get_conversation_history',
        description: 'Get detailed conversation history for a contact. Essential for context-aware responses.',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string', description: 'Contact ID' },
            locationId: { type: 'string' },
            maxMessages: { type: 'number', default: 50 }
          },
          required: ['contactId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const history = await plugin.conversations.buildConversationHistory(loc, params.contactId, {
              maxMessages: params.maxMessages
            });

            return { type: 'success', content: history };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_send_message',
        description: 'Send a message to a contact via SMS, Email, or WhatsApp',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            locationId: { type: 'string' },
            message: { type: 'string' },
            type: { type: 'string', enum: ['SMS', 'Email', 'WhatsApp'], default: 'SMS' }
          },
          required: ['contactId', 'message']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const result = await plugin.conversations.sendMessage(loc, {
              contactId: params.contactId,
              type: params.type || 'SMS',
              message: params.message
            });

            return { type: 'success', content: `Message sent via ${params.type}. ID: ${result.messageId}` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      // ==================== TASKS ====================
      {
        name: 'ghl_create_task',
        description: 'Create a follow-up task in GoHighLevel for a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            locationId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            dueDate: { type: 'string', description: 'ISO 8601 format' },
            assignedTo: { type: 'string' }
          },
          required: ['contactId', 'title']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const task = await plugin.tasks.createTask(loc, {
              contactId: params.contactId,
              title: params.title,
              body: params.description,
              dueDate: params.dueDate,
              assignedTo: params.assignedTo
            });

            return { type: 'success', content: `Task created: ${task.id} - ${task.title}` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_get_contact_tasks',
        description: 'Get all tasks for a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            locationId: { type: 'string' }
          },
          required: ['contactId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const tasks = await plugin.tasks.getContactTasks(loc, params.contactId);
            return { type: 'success', content: JSON.stringify(tasks, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_update_task',
        description: 'Update an existing task',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            locationId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            completed: { type: 'boolean' },
            dueDate: { type: 'string' }
          },
          required: ['taskId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const task = await plugin.tasks.updateTask(loc, params.taskId, {
              title: params.title,
              body: params.description,
              completed: params.completed,
              dueDate: params.dueDate
            });

            return { type: 'success', content: `Task updated: ${task.id}` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      // ==================== WORKFLOWS ====================
      {
        name: 'ghl_list_workflows',
        description: 'List all available workflows in the location',
        parameters: {
          type: 'object',
          properties: {
            locationId: { type: 'string' }
          }
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const wfs = await workflows.listWorkflows(loc);
            return { type: 'success', content: JSON.stringify(wfs.map(w => ({
              id: w.id, name: w.name, status: w.status
            })), null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_trigger_workflow',
        description: 'Add a contact to a workflow to trigger automation',
        parameters: {
          type: 'object',
          properties: {
            workflowId: { type: 'string', description: 'Workflow ID' },
            contactId: { type: 'string', description: 'Contact ID' },
            locationId: { type: 'string' }
          },
          required: ['workflowId', 'contactId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const success = await workflows.addContactToWorkflow(loc, params.workflowId, params.contactId);
            return { type: 'success', content: success ? 'Contact added to workflow' : 'Failed to add contact' };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      // ==================== OPPORTUNITIES ====================
      {
        name: 'ghl_list_pipelines',
        description: 'List all sales pipelines and their stages',
        parameters: {
          type: 'object',
          properties: {
            locationId: { type: 'string' }
          }
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const pipelines = await opportunities.listPipelines(loc);
            return { type: 'success', content: JSON.stringify(pipelines, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_get_contact_opportunities',
        description: 'Get all opportunities/deals for a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            locationId: { type: 'string' }
          },
          required: ['contactId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const opps = await opportunities.getContactOpportunities(loc, params.contactId);
            return { type: 'success', content: JSON.stringify(opps, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_create_opportunity',
        description: 'Create a new opportunity/deal for a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            name: { type: 'string', description: 'Opportunity name' },
            pipelineId: { type: 'string' },
            pipelineStageId: { type: 'string' },
            monetaryValue: { type: 'number' },
            status: { type: 'string', enum: ['open', 'won', 'lost', 'abandoned'], default: 'open' },
            locationId: { type: 'string' }
          },
          required: ['contactId', 'name', 'pipelineId', 'pipelineStageId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const opp = await opportunities.createOpportunity(loc, {
              contactId: params.contactId,
              name: params.name,
              pipelineId: params.pipelineId,
              pipelineStageId: params.pipelineStageId,
              status: params.status || 'open',
              monetaryValue: params.monetaryValue
            });

            return { type: 'success', content: `Opportunity created: ${opp.id} - ${opp.name}` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_update_opportunity',
        description: 'Update an opportunity - change stage, status, value, etc.',
        parameters: {
          type: 'object',
          properties: {
            opportunityId: { type: 'string' },
            pipelineStageId: { type: 'string', description: 'Move to this stage' },
            status: { type: 'string', enum: ['open', 'won', 'lost', 'abandoned'] },
            monetaryValue: { type: 'number' },
            name: { type: 'string' },
            locationId: { type: 'string' }
          },
          required: ['opportunityId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const opp = await opportunities.updateOpportunity(loc, params.opportunityId, {
              name: params.name,
              pipelineStageId: params.pipelineStageId,
              status: params.status,
              monetaryValue: params.monetaryValue
            });

            return { type: 'success', content: `Opportunity updated: ${opp.id}` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      // ==================== TAGS & SMART LISTS ====================
      {
        name: 'ghl_get_tags',
        description: 'Get all available tags in the location',
        parameters: {
          type: 'object',
          properties: {
            locationId: { type: 'string' }
          }
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const allTags = await tags.getTags(loc);
            return { type: 'success', content: JSON.stringify(allTags.map(t => t.name), null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_add_tag',
        description: 'Add a tag to a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            tagName: { type: 'string' },
            locationId: { type: 'string' }
          },
          required: ['contactId', 'tagName']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const success = await tags.addTagToContact(loc, params.contactId, params.tagName);
            return { type: 'success', content: success ? `Tag "${params.tagName}" added` : 'Failed' };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_remove_tag',
        description: 'Remove a tag from a contact',
        parameters: {
          type: 'object',
          properties: {
            contactId: { type: 'string' },
            tagName: { type: 'string' },
            locationId: { type: 'string' }
          },
          required: ['contactId', 'tagName']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const success = await tags.removeTagFromContact(loc, params.contactId, params.tagName);
            return { type: 'success', content: success ? `Tag "${params.tagName}" removed` : 'Failed' };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_get_contacts_by_tag',
        description: 'Get a smart list of contacts with a specific tag',
        parameters: {
          type: 'object',
          properties: {
            tagName: { type: 'string' },
            locationId: { type: 'string' },
            limit: { type: 'number', default: 100 }
          },
          required: ['tagName']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const contacts = await tags.getContactsByTag(loc, params.tagName, params.limit);
            return { type: 'success', content: JSON.stringify(contacts, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_get_contacts_by_tags',
        description: 'Get contacts matching multiple tags (smart list with AND/OR logic)',
        parameters: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' }, description: 'Array of tag names' },
            matchAll: { type: 'boolean', default: false, description: 'true=AND (all tags), false=OR (any tag)' },
            locationId: { type: 'string' },
            limit: { type: 'number', default: 100 }
          },
          required: ['tags']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const contacts = await tags.getContactsByTags(loc, params.tags, params.matchAll, params.limit);
            return { type: 'success', content: JSON.stringify(contacts, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      // ==================== CAMPAIGNS & BULK OUTREACH ====================
      {
        name: 'ghl_create_campaign',
        description: 'Create a bulk outreach campaign (call, SMS, or email) for a list of contacts',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Campaign name' },
            type: { type: 'string', enum: ['call', 'sms', 'email'] },
            script: { type: 'string', description: 'Script/message template for the campaign' },
            contactIds: { type: 'array', items: { type: 'string' }, description: 'Contact IDs' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Or use tags to auto-populate' },
            locationId: { type: 'string' }
          },
          required: ['name', 'type']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const campaign = await campaigns.createCampaign(loc, {
              name: params.name,
              type: params.type,
              contactIds: params.contactIds || [],
              tags: params.tags,
              script: params.script
            });

            return { type: 'success', content: `Campaign created: ${campaign.id}\nContacts: ${campaign.totalCount}\nType: ${campaign.type}` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_start_campaign',
        description: 'Start a campaign',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string' }
          },
          required: ['campaignId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const success = await campaigns.startCampaign(params.campaignId);
            return { type: 'success', content: success ? 'Campaign started' : 'Failed' };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_pause_campaign',
        description: 'Pause a running campaign',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string' }
          },
          required: ['campaignId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const success = await campaigns.pauseCampaign(params.campaignId);
            return { type: 'success', content: success ? 'Campaign paused' : 'Failed' };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_get_campaign',
        description: 'Get campaign details and status',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string' }
          },
          required: ['campaignId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const campaign = campaigns.getCampaign(params.campaignId);
            if (!campaign) return { type: 'error', error: 'Campaign not found' };

            return { type: 'success', content: JSON.stringify({
              id: campaign.id,
              name: campaign.name,
              type: campaign.type,
              status: campaign.status,
              progress: `${campaign.completedCount}/${campaign.totalCount}`,
              script: campaign.script
            }, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_get_next_campaign_contact',
        description: 'Get next contact in campaign for outreach (used when making calls from a list)',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string' }
          },
          required: ['campaignId']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const contact = campaigns.getNextContact(params.campaignId);
            if (!contact) return { type: 'success', content: 'No more contacts in campaign' };

            const campaign = campaigns.getCampaign(params.campaignId);
            return { type: 'success', content: JSON.stringify({
              contact: contact,
              script: campaign?.script,
              progress: `${campaign.completedCount + 1}/${campaign.totalCount}`
            }, null, 2) };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_mark_campaign_contact',
        description: 'Mark contact as contacted in campaign with result',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string' },
            contactId: { type: 'string' },
            result: { type: 'string', enum: ['completed', 'failed', 'no_answer'] },
            notes: { type: 'string' }
          },
          required: ['campaignId', 'contactId', 'result']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const success = await campaigns.markContactAttempt(
              params.campaignId,
              params.contactId,
              params.result,
              params.notes
            );

            return { type: 'success', content: success ? 'Contact marked' : 'Failed' };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      },

      {
        name: 'ghl_bulk_sms_campaign',
        description: 'Send bulk SMS to all contacts in a campaign',
        parameters: {
          type: 'object',
          properties: {
            campaignId: { type: 'string' },
            message: { type: 'string' },
            locationId: { type: 'string' }
          },
          required: ['campaignId', 'message']
        },
        execute: async (params): Promise<AgentToolResult<unknown>> => {
          try {
            const loc = params.locationId || locationId;
            if (!loc) return { type: 'error', error: 'Location ID required' };

            const result = await campaigns.sendBulkSMS(loc, params.campaignId, params.message);
            return { type: 'success', content: `Bulk SMS complete: ${result.sent} sent, ${result.failed} failed` };
          } catch (error) {
            return { type: 'error', error: `Failed: ${error.message}` };
          }
        }
      }
    ];
  } catch (error) {
    console.error('[GHL Tools] Failed to initialize:', error);
    return null;
  }
}
