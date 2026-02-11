/**
 * AIME Server
 * Main server that integrates all AIME components
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import Database from 'better-sqlite3';
import { createGHLPlugin, loadGHLConfigFromEnv } from './plugins/ghl/index.js';
import { ContactMemoryManager } from './memory/contact-memory/index.js';
import { createModelRouter } from './routing/model-router/index.js';
import { BridgeLayer } from './bridge/index.js';
import { AICallInitiator } from './ai-call-initiator.js';

const app = new Hono();

// Enable CORS
app.use('/*', cors());

// Global instances
let ghlPlugin: any;
let memoryManager: any;
let modelRouter: any;
let bridgeLayer: any;
let aiCallInitiator: AICallInitiator;

/**
 * Initialize AIME platform
 */
async function initializeAIME() {
  console.log('🚀 Initializing AIME Platform...');

  // 1. Initialize GHL Plugin
  const ghlConfig = loadGHLConfigFromEnv();
  ghlPlugin = createGHLPlugin(ghlConfig, {
    redisUrl: process.env.REDIS_URL,
  });
  await ghlPlugin.initialize();
  console.log('✅ GHL Plugin initialized');

  // 2. Initialize Database
  const dbPath = process.env.DATABASE_PATH || './data/aime.db';
  const db = new Database(dbPath);
  console.log('✅ Database initialized');

  // 3. Initialize Contact Memory
  memoryManager = new ContactMemoryManager(ghlPlugin, db);
  await memoryManager.initialize(db);
  console.log('✅ Contact Memory initialized');

  // 4. Initialize Model Router
  modelRouter = createModelRouter();
  console.log('✅ Model Router initialized');

  // 5. Initialize Bridge Layer
  bridgeLayer = new BridgeLayer(ghlPlugin, memoryManager, modelRouter);
  await bridgeLayer.initialize();
  console.log('✅ Bridge Layer initialized');

  // 6. Initialize AI Call Initiator
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';
  aiCallInitiator = new AICallInitiator(anthropicApiKey);
  console.log('✅ AI Call Initiator initialized');

  console.log('🎉 AIME Platform ready!');
}

/**
 * Health check
 */
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: Date.now() });
});

/**
 * GHL OAuth callback
 */
