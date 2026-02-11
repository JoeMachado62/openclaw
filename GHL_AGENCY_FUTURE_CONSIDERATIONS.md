# GoHighLevel Agency-Level Operations - Future Considerations

This document outlines future enhancements for scaling EZWAI_AIME to support agency-level operations with multiple locations, marketplace apps, and dynamic credential management.

---

## 🎯 Current State vs. Future Vision

### Current Implementation (v1)
- **Mode**: Single location with Private Integration Token
- **Scope**: Internal use, one GHL location
- **Credentials**: Static PIT_TOKEN + LOCATION_ID in `.env`
- **Suitable for**: Single business, internal operations

### Future Vision (v2+)
- **Mode**: Multi-location agency operations
- **Scope**: Multiple GHL locations, white-label marketplace apps
- **Credentials**: Dynamic credential management system
- **Suitable for**: Agencies managing multiple clients, SaaS products

---

## 📋 Future Use Cases

### 1. **Agency-Level AI Operative**

**Scenario:** EZWAI operates as an agency-level AI managing multiple client locations.

**Requirements:**
- Manage credentials for 10-100+ different GHL locations
- Route calls to correct location based on phone number or context
- Store per-location configuration (custom prompts, workflows, etc.)
- Track usage and billing per location

**Example Flow:**
```
Incoming Call: +1-305-555-0100
    ↓
1. Lookup phone number in routing table
2. Identify: Location ID = "loc_client_abc_123"
3. Fetch credentials for that location
4. Initialize GHL client with those credentials
5. Process call with location-specific context
```

### 2. **Marketplace Application**

**Scenario:** EZWAI becomes a public GoHighLevel marketplace app that users install.

**Requirements:**
- OAuth authorization flow for each new installation
- Store OAuth tokens per location (access + refresh tokens)
- Handle token refresh automatically
- Support webhook callbacks for INSTALL/UNINSTALL events
- Multi-tenant isolation (data separation between locations)

**Example Flow:**
```
User installs app from GHL Marketplace
    ↓
1. User clicks "Install" → Redirected to OAuth consent screen
2. User authorizes scopes → Callback with authorization code
3. Exchange code for access_token + refresh_token
4. Store tokens in database with location_id
5. App can now access that location's data
```

### 3. **Hybrid Model**

**Scenario:** Use Private Integration for your own operations + OAuth for client locations.

**Requirements:**
- Internal location uses PIT_TOKEN (simpler, no expiration)
- Client locations use OAuth (proper multi-tenant isolation)
- Credential management system handles both types
- Routing logic determines which auth method to use

---

## 🔧 Technical Architecture for Multi-Location Support

### Option A: Database-Backed Credential Store

**Stack:**
- **Database**: PostgreSQL or MongoDB
- **Schema**: Store credentials per location
- **Cache**: Redis for fast lookup

**Database Schema:**
```sql
CREATE TABLE ghl_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id VARCHAR(255) UNIQUE NOT NULL,
  auth_type VARCHAR(50) NOT NULL, -- 'pit' or 'oauth'

  -- For Private Integration
  pit_token TEXT,

  -- For OAuth
  client_id VARCHAR(255),
  client_secret VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,

  -- Metadata
  location_name VARCHAR(255),
  company_id VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Configuration
  config JSONB -- Custom settings per location
);

CREATE INDEX idx_ghl_creds_location ON ghl_credentials(location_id);
CREATE INDEX idx_ghl_creds_active ON ghl_credentials(is_active);
```

**Implementation:**
```typescript
// src/plugins/ghl/credential-manager.ts
export class GHLCredentialManager {
  private db: DatabaseClient;
  private cache: RedisClient;

  async getCredentials(locationId: string): Promise<GHLConfig> {
    // 1. Check Redis cache first
    const cached = await this.cache.get(`ghl:creds:${locationId}`);
    if (cached) return JSON.parse(cached);

    // 2. Fetch from database
    const creds = await this.db.query(
      'SELECT * FROM ghl_credentials WHERE location_id = $1 AND is_active = true',
      [locationId]
    );

    if (!creds.rows[0]) {
      throw new Error(`No credentials found for location ${locationId}`);
    }

    const config = this.mapToGHLConfig(creds.rows[0]);

    // 3. Cache for 5 minutes
    await this.cache.setex(`ghl:creds:${locationId}`, 300, JSON.stringify(config));

    return config;
  }

  async refreshOAuthToken(locationId: string): Promise<void> {
    const creds = await this.getCredentials(locationId);

    if (creds.authType !== 'oauth') return;

    // Refresh token logic
    const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      }),
    });

    const data = await response.json();

    // Update database
    await this.db.query(
      'UPDATE ghl_credentials SET access_token = $1, token_expires_at = $2, updated_at = NOW() WHERE location_id = $3',
      [data.access_token, new Date(Date.now() + data.expires_in * 1000), locationId]
    );

    // Invalidate cache
    await this.cache.del(`ghl:creds:${locationId}`);
  }

  async storeOAuthTokens(locationId: string, tokens: OAuthTokens): Promise<void> {
    await this.db.query(
      `INSERT INTO ghl_credentials (location_id, auth_type, access_token, refresh_token, token_expires_at)
       VALUES ($1, 'oauth', $2, $3, $4)
       ON CONFLICT (location_id) DO UPDATE SET
         access_token = $2, refresh_token = $3, token_expires_at = $4, updated_at = NOW()`,
      [locationId, tokens.access_token, tokens.refresh_token, new Date(Date.now() + tokens.expires_in * 1000)]
    );
  }
}
```

