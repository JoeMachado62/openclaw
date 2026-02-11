# GoHighLevel API V2 Configuration

This document confirms that all GoHighLevel integrations in this project are configured for **API Version 2**.

---

## ✅ Confirmed: API V2 is Active

### Test Results (2026-02-11)

Successfully tested and confirmed working with API V2:
- ✅ **Endpoint**: `https://services.leadconnectorhq.com/`
- ✅ **Authentication**: Private Integration Token (PIT)
- ✅ **Location**: EZWAi.com (`6LvSeUzOMEkQrC9oF5AI`)
- ✅ **Test Contact Created**: `ub7zIXZayjLqKwVPR0um`

---

## 🔧 Current Configuration

### 1. **Authentication (auth.ts)**

**File**: `src/plugins/ghl/auth.ts`

**OAuth Endpoints** (V2):
```typescript
// Line 36: Token exchange
'https://services.leadconnectorhq.com/oauth/token'

// Line 72: Token refresh
'https://services.leadconnectorhq.com/oauth/token'

// Line 144: Token revoke
'https://services.leadconnectorhq.com/oauth/revoke'
```

✅ **Status**: Already using V2 endpoints

---

### 2. **Contacts Module (contacts.ts)**

**File**: `src/plugins/ghl/contacts.ts`

**Configuration**:
```typescript
// Line 12: API Version
private apiVersion: string = '2021-07-28';

// Line 24-27: SDK Client initialization
return new Client({
  accessToken,
  version: this.apiVersion,
});
```

**SDK Usage**: Uses `@gohighlevel/api-client` which automatically routes to V2 endpoints.

✅ **Status**: Configured for V2

---

### 3. **Official SDK (@gohighlevel/api-client)**

**Package**: `@gohighlevel/api-client@^2.0.0`

**How it works**:
- The SDK automatically uses API V2 endpoints internally
- You provide the `version` parameter (2021-07-28)
- SDK handles the correct base URL (`services.leadconnectorhq.com`)

**Example Usage**:
```typescript
const client = new Client({
  accessToken: pitToken,
  version: '2021-07-28',
});

// This automatically calls:
// https://services.leadconnectorhq.com/contacts/
const contacts = await client.contacts.search({ locationId });
```

✅ **Status**: SDK configured for V2

---

## 📋 API Version Differences

### V1 API (Deprecated for some accounts)
```
Base URL: https://rest.gohighlevel.com/v1/
Example: https://rest.gohighlevel.com/v1/contacts/
Status: ❌ Not used in this project
```

### V2 API (Current - In Use)
```
Base URL: https://services.leadconnectorhq.com/
Example: https://services.leadconnectorhq.com/contacts/
Status: ✅ Active in this project
```

---

## 🔍 How to Verify

### Method 1: Run Test Script
```bash
node test-pit-v2.js
```

Should show:
```
✅ API V2 endpoint connectivity
✅ Private Integration Token authentication
✅ Location access verified
```

### Method 2: Check SDK Client
The `@gohighlevel/api-client` SDK version 2.x automatically uses V2 endpoints:

```typescript
import { Client } from '@gohighlevel/api-client';

const client = new Client({
  accessToken: process.env.GHL_PIT_TOKEN,
  version: '2021-07-28',  // This ensures V2 API usage
});
```

### Method 3: Monitor Network Calls
When the application runs, all GHL API calls should go to:
```
https://services.leadconnectorhq.com/*
```

NOT:
```
https://rest.gohighlevel.com/v1/*  ❌
```

---

## 🎯 Files Using GHL API

All files use the SDK which is configured for V2:

| File | Purpose | API Version |
|------|---------|-------------|
| `src/plugins/ghl/auth.ts` | OAuth & token management | V2 ✅ |
| `src/plugins/ghl/contacts.ts` | Contact CRUD operations | V2 ✅ |
| `src/plugins/ghl/conversations.ts` | Message & conversation access | V2 ✅ |
| `src/plugins/ghl/tasks.ts` | Task management | V2 ✅ |
| `src/plugins/ghl/webhooks.ts` | Webhook handling | N/A |
| `src/plugins/ghl/index.ts` | Main plugin entry | N/A |

---

## 🚨 Important Notes

### 1. **API Version Header**

All API calls include the version header:
```typescript
headers: {
  'Version': '2021-07-28',
  'Authorization': `Bearer ${token}`,
}
```

This is required for V2 API and is automatically added by the SDK.

### 2. **Private Integration Token**

Your PIT token is specifically generated for API V2:
```
GHL_PIT_TOKEN=pit-a4863d45-0f8b-4fc2-818a-6a6cf585438c
```

This token ONLY works with V2 endpoints.

### 3. **Base URL Changes**

If you ever need to make raw API calls (not using the SDK), always use:
```typescript
// ✅ CORRECT
const url = `https://services.leadconnectorhq.com/contacts/...`;

// ❌ WRONG
const url = `https://rest.gohighlevel.com/v1/contacts/...`;
```

---

## 🔧 Troubleshooting

### If you get "Switch to the new API token" error:

This means you're using V1 endpoints. Fix:
1. Update base URL to `services.leadconnectorhq.com`
2. Ensure SDK version is 2.x or higher
3. Check `version` parameter is set to `'2021-07-28'`

### If you get "Api key is invalid":

With V1 endpoint:
```
❌ https://rest.gohighlevel.com/v1/contacts/
→ Error: "Api key is invalid"
```

With V2 endpoint:
```
✅ https://services.leadconnectorhq.com/contacts/
→ Success: 200 OK
```

---

## 📚 References

### Official Documentation
- **V2 API Docs**: https://highlevel.stoplight.io/
- **SDK GitHub**: https://github.com/gohighlevel/gohighlevel-node-sdk
- **Marketplace**: https://marketplace.gohighlevel.com/

### Test Files
- `test-pit-v2.js` - V2 API test script
- `test-pit-only.js` - Step-by-step test
- `test-token-debug.js` - Debug different API versions

---

## ✅ Summary

**Current Status**: All GHL integrations are correctly configured for API V2.

**What's Configured**:
- ✅ OAuth endpoints using V2 (`services.leadconnectorhq.com`)
- ✅ SDK client configured with `version: '2021-07-28'`
- ✅ Private Integration Token valid for V2
- ✅ All API calls routed through SDK to V2 endpoints

**No Action Needed**: The codebase is already using API V2 correctly.

**Last Verified**: 2026-02-11
**Test Status**: ✅ All tests passing with V2 API
