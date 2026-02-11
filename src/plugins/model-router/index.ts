/**
 * Model Router Plugin for OpenClaw
 * T0-T3 cost-optimized intelligent model routing with tier escalation
 */

import type { OpenClawPluginApi, OpenClawPluginDefinition } from '../types.js';
import { ModelRouter } from '../../routing/model-router/index.js';

const modelRouterPlugin: OpenClawPluginDefinition = {
  id: 'model-router',
  name: 'T0-T3 Model Router',
  description: 'Cost-optimized intelligent model routing with automatic tier escalation',
  version: '1.0.0',

  register(api: OpenClawPluginApi) {
    api.logger.info('Initializing Model Router plugin...');

    // Initialize router with tier configuration
    const router = new ModelRouter({
      t0: {
        provider: 'ollama',
        model: 'llama3.1:8b',
        costPer1M: 0 // Free local inference
      },
      t1: {
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        costPer1M: 0.25
      },
      t2: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        costPer1M: 3.0
      },
      t3: {
        provider: 'anthropic',
        model: 'claude-opus-4-6',
        costPer1M: 15.0
      }
    });

    // Register cost tracking HTTP endpoint
    api.registerHttpRoute({
      path: '/api/model-router/costs',
      handler: async (req, res) => {
        try {
          const report = router.getCostReport();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(report, null, 2));
        } catch (error) {
          api.logger.error('Cost report error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to get cost report' }));
        }
      }
    });

    // Register tier stats endpoint
    api.registerHttpRoute({
      path: '/api/model-router/stats',
      handler: async (req, res) => {
        try {
          const stats = router.getTierStats();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(stats, null, 2));
        } catch (error) {
          api.logger.error('Stats error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Failed to get stats' }));
        }
      }
    });

    // Register CLI command for cost reporting
    api.registerCli(({ program }) => {
      program
        .command('router-stats')
        .description('Show model routing cost statistics and tier usage')
        .action(() => {
          const report = router.getCostReport();
          console.log('\\n📊 Model Router Statistics\\n');
          console.log(`Total Cost: $${report.totalCost.toFixed(2)}`);
          console.log(`Total Requests: ${report.totalRequests}`);
          console.log('\\nBy Tier:');

          for (const [tier, stats] of Object.entries(report.tierBreakdown)) {
            console.log(`  ${tier}: ${stats.requests} requests ($${stats.cost.toFixed(2)})`);
          }

          console.log('\\nBy Model:');
          for (const [model, stats] of Object.entries(report.modelBreakdown)) {
            console.log(`  ${model}: ${stats.requests} requests ($${stats.cost.toFixed(2)})`);
          }
        });
    }, { commands: ['router-stats'] });

    // Hook into agent requests for intelligent routing
    api.on('before_agent_start', async (event, ctx) => {
      try {
        // Classify task complexity
        const tier = await router.classifyTask(event.prompt || '');
        const modelConfig = router.getTierConfig(tier);

        api.logger.info(`[Model Router] Routing to ${tier}: ${modelConfig.model}`);

        // Track the request
        router.trackRequest(tier, modelConfig.model);

        // Return model override
        return {
          model: modelConfig.model,
          provider: modelConfig.provider
        };
      } catch (error) {
        api.logger.error('[Model Router] Classification failed, using default:', error);
        return undefined; // Fall back to default model
      }
    });

    // Hook for escalation on tool call failures
    api.on('after_tool_call', async (event, ctx) => {
      // Check if tool call failed and might need escalation
      if (event.result?.type === 'error') {
        const currentTier = ctx.metadata?.currentTier;
        if (currentTier && router.shouldEscalate(currentTier, event.result.error)) {
          const nextTier = router.getNextTier(currentTier);
          api.logger.info(`[Model Router] Escalating from ${currentTier} to ${nextTier}`);

          // Store escalation info in context
          return {
            metadata: {
              ...ctx.metadata,
              currentTier: nextTier,
              escalated: true
            }
          };
        }
      }
    });

    api.logger.info('Model Router plugin registered');
  },

  activate(api: OpenClawPluginApi) {
    api.logger.info('Model Router plugin activated - intelligent tier routing enabled');
  }
};

export default modelRouterPlugin;