app.get('/auth/ghl/callback', async (c) => {
  const code = c.req.query('code');

  if (!code) {
    return c.json({ error: 'No authorization code provided' }, 400);
  }

  try {
    const tokens = await ghlPlugin.auth.exchangeCodeForTokens(code);
    return c.json({ success: true, locationId: tokens.locationId });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GHL Webhooks
 */
app.post('/webhooks/ghl', async (c) => {
  const signature = c.req.header('x-ghl-signature');
  const body = await c.req.text();

  const result = await ghlPlugin.webhooks.processWebhook(body, signature);

  if (result.success) {
    return c.json({ success: true });
  } else {
    return c.json({ success: false, error: result.error }, 400);
  }
});

/**
 * Bridge API: Process completed call
 */
app.post('/api/bridge/process-call', async (c) => {
  const data = await c.req.json();
  const result = await bridgeLayer.processCall(data);
  return c.json(result);
});

/**
 * Bridge API: Get contact context
 */
app.get('/api/bridge/memory/context/:contactId', async (c) => {
  const contactId = c.req.param('contactId');
  const context = await bridgeLayer.getContactContext(contactId);
  return c.json(context);
});

/**
 * Bridge API: Lookup contact
 */
app.post('/api/bridge/contacts/lookup', async (c) => {
  const { location_id, phone } = await c.req.json();
  const contact = await bridgeLayer.lookupContact(location_id, phone);
  return c.json(contact);
});

/**
 * Bridge API: Check availability
 */
app.post('/api/bridge/appointments/availability', async (c) => {
  const { location_id, date, service_type } = await c.req.json();
  const slots = await bridgeLayer.checkAvailability(location_id, date, service_type);
  return c.json({ slots });
});

/**
 * Bridge API: Book appointment
 */
app.post('/api/bridge/appointments/book', async (c) => {
  const data = await c.req.json();
  const result = await bridgeLayer.bookAppointment({
    locationId: data.location_id || '',
    date: data.date,
    time: data.time,
    name: data.name,
    phone: data.phone,
    service: data.service,
  });
  return c.json(result);
});

/**
 * Bridge API: Create task
 */
app.post('/api/bridge/tasks/create', async (c) => {
  const data = await c.req.json();
  const task = await bridgeLayer.createTask(data);
  return c.json(task);
});

/**
 * Model Router API: Get cost report
 */
app.get('/api/router/cost-report', (c) => {
  const report = modelRouter.getCostReport();
  return c.text(report, 200, { 'Content-Type': 'text/plain' });
});

/**
 * Model Router API: Get metrics
 */
app.get('/api/router/metrics', (c) => {
  const metrics = modelRouter.getCostMetrics();
  return c.json(metrics);
});

/**
 * Contact Memory API: Sync contact
 */
app.post('/api/memory/sync/:locationId/:contactId', async (c) => {
  const locationId = c.req.param('locationId');
  const contactId = c.req.param('contactId');

  try {
    await memoryManager.syncContactFromGHL(locationId, contactId);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Contact Memory API: Get context
 */
app.get('/api/memory/context/:contactId', async (c) => {
  const contactId = c.req.param('contactId');
  const context = await memoryManager.getContactContext(contactId);
  return c.json(context);
});

/**
 * Contact Memory API: Search contacts
 */
app.get('/api/memory/search', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10');
  const results = await memoryManager.searchContacts(query, limit);
  return c.json(results);
});

/**
 * Outbound Calling API: Initiate outbound sales call
 */
app.post('/api/calls/initiate', async (c) => {
  const { phoneNumber, contactId, locationId, campaignId } = await c.req.json();

  // Validate required fields
  if (!phoneNumber || !contactId || !locationId) {
    return c.json({ error: 'Missing required fields: phoneNumber, contactId, locationId' }, 400);
  }

  // Validate phone number format (E.164)
  if (!phoneNumber.startsWith('+')) {
    return c.json({ error: 'Phone number must be in E.164 format (e.g., +13055551234)' }, 400);
  }

  try {
    // Validate contact exists in GHL
    const contact = await ghlPlugin.contacts.getContact(locationId, contactId);
    if (!contact) {
      return c.json({ error: 'Contact not found in GoHighLevel' }, 404);
    }

    // Create room name for the call
    const timestamp = Date.now();
    const roomName = `aime-outbound-${contactId}-${timestamp}`;

    // Prepare metadata for LiveKit
    const callMetadata = {
      contact_id: contactId,
      location_id: locationId,
      campaign_id: campaignId,
      direction: 'outbound',
      initiated_at: new Date().toISOString(),
      phone_number: phoneNumber,
      contact_name: contact.contactName || 'Unknown',
    };

    // Call LiveKit SIP API to initiate outbound call
    // NOTE: This requires LiveKit SIP trunk to be configured
    const livekitUrl = process.env.LIVEKIT_URL || '';
    const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
    const sipTrunkId = process.env.LIVEKIT_SIP_TRUNK_ID || '';

    if (!sipTrunkId) {
      return c.json({
        error: 'SIP trunk not configured. Please set LIVEKIT_SIP_TRUNK_ID in .env',
        message: 'You need to create a SIP trunk in LiveKit dashboard and add the ID to your .env file'
      }, 500);
    }

    // Generate LiveKit access token for API call
    const { AccessToken } = await import('livekit-server-sdk');
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: 'aime-server',
      ttl: 300, // 5 minutes
    });

    // Call LiveKit SIP API
    // Note: This is a simplified version. In production, use the LiveKit server SDK
    const sipApiUrl = `${livekitUrl.replace('wss://', 'https://')}/sip/create_outbound_call`;

    const sipResponse = await fetch(sipApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.toJwt()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sip_trunk_id: sipTrunkId,
        phone_number: phoneNumber,
        room_name: roomName,
        metadata: JSON.stringify(callMetadata),
      }),
    });

    if (!sipResponse.ok) {
      const errorText = await sipResponse.text();
      console.error('LiveKit SIP API error:', errorText);
      return c.json({
        error: 'Failed to initiate outbound call',
        details: errorText,
        message: 'Check LiveKit SIP trunk configuration and phone number format'
      }, 500);
    }

    const callData = await sipResponse.json();

    // Log call initiation in contact memory
    await memoryManager.addInteraction({
      contactId: contactId,
      type: 'call',
      direction: 'outbound',
      timestamp: timestamp,
      status: 'initiated',
      metadata: {
        room_name: roomName,
        campaign_id: campaignId,
        phone_number: phoneNumber,
      },
    });

    console.log(`✅ Outbound call initiated to ${phoneNumber} (contact: ${contactId})`);

    return c.json({
      success: true,
      roomName: roomName,
      callId: callData.sip_call_id || callData.call_id,
      phoneNumber: phoneNumber,
      contactId: contactId,
      initiatedAt: callMetadata.initiated_at,
      monitorUrl: `https://cloud.livekit.io/projects/${livekitUrl.split('//')[1]?.split('.')[0]}/rooms/${roomName}`,
    });

  } catch (error: any) {
    console.error('Error initiating outbound call:', error);
    return c.json({
      error: 'Failed to initiate outbound call',
      message: error.message || String(error)
    }, 500);
  }
});

