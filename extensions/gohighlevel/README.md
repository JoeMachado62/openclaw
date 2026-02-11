# GoHighLevel Plugin for EZWAi AIME

This plugin provides complete integration with GoHighLevel CRM using the official `@gohighlevel/api-client` SDK.

## Features

- ✅ **OAuth Authentication** - Full OAuth 2.0 flow with automatic token refresh
- ✅ **Contact Management** - Retrieve, search, create, and update contacts
- ✅ **Conversation History** - Access full message history across all channels (SMS, Email, WhatsApp, etc.)
- ✅ **Task Management** - Create and manage follow-up tasks
- ✅ **Webhook Handling** - Process real-time events from GHL
- ✅ **Context Building** - Compile complete contact context for AI agents

## Installation

The plugin is already integrated into the EZWAi_Aime project. Required dependencies:

```bash
pnpm add @gohighlevel/api-client
```

## Configuration

Set up environment variables in `.env`:

```env
# Required
GHL_CLIENT_ID=your_client_id_here
GHL_CLIENT_SECRET=your_client_secret_here
GHL_REDIRECT_URI=http://localhost:3000/auth/ghl/callback

# Optional
GHL_WEBHOOK_SECRET=your_webhook_secret_here
GHL_PIT_TOKEN=your_private_integration_token_here  # For development
```

## Usage

### Basic Initialization

```typescript
import { createGHLPlugin, loadGHLConfigFromEnv } from './plugins/ghl/index.js';

// Load config from environment
const config = loadGHLConfigFromEnv();

// Create plugin instance
const ghlPlugin = createGHLPlugin(config, {
  redisUrl: process.env.REDIS_URL, // Optional: for production token storage
});

// Initialize
await ghlPlugin.initialize();
```

### OAuth Flow

```typescript
// 1. Generate authorization URL
const authUrl = ghlPlugin.auth.getAuthorizationUrl([
  'contacts.readonly',
  'contacts.write',
  'conversations.readonly',
  'conversations.write',
  'calendars.readonly',
], 'optional-state');

// 2. Redirect user to authUrl
// 3. Handle callback with authorization code
const tokens = await ghlPlugin.auth.exchangeCodeForTokens(authorizationCode);
```

### Working with Contacts

```typescript
// Get contact by ID
const contact = await ghlPlugin.contacts.getContact(locationId, contactId);

// Search contacts
const contacts = await ghlPlugin.contacts.searchContacts(locationId, {
  email: 'customer@example.com',
});

// Create or update contact
const newContact = await ghlPlugin.contacts.upsertContact(locationId, {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  tags: ['lead', 'hot'],
});
```

### Conversation History

```typescript
// Get all messages for a contact
const messages = await ghlPlugin.conversations.getAllContactMessages(
  locationId,
  contactId,
  50 // limit
);

// Build formatted history for AI
const history = await ghlPlugin.conversations.buildConversationHistory(
  locationId,
  contactId
);
```

### Task Management

```typescript
// Create a task
const task = await ghlPlugin.tasks.createTask(locationId, {
  contactId,
  title: 'Follow up on pricing discussion',
  body: 'Customer asked about enterprise pricing',
  dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
});

// Get contact tasks
const tasks = await ghlPlugin.tasks.getContactTasks(locationId, contactId);
```

### Webhook Handling

```typescript
// Setup webhook handlers
ghlPlugin.webhooks.on('InboundMessage', async (event) => {
  console.log('New inbound message:', event.payload);
  // Process message and trigger agent response
});

ghlPlugin.webhooks.on('ContactCreate', async (event) => {
  console.log('New contact created:', event.payload);
});

// Use as Express/Hono middleware
app.post('/webhooks/ghl', ghlPlugin.webhooks.createMiddleware());
```

### Building AI Context

The main function for AI agents - compiles complete contact context:

```typescript
// Build complete contact context
const context = await ghlPlugin.buildContactContext(locationId, contactId, {
  maxMessages: 50,
  includeTasks: true,
  includeAppointments: true,
});

// Format for AI prompt
const aiPrompt = ghlPlugin.formatContextForAI(context);

// Use in agent system prompt:
// "You are talking to {contactName}. Here's their history:\n{aiPrompt}"
```

## Integration with AIME Platform

### 1. Contact Memory System

The GHL plugin feeds data into the unified contact memory:

```typescript
import { ContactMemoryManager } from '../memory/contact-memory/index.js';

const memoryManager = new ContactMemoryManager(ghlPlugin);

// Update memory from GHL
await memoryManager.syncContactFromGHL(locationId, contactId);

// Get enriched context
const enrichedContext = await memoryManager.getContactContext(contactId);
```

### 2. LiveKit Bridge

The bridge layer calls GHL plugin when a call starts:

```typescript
// When LiveKit call starts
const context = await ghlPlugin.buildContactContext(locationId, contactId);

// Send to LiveKit agent as system prompt or tool context
await liveKitAgent.updateContext(context);
```

### 3. Automatic Task Creation

After a conversation ends:

