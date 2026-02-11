# GoHighLevel Credentials Setup Guide

This guide will help you obtain all the necessary GoHighLevel credentials for your AIME platform.

---

## 🎯 Which Mode Do You Need?

GoHighLevel integration supports **two modes**:

### ⭐ **Private Integration** (Recommended for EZWAI_AIME)
**Best for:** Internal use, single location, simpler setup
**Credentials needed:**
```bash
GHL_PIT_TOKEN=your_private_integration_token_here     # ✅ Required
GHL_LOCATION_ID=your_location_id_here                 # ✅ Required
GHL_WEBHOOK_SECRET=your_webhook_secret_here           # ⚠️ Optional (only for webhooks)
```

### 🏪 **OAuth App** (For Marketplace Apps)
**Best for:** Public marketplace apps, multi-tenant, multiple locations
**Credentials needed:**
```bash
GHL_CLIENT_ID=your_client_id_here                     # ✅ Required
GHL_CLIENT_SECRET=your_client_secret_here             # ✅ Required
GHL_REDIRECT_URI=http://localhost:3000/auth/ghl/callback  # ✅ Required
GHL_ACCESS_TOKEN=generated_after_oauth_flow           # Auto-generated
GHL_REFRESH_TOKEN=generated_after_oauth_flow          # Auto-generated
```

**For this project, use Private Integration** - it's simpler and sufficient for internal use!

---

## 📋 Quick Start: Private Integration (Recommended)

Follow these steps to set up Private Integration mode:

### Step 1: Get Your Private Integration Token

1. **Go to**: https://marketplace.gohighlevel.com/
2. **Login** with your GoHighLevel account
3. **Navigate to**: "My Apps" or "Developer" section
4. **Create or select** your Private Integration app
5. **Go to**: "API Keys" or "Private Integration Token" section
6. **Click**: "Generate Token" or "Create API Key"
7. **Select scopes/permissions**:
   - ✅ `contacts.readonly` + `contacts.write`
   - ✅ `conversations.readonly` + `conversations.write`
   - ✅ `opportunities.readonly` + `opportunities.write`
   - ✅ `calendars.readonly`
   - ✅ `workflows.readonly`
8. **Copy the token immediately** (shown only once!)

### Step 2: Get Your Location ID

#### Method A: From GoHighLevel Dashboard URL

1. Login to: https://app.gohighlevel.com/
2. Look at the URL when viewing your location:
   ```
   https://app.gohighlevel.com/location/[LOCATION_ID]/dashboard
   ```
3. The `LOCATION_ID` is the alphanumeric string in the URL
4. Copy this value

#### Method B: Using the API (After Step 1)

```bash
curl -X GET "https://rest.gohighlevel.com/v1/locations" \
  -H "Authorization: Bearer YOUR_PIT_TOKEN"
```

### Step 3: Update Your .env File

```bash
# GoHighLevel Configuration - PRIVATE INTEGRATION MODE
GHL_PIT_TOKEN=pit_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GHL_LOCATION_ID=abc123xyz456

# Optional: Only if using webhooks
# GHL_WEBHOOK_SECRET=your_webhook_secret_here
```

### Step 4: Test Your Setup

```bash
cd "c:\Users\buyaf\OneDrive\Documents\EZWAI_AIME\EZWAi_Aime"
pnpm start

# Look for this in the logs:
# [GHL Plugin] Using Private Integration Token mode
# [GHL Plugin] Initialization complete
```

**That's it! You're done!** ✅

---

## 📋 Advanced: OAuth App Mode

Only follow this section if you need OAuth mode for a marketplace app.

---

## 📋 Step-by-Step Instructions

### Step 1: Access GoHighLevel Marketplace

1. **Go to**: https://marketplace.gohighlevel.com/
2. **Login** with your GoHighLevel account credentials
3. **Navigate to**: "My Apps" or "Developer" section

---

### Step 2: Create/Access Your App

#### If you don't have an app yet:

1. Click **"Create New App"** or **"New Private Integration"**
2. Fill in app details:
   - **App Name**: `AIME Voice Agent` (or your preferred name)
   - **Description**: `AI-powered voice agent with CRM integration`
   - **App Type**: Choose **"Private Integration"** for internal use
   - **Redirect URI**: `http://localhost:3000/auth/ghl/callback`

