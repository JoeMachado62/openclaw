# AIME Platform - Agent Instructions

This file contains instructions for AI agents working on the AIME (AI-powered Multi-channel Engagement) platform.

---

## Project Overview

**AIME** is an AI-powered voice agent platform built on:
- **OpenClaw**: Multi-channel AI gateway framework (v2026.2.9)
- **LiveKit**: Real-time voice communication infrastructure
- **GoHighLevel (GHL)**: CRM integration via official SDK
- **Claude Sonnet 4.5**: Primary LLM with cost-optimized routing (T0-T3)

### Architecture

```
Phone Call (+13059521569)
    ↓
LiveKit Cloud (SIP)
    ↓
Voice Agent (Python)
    ├─→ Deepgram (STT)
    ├─→ Anthropic Claude (LLM)
    ├─→ Cartesia/OpenAI (TTS)
    └─→ OpenClaw Bridge (Node.js)
         ├─→ GHL Plugin (contacts, conversations, tasks)
         ├─→ Contact Memory (cross-channel history)
         └─→ Model Router (T0→T3 cost optimization)
```

---

## LiveKit Documentation

**IMPORTANT**: LiveKit Agents is a fast-evolving project, and the documentation is updated frequently. You should **always refer to the latest documentation** when working with this project.

### LiveKit MCP Server

This project is configured with the **LiveKit Docs MCP Server**, which provides:
- Documentation browsing and search
- GitHub code search across LiveKit repositories
- Changelog access for LiveKit packages
- Python Agents SDK examples

**MCP Server URL**: https://docs.livekit.io/mcp

### When to Use LiveKit Docs

**Always consult LiveKit documentation when**:
1. Working with LiveKit voice agents (`agents/voice_agent.py`)
2. Implementing or debugging SIP telephony features
3. Configuring LiveKit Cloud deployment
4. Troubleshooting voice quality or connection issues
5. Adding new LiveKit features (participant tracking, recordings, etc.)
6. Updating LiveKit dependencies

### How to Access Documentation

The LiveKit MCP server is already configured in `openclaw.json`. When you need LiveKit documentation:

1. **Search the docs**:
   ```
   Use MCP tool: search_docs with query "voice agents python"
   ```

2. **Browse specific pages**:
   ```
   Use MCP tool: get_doc_page with path "/agents/quickstart"
   ```

3. **Find code examples**:
   ```
   Use MCP tool: search_github_code with query "function_tool"
   ```

4. **Check changelogs**:
   ```
   Use MCP tool: get_changelog with package "agents"
   ```

### Markdown Docs (Fallback)

If MCP is unavailable, access any LiveKit docs page in Markdown by appending `.md` to the URL:
- Example: https://docs.livekit.io/agents/quickstart.md

Complete index: https://docs.livekit.io/llms.txt

---

## Development Guidelines

### 1. **Cost Optimization is Critical**

The model router (T0-T3) saves 90%+ on LLM costs:
- **T0 (Ollama)**: Free - Use for simple routing, health checks
- **T1 (Haiku)**: $0.25/1M - Use for contact lookups, formatting
- **T2 (Sonnet)**: $3/1M - Use for conversations, task extraction
- **T3 (Opus)**: $15/1M - Use only for complex reasoning, errors

**Always**: Use the lowest tier that can handle the task. Let automatic escalation handle edge cases.

### 2. **LiveKit Best Practices**

When working with LiveKit voice agents:

- **Function Tools**: Use `@llm.ai_callable` decorator for LLM-callable functions
- **Session Management**: Use `AgentSession` for STT/LLM/TTS pipeline
- **Context Building**: Fetch contact context BEFORE starting session
- **Error Handling**: Gracefully handle LiveKit disconnections
- **Logging**: Use `logger.info()` for debugging voice flows

**Example**:
```python
@llm.ai_callable()
async def get_contact_info(phone_number: str):
    """Retrieve contact information from GoHighLevel CRM."""
    return await ghl_tools.lookup_contact(phone_number)
```

### 3. **GoHighLevel Integration**

Use the **official GHL SDK** (`@gohighlevel/api-client`):

