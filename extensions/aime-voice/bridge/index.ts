/**
 * Bridge Layer
 * Synchronizes data between LiveKit voice system and OpenClaw CRM
 */

import type { GHLPlugin } from '../plugins/ghl/index.js';
import type { ContactMemoryManager } from '../memory/contact-memory/index.js';
import type { ModelRouter } from '../routing/model-router/index.js';
import { TranscriptProcessor } from './transcript-processor.js';
import { ContextProvider } from './context-provider.js';
import { EventSync } from './event-sync.js';

export class BridgeLayer {
  private ghlPlugin: GHLPlugin;
  private memoryManager: ContactMemoryManager;
  private modelRouter: ModelRouter;
  private transcriptProcessor: TranscriptProcessor;
  private contextProvider: ContextProvider;
  private eventSync: EventSync;

  constructor(
    ghlPlugin: GHLPlugin,
    memoryManager: ContactMemoryManager,
    modelRouter: ModelRouter,
    redisClient?: any
  ) {
    this.ghlPlugin = ghlPlugin;
    this.memoryManager = memoryManager;
    this.modelRouter = modelRouter;

    this.transcriptProcessor = new TranscriptProcessor(
      ghlPlugin,
      memoryManager,
      modelRouter
    );
    this.contextProvider = new ContextProvider(memoryManager);
    this.eventSync = new EventSync(redisClient);
  }

  /**
   * Initialize the bridge layer
   */
  async initialize(): Promise<void> {
    console.log('[Bridge] Initializing bridge layer...');

    // Setup event listeners
    await this.eventSync.initialize();

    // Subscribe to LiveKit events
    this.eventSync.subscribe('livekit:call:started', this.handleCallStarted.bind(this));
    this.eventSync.subscribe('livekit:call:ended', this.handleCallEnded.bind(this));
    this.eventSync.subscribe('ghl:webhook:*', this.handleGHLWebhook.bind(this));

    console.log('[Bridge] Bridge layer initialized');
  }

  /**
   * Handle call started event
   */
  private async handleCallStarted(event: any): Promise<void> {
    console.log(`[Bridge] Call started: ${event.roomName}`);

    try {
      const { contactId, locationId } = event;

      // Sync contact from GHL to memory
      if (contactId && locationId) {
        await this.memoryManager.syncContactFromGHL(locationId, contactId);
      }

      // Get contact context
      const context = await this.contextProvider.getContextForCall(contactId);

      // Publish context for LiveKit agent
      await this.eventSync.publish('openclaw:context:ready', {
        roomName: event.roomName,
        contactId,
        context,
      });
    } catch (error) {
      console.error('[Bridge] Failed to handle call start:', error);
    }
  }

  /**
   * Handle call ended event
   */
  private async handleCallEnded(event: any): Promise<void> {
    console.log(`[Bridge] Call ended: ${event.roomName}`);

    try {
      const { contactId, locationId, transcript, durationSeconds } = event;

      if (!transcript || !contactId || !locationId) {
        console.warn('[Bridge] Missing required data for post-call processing');
        return;
      }

      // Process transcript and create tasks
      await this.transcriptProcessor.processCallTranscript(
        locationId,
        contactId,
        transcript,
        durationSeconds
      );

      console.log(`[Bridge] Post-call processing completed for ${contactId}`);
    } catch (error) {
      console.error('[Bridge] Failed to handle call end:', error);
    }
  }

  /**
   * Handle GHL webhook events
   */
  private async handleGHLWebhook(event: any): Promise<void> {
    console.log(`[Bridge] GHL webhook: ${event.type}`);

    // Update memory when contact data changes
    if (event.type === 'ContactUpdate' && event.payload?.contact?.id) {
      try {
        await this.memoryManager.syncContactFromGHL(
          event.locationId,
          event.payload.contact.id
        );
      } catch (error) {
        console.error('[Bridge] Failed to sync contact from webhook:', error);
      }
    }

    // Handle inbound messages
    if (event.type === 'InboundMessage') {
      // Could trigger proactive agent response here
      console.log('[Bridge] Inbound message received:', event.payload);
    }
  }

  /**
   * API endpoint: Process completed call
   */
  async processCall(data: {
    contactId: string;
    locationId: string;
    phone?: string;
    transcript: string;
    durationSeconds: number;
    roomName: string;
  }): Promise<{ success: boolean; tasksCreated: number }> {
    return this.transcriptProcessor.processCallTranscript(
      data.locationId,
      data.contactId,
      data.transcript,
      data.durationSeconds
    );
  }

  /**
   * API endpoint: Get contact context
   */
  async getContactContext(contactId: string): Promise<any> {
    return this.contextProvider.getContextForCall(contactId);
  }

  /**
   * API endpoint: Lookup contact by phone
   */
  async lookupContact(locationId: string, phone: string): Promise<any> {
    const contacts = await this.ghlPlugin.contacts.searchContacts(locationId, { phone });
    return contacts.length > 0 ? contacts[0] : null;
  }

  /**
   * API endpoint: Check appointment availability
   */
  async checkAvailability(locationId: string, date: string, serviceType: string): Promise<string[]> {
    // This would integrate with GHL calendar API
    // For now, returning mock data
    return ['09:00 AM', '10:00 AM', '02:00 PM', '03:00 PM'];
  }

  /**
   * API endpoint: Book appointment
   */
  async bookAppointment(data: {
    locationId: string;
    date: string;
    time: string;
    name: string;
    phone: string;
    service: string;
  }): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
    try {
      // Find or create contact
      let contact = await this.lookupContact(data.locationId, data.phone);

      if (!contact) {
        contact = await this.ghlPlugin.contacts.upsertContact(data.locationId, {
          firstName: data.name.split(' ')[0],
          lastName: data.name.split(' ').slice(1).join(' '),
          phone: data.phone,
          source: 'AIME-Voice',
        });
      }

      if (!contact) {
        return { success: false, error: 'Failed to create contact' };
      }

      // Book appointment via GHL
      // Note: Actual implementation would use GHL appointments API
      // For now, creating a task as a placeholder
      const task = await this.ghlPlugin.tasks.createTask(data.locationId, {
        contactId: contact.id,
        title: `Appointment: ${data.service}`,
        body: `Scheduled for ${data.date} at ${data.time}`,
        dueDate: new Date(`${data.date}T${data.time}`).toISOString(),
      });

      return {
        success: true,
        appointmentId: task?.id,
      };
    } catch (error) {
      console.error('[Bridge] Failed to book appointment:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * API endpoint: Create task
   */
  async createTask(data: {
    contactId: string;
    locationId: string;
    title: string;
    body: string;
    dueDate?: string;
  }): Promise<any> {
    return this.ghlPlugin.tasks.createTask(data.locationId, {
      contactId: data.contactId,
      title: data.title,
      body: data.body,
      dueDate: data.dueDate,
    });
  }
}

export * from './transcript-processor.js';
export * from './context-provider.js';
export * from './event-sync.js';
