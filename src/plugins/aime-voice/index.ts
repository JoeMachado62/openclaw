/**
 * AIME Voice Plugin for OpenClaw
 * LiveKit voice agent with GHL CRM synchronization
 */

import type { OpenClawPluginApi, OpenClawPluginDefinition } from '../types.js';
import { BridgeLayer } from '../../bridge/index.js';
import { AICallInitiator } from '../../ai-call-initiator.js';
import { ContactMemoryManager } from '../../memory/contact-memory/index.js';

const aimeVoicePlugin: OpenClawPluginDefinition = {
  id: 'aime-voice',
  name: 'AIME Voice Agent',
  description: 'LiveKit voice agent with GoHighLevel CRM synchronization and contact memory integration',
  version: '1.0.0',

  register(api: OpenClawPluginApi) {
    api.logger.info('Initializing AIME Voice plugin...');

    let bridgeLayer: BridgeLayer | null = null;
    let callInitiator: AICallInitiator | null = null;

    // Initialize bridge layer
    const initializeBridge = () => {
      if (!bridgeLayer) {
        // Get GHL plugin instance
        const ghlPlugin = api.runtime?.getPlugin?.('gohighlevel');

        // Get memory manager
        const memoryManager = new ContactMemoryManager({
          dbPath: api.runtime?.getDataPath?.('contact-memory.db') || './data/contact-memory.db'
        });

        bridgeLayer = new BridgeLayer({
          ghlPlugin,
          memoryManager,
          modelRouter: api.runtime?.modelRouter
        });

        api.logger.info('Bridge layer initialized');
      }
      return bridgeLayer;
    };

    // Initialize AI call initiator
    const initializeCallInitiator = () => {
      if (!callInitiator) {
        callInitiator = new AICallInitiator();
        api.logger.info('AI call initiator initialized');
      }
      return callInitiator;
    };

    // Register HTTP routes from AIME server
    api.registerHttpRoute({
      path: '/api/bridge/process-call',
      handler: async (req, res) => {
        try {
          const bridge = initializeBridge();
          const result = await bridge.processCompletedCall(req.body);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            data: result
          }));
        } catch (error) {
          api.logger.error('[AIME Voice] Call processing error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }
    });

    api.registerHttpRoute({
      path: '/api/calls/ai-initiate',
      handler: async (req, res) => {
        try {
          const initiator = initializeCallInitiator();
          const result = await initiator.initiateCall(req.body);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            data: result
          }));
        } catch (error) {
          api.logger.error('[AIME Voice] Call initiation error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }
    });

    api.registerHttpRoute({
      path: '/api/calls/completed',
      handler: async (req, res) => {
        try {
          const bridge = initializeBridge();
          // Handle call completion webhook from LiveKit
          const result = await bridge.handleCallCompletion(req.body);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            data: result
          }));
        } catch (error) {
          api.logger.error('[AIME Voice] Call completion error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }
    });

    api.registerHttpRoute({
      path: '/api/calls/status/:roomName',
      handler: async (req, res) => {
        try {
          const roomName = req.params?.roomName;
          if (!roomName) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Room name required' }));
            return;
          }

          const bridge = initializeBridge();
          const status = await bridge.getCallStatus(roomName);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            data: status
          }));
        } catch (error) {
          api.logger.error('[AIME Voice] Status check error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }));
        }
      }
    });

    // Register lifecycle hooks for voice session integration
    api.on('session_start', async (event, ctx) => {
      // Initialize contact context for voice sessions
      if (ctx.channel === 'aime-voice') {
        const contactId = ctx.metadata?.contactId;
        if (contactId) {
          try {
            const bridge = initializeBridge();
            const context = await bridge.getContactContext(contactId);

            api.logger.info(`[AIME Voice] Loaded context for contact ${contactId}`);

            // Prepend context to agent prompt
            return {
              prependContext: context
            };
          } catch (error) {
            api.logger.error('[AIME Voice] Failed to load contact context:', error);
          }
        }
      }
    });

    api.on('session_end', async (event, ctx) => {
      // Process call transcript and update memory
      if (ctx.channel === 'aime-voice') {
        try {
          const bridge = initializeBridge();
          await bridge.syncCallToMemory(ctx.sessionKey);

          api.logger.info(`[AIME Voice] Synced session ${ctx.sessionKey} to memory`);
        } catch (error) {
          api.logger.error('[AIME Voice] Failed to sync call to memory:', error);
        }
      }
    });

    // Hook for post-call processing
    api.on('agent_end', async (event, ctx) => {
      if (ctx.channel === 'aime-voice' && ctx.metadata?.roomName) {
        try {
          const bridge = initializeBridge();

          // Extract transcript from event
          const transcript = event.messages?.map(m => m.content).join('\\n') || '';

          // Process transcript for tasks, sentiment, etc.
          await bridge.processTranscript({
            roomName: ctx.metadata.roomName,
            contactId: ctx.metadata.contactId,
            transcript,
            duration: ctx.metadata.duration
          });

          api.logger.info(`[AIME Voice] Processed transcript for ${ctx.metadata.roomName}`);
        } catch (error) {
          api.logger.error('[AIME Voice] Transcript processing error:', error);
        }
      }
    });

    api.logger.info('AIME Voice plugin registered');
  },

  activate(api: OpenClawPluginApi) {
    api.logger.info('AIME Voice plugin activated - LiveKit integration ready');
  }
};

export default aimeVoicePlugin;