### Option B: Encrypted Configuration Files

**Stack:**
- **Storage**: Encrypted JSON files per location
- **Encryption**: AES-256 with master key in env
- **Cache**: In-memory cache

**File Structure:**
```
config/
  ghl/
    locations/
      loc_abc123.encrypted.json
      loc_xyz789.encrypted.json
    master.json  # Mapping of location_id to file
```

**Implementation:**
```typescript
// src/plugins/ghl/file-credential-store.ts
import crypto from 'crypto';
import fs from 'fs/promises';

export class FileCredentialStore {
  private masterKey: Buffer;
  private cache: Map<string, GHLConfig> = new Map();

  constructor(masterKey: string) {
    this.masterKey = Buffer.from(masterKey, 'hex');
  }

  async getCredentials(locationId: string): Promise<GHLConfig> {
    // Check cache
    if (this.cache.has(locationId)) {
      return this.cache.get(locationId)!;
    }

    // Read encrypted file
    const filePath = `config/ghl/locations/${locationId}.encrypted.json`;
    const encrypted = await fs.readFile(filePath, 'utf-8');

    // Decrypt
    const decrypted = this.decrypt(encrypted);
    const config = JSON.parse(decrypted);

    // Cache
    this.cache.set(locationId, config);

    return config;
  }

  async storeCredentials(locationId: string, config: GHLConfig): Promise<void> {
    const encrypted = this.encrypt(JSON.stringify(config));
    const filePath = `config/ghl/locations/${locationId}.encrypted.json`;
    await fs.writeFile(filePath, encrypted, 'utf-8');

    // Update cache
    this.cache.set(locationId, config);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
    let encrypted = cipher.update(text, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(text: string): string {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.masterKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
```

### Option C: Environment Variables with Prefixes

**For small-scale (2-10 locations):**

```bash
# Location 1 (Primary)
GHL_LOC1_ID=abc123
GHL_LOC1_PIT_TOKEN=token1
GHL_LOC1_NAME=Main Office

# Location 2 (Client A)
GHL_LOC2_ID=xyz789
GHL_LOC2_CLIENT_ID=client_id_2
GHL_LOC2_CLIENT_SECRET=secret_2
GHL_LOC2_ACCESS_TOKEN=token_2
GHL_LOC2_NAME=Client A

# Location 3 (Client B)
GHL_LOC3_ID=def456
GHL_LOC3_PIT_TOKEN=token3
GHL_LOC3_NAME=Client B
```

**Implementation:**
```typescript
export function loadMultiLocationConfig(): Map<string, GHLConfig> {
  const locations = new Map<string, GHLConfig>();

  // Parse environment variables
  const envKeys = Object.keys(process.env);
  const locationPrefixes = new Set(
    envKeys
      .filter(key => key.startsWith('GHL_LOC'))
      .map(key => key.match(/GHL_LOC\d+/)?.[0])
      .filter(Boolean)
  );

  for (const prefix of locationPrefixes) {
    const locationId = process.env[`${prefix}_ID`];
    if (!locationId) continue;

    const config: GHLConfig = {
      locationId,
      locationName: process.env[`${prefix}_NAME`] || locationId,
      pitToken: process.env[`${prefix}_PIT_TOKEN`],
      clientId: process.env[`${prefix}_CLIENT_ID`],
      clientSecret: process.env[`${prefix}_CLIENT_SECRET`],
      redirectUri: process.env[`${prefix}_REDIRECT_URI`],
    };

    locations.set(locationId, config);
  }

  return locations;
}
```

---

## 🔀 Phone Number Routing System

### Routing Table

**Database Schema:**
```sql
CREATE TABLE phone_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  location_id VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (location_id) REFERENCES ghl_credentials(location_id)
);

CREATE INDEX idx_phone_routing_number ON phone_routing(phone_number);
```