3. Click **"Create App"**

#### If you already have an app:

1. Find your app in **"My Apps"** list
2. Click on the app name to open settings

---

### Step 3: Get CLIENT_SECRET

1. In your app settings, find the **"Credentials"** or **"API Credentials"** section
2. You should see:
   - **Client ID**: `6LvSeUzOMEkQrC9oF5AI` (you already have this)
   - **Client Secret**: Click **"Show"** or **"Reveal"** to display it

3. **Copy the Client Secret** and update your `.env`:
   ```bash
   GHL_CLIENT_SECRET=paste_your_secret_here
   ```

**⚠️ Security Note**: Never commit this secret to version control!

---

### Step 4: Get WEBHOOK_SECRET

1. In your app settings, go to **"Webhooks"** section
2. Look for **"Webhook Secret"** or **"Signing Secret"**
3. If you don't see one, you may need to:
   - Enable webhooks for your app
   - Click **"Generate Webhook Secret"**

4. **Copy the Webhook Secret** and update your `.env`:
   ```bash
   GHL_WEBHOOK_SECRET=paste_your_webhook_secret_here
   ```

**Note**: This is used to verify webhook signatures from GoHighLevel.

---

### Step 5: Get PRIVATE INTEGRATION TOKEN (PIT)

#### For Private Integrations:

1. In your app settings, look for **"Private Integration Token"** or **"API Key"**
2. If you don't have one:
   - Click **"Generate Token"** or **"Create API Key"**
   - Select the **scopes/permissions** your app needs:
     - ✅ `contacts.readonly` - Read contacts
     - ✅ `contacts.write` - Create/update contacts
     - ✅ `conversations.readonly` - Read conversations
     - ✅ `conversations.write` - Send messages
     - ✅ `opportunities.readonly` - Read opportunities
     - ✅ `opportunities.write` - Create opportunities
     - ✅ `calendars.readonly` - Read calendars
     - ✅ `workflows.readonly` - Read workflows

3. **Copy the token** and update your `.env`:
   ```bash
   GHL_PIT_TOKEN=paste_your_pit_token_here
   ```

**⚠️ Important**: Save this token immediately - it may only be shown once!

---

### Step 6: Get LOCATION_ID (Optional but Recommended)

Your Location ID identifies which GoHighLevel sub-account to use.

#### Method 1: From GoHighLevel Dashboard

1. Login to your GoHighLevel account: https://app.gohighlevel.com/
2. Look at the URL when viewing your location:
   ```
   https://app.gohighlevel.com/location/[LOCATION_ID]/dashboard
   ```
3. The `LOCATION_ID` is the alphanumeric string in the URL

#### Method 2: Using the API

Once you have your other credentials working, you can list locations:

```bash
# Using curl (replace with your credentials)
curl -X GET "https://rest.gohighlevel.com/v1/locations" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

4. **Update your `.env`**:
   ```bash
   GHL_LOCATION_ID=paste_your_location_id_here
   ```

---

### Step 7: Generate ACCESS_TOKEN and REFRESH_TOKEN

These tokens are generated through the OAuth flow. You have two options:

#### Option A: Use OAuth Flow (Recommended for Production)

1. Start your OpenClaw server:
   ```bash
   pnpm start
   ```

2. Visit the OAuth authorization URL in your browser:
   ```
   http://localhost:3000/auth/ghl/authorize
   ```

3. You'll be redirected to GoHighLevel to authorize the app
4. After authorization, you'll be redirected back to your app
5. The tokens will be automatically saved to your session storage

#### Option B: Use Private Integration Token (Simpler for Development)

If you're using a **Private Integration**, you can use the PIT token directly:

```bash
# In your .env, you can use the PIT token as the access token
GHL_ACCESS_TOKEN=your_pit_token_here
GHL_REFRESH_TOKEN=not_needed_for_private_integration
```

---

## 🔐 Final .env Configuration

After completing all steps, your `.env` should look like this:

```bash
# GoHighLevel Configuration
GHL_CLIENT_ID=6LvSeUzOMEkQrC9oF5AI
GHL_CLIENT_SECRET=abc123xyz789secrethere
GHL_WEBHOOK_SECRET=webhook_secret_abc123xyz
GHL_PIT_TOKEN=pit_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
GHL_REDIRECT_URI=http://localhost:3000/auth/ghl/callback
GHL_LOCATION_ID=your_location_id_abc123
GHL_ACCESS_TOKEN=your_access_token_or_pit_token
GHL_REFRESH_TOKEN=your_refresh_token_if_using_oauth
```

---

## ✅ Verify Your Credentials

Test your credentials with this quick script:

### Node.js Test:

```bash
cd "c:\Users\buyaf\OneDrive\Documents\EZWAI_AIME\EZWAi_Aime"
node -e "
const { Client } = require('@gohighlevel/api-client');
require('dotenv').config();