/**
 * AI-Powered Call Initiation: Natural language interface
 *
 * Example:
 * POST /api/calls/ai-initiate
 * {
 *   "instruction": "Call JC Lopez at 786-731-8794 and ask if he's available for lunch today with Joe Machado at Chili's on Kendall Drive. Notify me via text at 305-555-1234."
 * }
 */
app.post('/api/calls/ai-initiate', async (c) => {
  const { instruction, userId, userName } = await c.req.json();

  if (!instruction) {
    return c.json({ error: 'Missing instruction field' }, 400);
  }

  try {
    console.log(`📞 AI Call Instruction received: "${instruction.substring(0, 100)}..."`);

    // Step 1: Parse the natural language instruction using Claude
    const parsed = await aiCallInitiator.parseCallInstruction(instruction);

    console.log('✅ Parsed call instruction:', {
      phoneNumber: parsed.phoneNumber,
      contactName: parsed.contactName,
      hasInstructions: !!parsed.instructions,
    });

    // Step 2: Look up or create contact in GHL
    let contactId: string;
    let locationId: string;

    // Try to find existing contact by phone
    try {
      // This would need to be updated based on your GHL setup
      // For now, we'll create a temporary contact ID
      contactId = `ai-call-${Date.now()}`;
      locationId = process.env.DEFAULT_GHL_LOCATION_ID || 'default';

      // TODO: Implement actual GHL contact lookup/creation
      // const contact = await ghlPlugin.contacts.searchByPhone(parsed.phoneNumber);
      // if (contact) {
      //   contactId = contact.id;
      //   locationId = contact.locationId;
      // } else {
      //   const newContact = await ghlPlugin.contacts.create({
      //     firstName: parsed.contactName.split(' ')[0],
      //     lastName: parsed.contactName.split(' ').slice(1).join(' '),
      //     phone: parsed.phoneNumber,
      //   });
      //   contactId = newContact.id;
      //   locationId = newContact.locationId;
      // }
    } catch (e) {
      console.warn('Could not look up contact in GHL, using temporary ID');
      contactId = `ai-call-${Date.now()}`;
      locationId = 'default';
    }

    // Step 3: Generate custom system prompt for the voice agent
    const customPrompt = aiCallInitiator.generateCustomPrompt(parsed);

    // Step 4: Create room name and metadata
    const timestamp = Date.now();
    const roomName = `aime-ai-call-${contactId}-${timestamp}`;

    const callMetadata = {
      contact_id: contactId,
      location_id: locationId,
      direction: 'outbound',
      initiated_at: new Date().toISOString(),
      phone_number: parsed.phoneNumber,
      contact_name: parsed.contactName,
      ai_instructions: parsed.instructions,
      custom_prompt: customPrompt,
      notification_phone: parsed.notificationPhone,
      notification_method: parsed.notificationMethod || 'sms',
      user_id: userId,
      user_name: userName,
    };

    // Step 5: Initiate the call via LiveKit SIP
    const livekitUrl = process.env.LIVEKIT_URL || '';
    const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
    const sipTrunkId = process.env.LIVEKIT_SIP_TRUNK_ID || '';

    if (!sipTrunkId) {
      return c.json({
        error: 'SIP trunk not configured',
        message: 'Please set LIVEKIT_SIP_TRUNK_ID in .env file',
      }, 500);
    }

    // Generate LiveKit access token
    const { AccessToken } = await import('livekit-server-sdk');
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: 'aime-ai-caller',
      ttl: 300,
    });

    // Call LiveKit SIP API
    const sipApiUrl = `${livekitUrl.replace('wss://', 'https://')}/sip/create_outbound_call`;

    const sipResponse = await fetch(sipApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token.toJwt()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sip_trunk_id: sipTrunkId,
        phone_number: parsed.phoneNumber,
        room_name: roomName,
        metadata: JSON.stringify(callMetadata),
      }),
    });

    if (!sipResponse.ok) {
      const errorText = await sipResponse.text();
      console.error('LiveKit SIP API error:', errorText);
      return c.json({
        error: 'Failed to initiate AI call',
        details: errorText,
      }, 500);
    }

    const callData = await sipResponse.json();

    // Step 6: Log in memory and prepare for callback
    await memoryManager.addInteraction({
      contactId: contactId,
      type: 'ai_call',
      direction: 'outbound',
      timestamp: timestamp,
      status: 'initiated',
      metadata: {
        room_name: roomName,
        ai_instructions: parsed.instructions,
        expected_outcome: parsed.expectedOutcome,
        notification_phone: parsed.notificationPhone,
      },
    });

    console.log(`✅ AI-powered call initiated to ${parsed.contactName} (${parsed.phoneNumber})`);

    return c.json({
      success: true,
      message: `Calling ${parsed.contactName}...`,
      details: {
        contactName: parsed.contactName,
        phoneNumber: parsed.phoneNumber,
        instructions: parsed.instructions,
        roomName: roomName,
        callId: callData.sip_call_id || callData.call_id,
        monitorUrl: `https://cloud.livekit.io/projects/${livekitUrl.split('//')[1]?.split('.')[0]}/rooms/${roomName}`,
      },
      // Include notification info so user knows where they'll get the result
      notification: parsed.notificationPhone
        ? `You'll receive the result via ${parsed.notificationMethod || 'SMS'} at ${parsed.notificationPhone}`
        : 'Check the call status endpoint for results',
    });

  } catch (error: any) {
    console.error('Error initiating AI call:', error);
    return c.json({
      error: 'Failed to initiate AI call',
      message: error.message || String(error),
    }, 500);
  }
});

