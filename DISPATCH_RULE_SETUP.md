# 🎯 LiveKit Dispatch Rule Setup (5 minutes)

## What is a Dispatch Rule?

A dispatch rule tells LiveKit which voice agent should handle incoming/outbound SIP calls from your trunk. Without it, calls are created but not answered by your agent.

---

## Quick Setup Steps

### Step 1: Access LiveKit Dashboard
1. Go to: https://cloud.livekit.io/
2. Sign in with: buyaford4lesstoday@gmail.com
3. Select project: **AIME Voice Agent**

### Step 2: Navigate to Dispatch Rules
1. Click: **Telephony** in the left sidebar
2. Click: **Dispatch Rules**

### Step 3: Create or Edit Rule

#### If You See "AIME Voice Agent" Rule:
1. Click on the existing rule
2. Click **Edit**
3. Verify/update settings (see below)
4. Click **Save**

#### If No Rule Exists:
1. Click **Create Dispatch Rule**
2. Fill in the form (see settings below)
3. Click **Create**

---

## Dispatch Rule Settings

### Basic Settings:
- **Rule Name**: AIME Voice Agent
- **Description**: Routes SIP calls to AIME voice agent

### SIP Configuration:
- **Rule Type**: SIP Trunk
- **Direction**: Both Inbound and Outbound (or select both)
  - ✅ Inbound
  - ✅ Outbound

### Trunk Association:
Select your SIP trunks:
- ✅ **EZWAI AIME Assistant** (ST_H2LHUVjBJh8u) - Outbound trunk
- ✅ **EZWAI AIME Inbound** (ST_fR8Ls9A2GRtW) - Inbound trunk

### Agent Dispatch:
- **Target Agent**: aime-voice-agent
- **Match exactly**: Yes (case-sensitive)

### Room Settings (Optional):
- **Room Prefix**: (leave blank, or use "aime-")
- **Participant Identity**: (leave default)

---

## Visual Reference

Your dispatch rule should look like this:

```
Rule Name: AIME Voice Agent
Type: SIP Trunk
Direction: Inbound + Outbound

Associated Trunks:
├─ EZWAI AIME Inbound (ST_fR8Ls9A2GRtW)
└─ EZWAI AIME Assistant (ST_H2LHUVjBJh8u)

Target Agent: aime-voice-agent
```

---

## Verification

After saving the dispatch rule:

### Test 1: Inbound Call
```
Call: +1 (305) 952-1569
Expected: Sarah answers and greets you
```

### Test 2: Outbound Call
```powershell
cd c:\Users\buyaf\OneDrive\Documents\EZWAI_AIME\EZWAi_Aime\agents
python test_outbound_call.py
```
**Expected**: You receive a call from Sarah, she leaves a voicemail

---

## Troubleshooting

### Problem: "No agent name specified"
**Solution**: Make sure **Target Agent** is set to: `aime-voice-agent` (exact match, case-sensitive)

### Problem: "SIP trunk not found"
**Solution**: Verify trunk IDs:
- Outbound: ST_H2LHUVjBJh8u
- Inbound: ST_fR8Ls9A2GRtW

### Problem: Calls still not connecting
**Check**:
1. Voice agent is running (check logs):
   ```powershell
   # If not running, start it:
   cd c:\Users\buyaf\OneDrive\Documents\EZWAI_AIME\EZWAi_Aime\agents
   python voice_agent.py start
   ```

2. Agent registered with LiveKit:
   - Look for log line: `registered worker` with agent_name: aime-voice-agent
   - Worker should have an ID like: AW_yuykthBdm2TP

---

## That's It!

Once the dispatch rule is saved, your system is fully functional:
- ✅ Inbound calls to +1 (305) 952-1569 answered by Sarah
- ✅ Outbound calls can be initiated programmatically
- ✅ Full conversation support with multilingual detection
- ✅ Inworld TTS for cost-effective, high-quality voice

---

## Next: Test It!

See [MORNING_SUMMARY.md](MORNING_SUMMARY.md) for complete testing instructions.