```typescript
// Good - Use SDK
const client = await this.ghlAuth.getClient(locationId);
const contact = await client.contacts.get(contactId);

// Bad - Don't use raw HTTP
const response = await fetch(`https://api.gohighlevel.com/...`);
```

---

## GoHighLevel SDK Reference

This project includes both **Node.js** and **Python** GoHighLevel SDKs for CRM integration.

### Node.js SDK (`@gohighlevel/api-client`)

**Installed**: ✅ Added to `package.json`
**Version**: ^2.0.0
**Requires**: Node.js v18+

**Installation**:
```bash
pnpm install @gohighlevel/api-client
```

**Key Features**:
- ✅ **Automatic OAuth token handling** (refresh, rotation)
- ✅ **Type-safe API methods** for all HighLevel endpoints
- ✅ **Webhook middleware** for Express (signature validation, INSTALL/UNINSTALL events)
- ✅ **Storage adapters** (Redis, MongoDB, SQL) for production token persistence

**Usage Example**:
```typescript
import { Client } from '@gohighlevel/api-client';

// Initialize client with OAuth credentials
const client = new Client({
  clientId: process.env.GHL_CLIENT_ID,
  clientSecret: process.env.GHL_CLIENT_SECRET,
  accessToken: process.env.GHL_ACCESS_TOKEN
});

// Get contact information
const contact = await client.contacts.get({
  locationId: 'loc_xxx',
  contactId: 'contact_xxx'
});

// Create a task
const task = await client.tasks.create({
  locationId: 'loc_xxx',
  title: 'Follow up call',
  dueDate: '2026-02-15',
  assignedTo: 'user_xxx'
});
```

**Documentation**: https://marketplace.gohighlevel.com/docs/sdk/node/

---

### Python SDK (`gohighlevel-api-client`)

**Installed**: ✅ Added to `agents/requirements.txt`
**Version**: >=1.0.0
**Requires**: Python 3.8+

**Installation**:
```bash
cd agents
pip install -r requirements.txt
```

**Key Features**:
- ✅ **Async-first architecture** (built on `asyncio`)
- ✅ **Session storage** (in-memory for dev, Redis/MongoDB for production)
- ✅ **Webhook helpers** (signature validation, event handling)
- ✅ **Full API coverage** (contacts, campaigns, invoices, workflows, etc.)

**Usage Example**:
```python
import asyncio
from gohighlevel import Client

async def main():
    # Initialize async client
    client = Client(
        client_id=os.getenv('GHL_CLIENT_ID'),
        client_secret=os.getenv('GHL_CLIENT_SECRET'),
        access_token=os.getenv('GHL_ACCESS_TOKEN')
    )

    # Get contact information
    contact = await client.contacts.get(
        location_id='loc_xxx',
        contact_id='contact_xxx'
    )

    # Create opportunity
    opportunity = await client.opportunities.create(
        location_id='loc_xxx',
        name='New Lead from Voice Call',
        contact_id='contact_xxx',
        status='open'
    )

    await client.close()

# Run async code
asyncio.run(main())
```

**Documentation**: https://marketplace.gohighlevel.com/docs/sdk/python/

---

### When to Use Which SDK

| Context | SDK to Use | Reason |
|---------|-----------|--------|
| **OpenClaw plugins** (Node.js) | `@gohighlevel/api-client` | TypeScript/Node.js environment |
| **Voice agents** (Python) | `gohighlevel-api-client` | Python/LiveKit environment |
| **Webhook handlers** (Node.js) | `@gohighlevel/api-client` | Express middleware included |
| **Batch processing** (Python) | `gohighlevel-api-client` | Async batch operations |

### Environment Variables Required

Add to `.env`:
```bash
# GoHighLevel OAuth Credentials
GHL_CLIENT_ID=your_client_id_here
GHL_CLIENT_SECRET=your_client_secret_here
GHL_ACCESS_TOKEN=your_access_token_here
GHL_REFRESH_TOKEN=your_refresh_token_here
GHL_LOCATION_ID=your_location_id_here
```

Get credentials from: https://marketplace.gohighlevel.com/

---

## Resources

### Documentation
- **AIME Platform**: [AIME_README.md](AIME_README.md)
- **Setup Guide**: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Quick Reference**: [QUICK_REFERENCE.md](QUICK_REFERENCE.md)
- **LiveKit Setup**: [LIVEKIT_SETUP_STEPS.md](LIVEKIT_SETUP_STEPS.md)

### External Docs
- **LiveKit**: https://docs.livekit.io/ (via MCP)
- **LiveKit MCP**: https://docs.livekit.io/mcp
- **GHL SDK**: https://marketplace.gohighlevel.com/docs/sdk/node/
- **OpenClaw**: https://docs.openclaw.ai
- **Anthropic**: https://docs.anthropic.com

---

**Remember**: Always consult the latest LiveKit documentation via the MCP server when working with voice agents. The framework evolves quickly, and up-to-date docs ensure reliable, working code.