**Implementation:**
```typescript
// src/plugins/ghl/phone-router.ts
export class PhoneRouter {
  private db: DatabaseClient;
  private defaultLocationId: string;

  async getLocationForPhone(phoneNumber: string): Promise<string> {
    // Normalize phone number
    const normalized = this.normalizePhone(phoneNumber);

    // Lookup in routing table
    const result = await this.db.query(
      'SELECT location_id FROM phone_routing WHERE phone_number = $1 AND is_active = true',
      [normalized]
    );

    if (result.rows[0]) {
      return result.rows[0].location_id;
    }

    // Fallback to default location
    return this.defaultLocationId;
  }

  private normalizePhone(phone: string): string {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');

    // Add +1 if US/Canada number without country code
    if (digits.length === 10) {
      return '+1' + digits;
    } else if (digits.length === 11 && digits[0] === '1') {
      return '+' + digits;
    }

    return '+' + digits;
  }
}
```

---

## 🔐 Security Considerations

### 1. **Credential Encryption**
- **At Rest**: All tokens encrypted in database with AES-256
- **In Transit**: TLS 1.3 for all API calls
- **In Memory**: Clear sensitive data after use

### 2. **Access Control**
- **RBAC**: Role-based access control for multi-user systems
- **Audit Logging**: Log all credential access and API calls
- **Rate Limiting**: Per-location API rate limits

### 3. **Token Rotation**
- **OAuth Tokens**: Auto-refresh before expiration
- **PIT Tokens**: Manual rotation every 90 days
- **Backup Credentials**: Maintain emergency access tokens

### 4. **Compliance**
- **GDPR**: Data residency and deletion requirements
- **SOC 2**: Security controls and audit trails
- **HIPAA**: If handling health data

---

## 📊 Monitoring & Analytics

### Per-Location Metrics

```typescript
interface LocationMetrics {
  locationId: string;
  locationName: string;
  metrics: {
    totalCalls: number;
    totalMinutes: number;
    apiCallsToGHL: number;
    contactsCreated: number;
    opportunitiesCreated: number;
    tasksCreated: number;
    averageCallDuration: number;
    costPerCall: number;
  };
  period: {
    start: Date;
    end: Date;
  };
}
```

### Dashboard Features
- **Real-time**: Active calls per location
- **Historical**: Usage trends over time
- **Billing**: Cost tracking per location
- **Performance**: API latency and error rates

---

## 🚀 Migration Path

### Phase 1: Current (Single Location)
- ✅ Use Private Integration Token
- ✅ Single location in `.env`
- ✅ No database required

### Phase 2: Multi-Location (2-5 locations)
- Environment variable prefixes (`GHL_LOC1_`, `GHL_LOC2_`, etc.)
- Phone number routing table
- Simple credential lookup

### Phase 3: Agency Scale (5-50 locations)
- PostgreSQL credential store
- Redis caching layer
- Admin UI for credential management
- Per-location analytics

### Phase 4: Marketplace App (50+ locations)
- Full OAuth implementation
- Multi-tenant architecture
- Webhook event processing
- Self-service installation flow
- Usage-based billing

---

## 🎯 Recommended Next Steps

### Immediate (Now)
1. ✅ Keep both PIT and OAuth variables in `.env`
2. ✅ Document future considerations (this file)
3. Continue using PIT mode for initial development

### Near-term (Next 1-3 months)
1. **Add second location** using environment variable prefixes
2. **Implement phone routing** with simple lookup table
3. **Test OAuth flow** with a test marketplace app

### Mid-term (3-6 months)
1. **Build database credential store** with PostgreSQL
2. **Create admin UI** for managing locations
3. **Implement token refresh** automation
4. **Add per-location analytics**

### Long-term (6-12 months)
1. **Launch marketplace app** (if desired)
2. **Multi-tenant architecture** refactoring
3. **White-label customization** per location
4. **Advanced routing** (business hours, overflow, etc.)

---

## 📚 Additional Resources

### Code References
- **Current Integration**: `src/plugins/ghl/auth.ts`
- **Credential Loading**: `src/plugins/ghl/index.ts:264-298`
- **Contact Management**: `src/plugins/ghl/contacts.ts`

### External Documentation
- **GHL OAuth Guide**: https://highlevel.stoplight.io/docs/integrations/ZG9jOjEwMzgw-oauth
- **Marketplace Publishing**: https://marketplace.gohighlevel.com/docs/publishing
- **Multi-Location Best Practices**: https://help.gohighlevel.com/support/solutions/48000449614

---

## 💡 Key Takeaways

1. **Start Simple**: Current PIT mode is perfect for initial development
2. **Plan Ahead**: Keep OAuth variables ready for future expansion
3. **Incremental Growth**: Scale credential management as you add locations
4. **Security First**: Always encrypt credentials and audit access
5. **Monitor Everything**: Per-location metrics are essential for agencies

---

**Note**: This document should be revisited and updated as the project scales and requirements evolve.

**Last Updated**: 2026-02-11
**Status**: Planning Document
**Priority**: Low (Future Enhancement)