```typescript
// Extract tasks from transcript
const tasks = await ghlPlugin.tasks.extractAndCreateTasks(
  locationId,
  contactId,
  conversationTranscript,
  conversationSummary
);

console.log(`Created ${tasks.length} follow-up tasks`);
```

## API Reference

### GHLAuth

- `getAuthorizationUrl(scopes, state?)` - Generate OAuth URL
- `exchangeCodeForTokens(code)` - Exchange auth code for tokens
- `refreshAccessToken(refreshToken)` - Refresh expired token
- `getValidAccessToken(locationId)` - Get valid token (auto-refreshes)
- `revokeTokens(locationId)` - Revoke and delete tokens

### GHLContacts

- `getContact(locationId, contactId)` - Get contact by ID
- `searchContacts(locationId, query)` - Search contacts
- `upsertContact(locationId, contactData)` - Create or update contact
- `getContactNotes(locationId, contactId)` - Get notes
- `createContactNote(locationId, contactId, body)` - Add note
- `getContactTasks(locationId, contactId)` - Get tasks
- `createContactTask(locationId, taskData)` - Create task
- `getContactAppointments(locationId, contactId)` - Get appointments

### GHLConversations

- `getConversation(locationId, conversationId)` - Get conversation
- `getConversationsByContact(locationId, contactId)` - Get all conversations
- `getMessages(locationId, conversationId, options?)` - Get messages
- `getAllContactMessages(locationId, contactId, limit?)` - Get all messages
- `sendMessage(locationId, conversationId, message)` - Send message
- `createConversation(locationId, contactId, type)` - Create conversation
- `buildConversationHistory(locationId, contactId, options?)` - Build formatted history

### GHLTasks

- `createTask(locationId, taskData)` - Create task
- `updateTask(locationId, taskId, updates)` - Update task
- `deleteTask(locationId, taskId)` - Delete task
- `getContactTasks(locationId, contactId)` - Get tasks
- `extractAndCreateTasks(locationId, contactId, transcript, summary?)` - Auto-extract tasks

### GHLWebhooks

- `on(eventType, handler)` - Register event handler
- `processWebhook(payload, signature?)` - Process webhook
- `verifySignature(payload, signature)` - Verify webhook signature
- `createMiddleware()` - Create Express/Hono middleware

## Event Types

Supported webhook event types:

- `ContactCreate` - New contact created
- `ContactUpdate` - Contact updated
- `ContactDelete` - Contact deleted
- `InboundMessage` - Incoming message from contact
- `OutboundMessage` - Outgoing message to contact
- `TaskCreate` - Task created
- `TaskUpdate` - Task updated
- `TaskComplete` - Task completed
- `AppointmentCreate` - Appointment booked
- `AppointmentUpdate` - Appointment updated
- `AppointmentDelete` - Appointment cancelled
- `OpportunityCreate` - Opportunity created
- `OpportunityUpdate` - Opportunity updated
- `OpportunityStageChange` - Opportunity stage changed

## Development

### Using PIT Token

For development, you can use a Private Integration Token (PIT) instead of OAuth:

1. Get PIT from GHL Marketplace App settings
2. Set `GHL_PIT_TOKEN` in `.env`
3. The plugin will automatically use PIT when no OAuth tokens exist

### Testing

```typescript
// Use in-memory storage for testing
const ghlPlugin = createGHLPlugin(config); // No Redis URL = in-memory

// Mock webhook events
const testEvent = {
  type: 'InboundMessage',
  locationId: 'loc_123',
  id: 'evt_456',
  timestamp: new Date().toISOString(),
  payload: {
    message: { body: 'Test message' },
  },
};

await ghlPlugin.webhooks.processWebhook(JSON.stringify(testEvent));
```

## Rate Limits

GHL enforces aggressive rate limits:

- **Contacts API**: ~100 requests/minute per location
- **Conversations API**: ~50 requests/minute per location
- **Webhooks**: No limit (push-based)

**Best Practices**:
- Cache contact data in unified memory
- Use webhooks instead of polling
- Batch operations when possible
- Implement exponential backoff on 429 errors

## Troubleshooting

### "No tokens found"

- Ensure OAuth flow completed successfully
- Check that tokens are stored correctly
- Try using PIT token for development

### "Invalid signature"

- Verify `GHL_WEBHOOK_SECRET` matches app settings
- Check that webhook payload hasn't been modified
- Signature verification can be disabled for development (not recommended)

### "Rate limit exceeded"

- Reduce API call frequency
- Implement caching layer
- Use webhooks for real-time data
- Wait for rate limit reset (check `X-RateLimit-Reset` header)

## Next Steps

1. ✅ GHL Plugin Complete
2. ⏳ Unified Contact Memory - Integrate with existing OpenClaw memory system
3. ⏳ Model Router (T0-T3) - Add tier routing for task extraction
4. ⏳ LiveKit Bridge - Connect voice layer to GHL data
5. ⏳ Auto Task Creation - Enhance with AI model integration

## Support

For GHL API documentation: https://marketplace.gohighlevel.com/docs

For AIME-specific issues: See project PRD and knowledge base