const client = new Client({
  clientId: process.env.GHL_CLIENT_ID,
  clientSecret: process.env.GHL_CLIENT_SECRET,
  accessToken: process.env.GHL_ACCESS_TOKEN
});

console.log('✅ GoHighLevel SDK initialized successfully!');
"
```

### Python Test:

```bash
cd "c:\Users\buyaf\OneDrive\Documents\EZWAI_AIME\EZWAi_Aime\agents"
python -c "
import os
from dotenv import load_dotenv
load_dotenv('../.env')

client_id = os.getenv('GHL_CLIENT_ID')
client_secret = os.getenv('GHL_CLIENT_SECRET')
access_token = os.getenv('GHL_ACCESS_TOKEN')

if client_id and client_secret and access_token:
    print('✅ All GHL credentials loaded successfully!')
else:
    print('❌ Missing credentials:', {
        'CLIENT_ID': bool(client_id),
        'CLIENT_SECRET': bool(client_secret),
        'ACCESS_TOKEN': bool(access_token)
    })
"
```

---

## 🆘 Troubleshooting

### "Can't find my app in GoHighLevel Marketplace"

- Make sure you're logged into the correct GoHighLevel account
- Check if you have developer/admin permissions
- Try creating a new Private Integration

### "Client Secret not showing"

- Look for a **"Show"**, **"Reveal"**, or **"Regenerate"** button
- You may need to regenerate the secret if it was created a long time ago
- Contact GoHighLevel support if you can't access it

### "Webhook Secret doesn't exist"

- Enable webhooks in your app settings first
- You may need to configure at least one webhook endpoint
- For development, you can use a placeholder and generate a real one later

### "PIT Token only shown once"

- If you lost your PIT token, you can regenerate it
- Go to app settings → API Keys → Regenerate Token
- **Save the new token immediately!**

### "OAuth flow fails"

- Verify `GHL_REDIRECT_URI` matches exactly in:
  - Your `.env` file
  - Your app settings on GoHighLevel Marketplace
- Make sure your local server is running on the correct port
- Check that you've granted all necessary scopes/permissions

---

## 📚 Additional Resources

- **GoHighLevel Marketplace**: https://marketplace.gohighlevel.com/
- **GHL API Documentation**: https://highlevel.stoplight.io/
- **Node.js SDK Docs**: https://marketplace.gohighlevel.com/docs/sdk/node/
- **Python SDK Docs**: https://marketplace.gohighlevel.com/docs/sdk/python/
- **Support**: Contact GoHighLevel support if you need help accessing credentials

---

## 🔒 Security Best Practices

1. **Never commit credentials to git**
   - `.env` is already in `.gitignore`
   - Double-check before pushing code

2. **Use environment-specific credentials**
   - Development: Use Private Integration tokens
   - Production: Use OAuth flow with proper token storage

3. **Rotate credentials regularly**
   - Regenerate secrets every 90 days
   - Update tokens immediately if compromised

4. **Store production tokens securely**
   - Use Redis, MongoDB, or encrypted storage
   - Never store in plain text files in production

---

**Need more help?** Check [QUICK_REFERENCE.md](QUICK_REFERENCE.md) or [AIME_AGENTS.md](AIME_AGENTS.md) for additional guidance.
