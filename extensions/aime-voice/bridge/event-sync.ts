/**
 * Event Synchronization
 * Redis pub/sub for real-time event synchronization
 */

type EventHandler = (data: any) => Promise<void>;

export class EventSync {
  private handlers: Map<string, EventHandler[]> = new Map();
  private redisClient: any;

  constructor(redisClient?: any) {
    this.redisClient = redisClient;
  }

  /**
   * Initialize event sync
   */
  async initialize(): Promise<void> {
    if (!this.redisClient) {
      console.warn('[EventSync] No Redis client provided - using in-memory events');
      return;
    }

    // Setup Redis pub/sub
    // TODO: Implement Redis subscriber
    console.log('[EventSync] Initialized with Redis');
  }

  /**
   * Subscribe to events
   */
  subscribe(pattern: string, handler: EventHandler): void {
    if (!this.handlers.has(pattern)) {
      this.handlers.set(pattern, []);
    }
    this.handlers.get(pattern)!.push(handler);
  }

  /**
   * Publish event
   */
  async publish(channel: string, data: any): Promise<void> {
    if (this.redisClient) {
      // Redis pub/sub
      await this.redisClient.publish(channel, JSON.stringify(data));
    }

    // Also trigger local handlers
    await this.triggerHandlers(channel, data);
  }

  /**
   * Trigger local event handlers
   */
  private async triggerHandlers(channel: string, data: any): Promise<void> {
    // Exact match handlers
    const exactHandlers = this.handlers.get(channel) || [];

    // Wildcard handlers
    const wildcardHandlers: EventHandler[] = [];
    for (const [pattern, handlers] of this.handlers.entries()) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(channel)) {
          wildcardHandlers.push(...handlers);
        }
      }
    }

    const allHandlers = [...exactHandlers, ...wildcardHandlers];

    for (const handler of allHandlers) {
      try {
        await handler(data);
      } catch (error) {
        console.error(`[EventSync] Handler error for ${channel}:`, error);
      }
    }
  }
}