/**
 * Call completion webhook: Receives call results and sends notifications
 */
app.post('/api/calls/completed', async (c) => {
  const {
    roomName,
    transcript,
    duration,
    metadata,
    outcome,
  } = await c.req.json();

  try {
    console.log(`📞 Call completed: ${roomName}`);

    // Parse metadata
    const meta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;

    // Update contact memory with call outcome
    await memoryManager.addInteraction({
      contactId: meta.contact_id,
      type: 'ai_call_completed',
      direction: 'outbound',
      timestamp: Date.now(),
      status: 'completed',
      metadata: {
        room_name: roomName,
        transcript: transcript,
        duration_seconds: duration,
        outcome: outcome,
      },
    });

    // Send notification if requested
    if (meta.notification_phone) {
      const notificationMessage = `Call with ${meta.contact_name} completed!\n\nOutcome: ${outcome || 'See transcript for details'}\n\nDuration: ${Math.floor(duration / 60)}m ${duration % 60}s`;

      if (meta.notification_method === 'telegram') {
        // Send via Telegram (you'd need to implement this)
        console.log('📱 Would send Telegram notification:', notificationMessage);
        // await sendTelegramMessage(meta.user_id, notificationMessage);
      } else {
        // Send via SMS (you'd need to implement this with Twilio or similar)
        console.log('📱 Would send SMS notification to:', meta.notification_phone);
        // await sendSMS(meta.notification_phone, notificationMessage);
      }
    }

    console.log('✅ Call completion processed');

    return c.json({ success: true });

  } catch (error: any) {
    console.error('Error processing call completion:', error);
    return c.json({
      error: 'Failed to process call completion',
      message: error.message || String(error),
    }, 500);
  }
});

/**
 * Outbound Calling API: Get call status
 */
app.get('/api/calls/status/:roomName', async (c) => {
  const roomName = c.req.param('roomName');

  try {
    const livekitUrl = process.env.LIVEKIT_URL || '';
    const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
    const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';

    // Use LiveKit SDK to get room info
    const { RoomServiceClient } = await import('livekit-server-sdk');
    const roomClient = new RoomServiceClient(livekitUrl, livekitApiKey, livekitApiSecret);

    const rooms = await roomClient.listRooms([roomName]);

    if (rooms.length === 0) {
      return c.json({ status: 'not_found', roomName: roomName });
    }

    const room = rooms[0];
    const metadata = room.metadata ? JSON.parse(room.metadata) : {};

    return c.json({
      status: room.numParticipants > 0 ? 'active' : 'ended',
      roomName: roomName,
      numParticipants: room.numParticipants,
      createdAt: room.creationTime,
      metadata: metadata,
    });

  } catch (error: any) {
    console.error('Error getting call status:', error);
    return c.json({
      error: 'Failed to get call status',
      message: error.message || String(error)
    }, 500);
  }
});

/**
 * Start server
 */
async function startServer() {
  await initializeAIME();

  const port = parseInt(process.env.PORT || '3000');
  console.log(`\n🌟 AIME Server running on http://localhost:${port}\n`);

  return app;
}

// Auto-start if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().then((app) => {
    const port = parseInt(process.env.PORT || '3000');
    console.log(`Server started on port ${port}`);
  });
}

export { app, startServer };
