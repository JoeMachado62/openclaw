# Claude Agent Instructions

This file provides instructions for AI agents (like Claude) working on the AIME platform.

## Quick Start

Read **[AIME_AGENTS.md](AIME_AGENTS.md)** first - it contains comprehensive instructions for AI agents working on this project.

## Key Documentation Files

### For AI Agents
- **[AIME_AGENTS.md](AIME_AGENTS.md)** - Complete agent instructions
  - LiveKit MCP server usage
  - Development guidelines
  - Cost optimization strategies
  - GoHighLevel SDK reference (Node.js + Python)

### For Setup & Reference
- **[DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)** - Complete documentation index
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - One-page command reference
- **[AIME_README.md](AIME_README.md)** - Platform overview

## Project Context

**AIME** (AI-powered Multi-channel Engagement) is a voice agent platform built on:
- OpenClaw (multi-channel AI gateway)
- LiveKit (real-time voice communication)
- GoHighLevel (CRM integration)
- Claude Sonnet 4.5 (LLM with T0-T3 cost routing)

## Available SDKs

### GoHighLevel Integration

This project includes **both Node.js and Python SDKs** for GoHighLevel CRM:

1. **Node.js SDK**: `@gohighlevel/api-client` (in `package.json`)
   - For OpenClaw plugins and Node.js services
   - Full OAuth automation, webhook middleware
   - Docs: https://marketplace.gohighlevel.com/docs/sdk/node/

2. **Python SDK**: `gohighlevel-api-client` (in `agents/requirements.txt`)
   - For LiveKit voice agents
   - Async-first, perfect for real-time agents
   - Docs: https://marketplace.gohighlevel.com/docs/sdk/python/

See [AIME_AGENTS.md](AIME_AGENTS.md#gohighlevel-sdk-reference) for detailed usage examples.

## Important Guidelines

1. **Always use LiveKit MCP server** for LiveKit documentation
2. **Use lowest cost model tier** that can handle the task (T0→T3)
3. **Use official GHL SDKs** - never raw HTTP calls
4. **Consult AIME_AGENTS.md** for best practices

## Getting Started

```bash
# 1. Read agent instructions
cat AIME_AGENTS.md

# 2. Install dependencies
pnpm install                    # Install Node.js packages (including GHL SDK)
cd agents && pip install -r requirements.txt  # Install Python packages (including GHL SDK)

# 3. Configure environment
cp .env.example .env
# Add API keys for: GHL, LiveKit, Anthropic, Deepgram, etc.

# 4. Start services
pnpm start                      # Start OpenClaw gateway
cd agents && python voice_agent.py  # Start voice agent
```

See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for all commands.

---

**For complete agent instructions, see [AIME_AGENTS.md](AIME_AGENTS.md)**
