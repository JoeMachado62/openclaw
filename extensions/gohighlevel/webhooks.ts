/**
 * GoHighLevel Webhooks Handler
 * Processes incoming webhook events from GHL
 */

import crypto from 'crypto';
import type { GHLWebhookEvent } from './types.js';

export type WebhookEventType =
  | 'ContactCreate'
  | 'ContactUpdate'
  | 'ContactDelete'
  | 'InboundMessage'
  | 'OutboundMessage'
  | 'TaskCreate'
  | 'TaskUpdate'
  | 'TaskComplete'
  | 'AppointmentCreate'
  | 'AppointmentUpdate'
  | 'AppointmentDelete'
  | 'OpportunityCreate'
  | 'OpportunityUpdate'
  | 'OpportunityStageChange';

export type WebhookHandler = (event: GHLWebhookEvent) => Promise<void>;

export class GHLWebhooks {
  private webhookSecret: string;
  private handlers: Map<WebhookEventType | 'all', WebhookHandler[]> = new Map();

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn('Webhook secret not configured, skipping signature verification');
      return true; // In development, we might skip verification
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }

  /**
   * Register a webhook event handler
   */
  on(eventType: WebhookEventType | 'all', handler: WebhookHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Process incoming webhook event
   */
  async processWebhook(
    payload: string,
    signature?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify signature if provided
      if (signature && !this.verifySignature(payload, signature)) {
        console.error('Invalid webhook signature');
        return { success: false, error: 'Invalid signature' };
      }

      const event: GHLWebhookEvent = JSON.parse(payload);

      // Validate event structure
      if (!event.type || !event.locationId || !event.timestamp) {
        console.error('Invalid webhook event structure');
        return { success: false, error: 'Invalid event structure' };
      }

      // Execute event-specific handlers
      const specificHandlers = this.handlers.get(event.type as WebhookEventType) || [];
      const allHandlers = this.handlers.get('all') || [];

      const allPromises = [...specificHandlers, ...allHandlers].map((handler) =>
        handler(event).catch((error) => {
          console.error(`Webhook handler error for ${event.type}:`, error);
        })
      );

      await Promise.all(allPromises);

      return { success: true };
    } catch (error) {
      console.error('Failed to process webhook:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Setup default event handlers for AIME platform
   */
  setupDefaultHandlers(options: {
    onInboundMessage?: (event: GHLWebhookEvent) => Promise<void>;
    onContactCreate?: (event: GHLWebhookEvent) => Promise<void>;
    onContactUpdate?: (event: GHLWebhookEvent) => Promise<void>;
    onTaskComplete?: (event: GHLWebhookEvent) => Promise<void>;
    onAppointmentCreate?: (event: GHLWebhookEvent) => Promise<void>;
  }): void {
    if (options.onInboundMessage) {
      this.on('InboundMessage', options.onInboundMessage);
    }

    if (options.onContactCreate) {
      this.on('ContactCreate', options.onContactCreate);
    }

    if (options.onContactUpdate) {
      this.on('ContactUpdate', options.onContactUpdate);
    }

    if (options.onTaskComplete) {
      this.on('TaskComplete', options.onTaskComplete);
    }

    if (options.onAppointmentCreate) {
      this.on('AppointmentCreate', options.onAppointmentCreate);
    }

    // Default logging for all events
    this.on('all', async (event) => {
      console.log(`[GHL Webhook] ${event.type} - Location: ${event.locationId}`);
    });
  }

  /**
   * Create Express/Hono middleware for webhook endpoint
   */
  createMiddleware() {
    return async (req: any, res: any) => {
      try {
        const signature = req.headers['x-ghl-signature'] || req.headers['x-webhook-signature'];
        const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

        const result = await this.processWebhook(payload, signature);

        if (result.success) {
          res.status(200).json({ success: true });
        } else {
          res.status(400).json({ success: false, error: result.error });
        }
      } catch (error) {
        console.error('Webhook middleware error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    };
  }
}

/**
 * Helper to extract contact ID from webhook event
 */
export function getContactIdFromEvent(event: GHLWebhookEvent): string | null {
  if (event.payload?.contact?.id) {
    return event.payload.contact.id;
  }
  if (event.payload?.contactId) {
    return event.payload.contactId;
  }
  return null;
}

/**
 * Helper to extract conversation ID from webhook event
 */
export function getConversationIdFromEvent(event: GHLWebhookEvent): string | null {
  if (event.payload?.conversation?.id) {
    return event.payload.conversation.id;
  }
  if (event.payload?.conversationId) {
    return event.payload.conversationId;
  }
  return null;
}
