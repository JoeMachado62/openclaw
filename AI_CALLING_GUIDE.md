# 🤖 AI-Powered Natural Language Calling

**NEW FEATURE**: Make outbound calls using natural language instructions via Telegram or API!

---

## 🎯 What This Does

Instead of manually configuring call parameters, just tell the AI what you want in plain English:

**You say:**
> "Call JC Lopez at 786-731-8794 and ask if he's available for lunch today to meet with Joe Machado at Chili's on Kendall Drive. Notify me via text at 305-555-1234."

**The AI:**
1. ✅ Parses your instruction using Claude
2. ✅ Extracts phone number, contact info, and task
3. ✅ Generates custom script for the voice agent
4. ✅ Initiates the outbound call
5. ✅ Sends you the result via SMS/Telegram

---

## 📞 How It Works

```
You (Telegram) → AIME Server → Claude (parse instruction)
                                    ↓
                            Voice Agent (make call)
                                    ↓
                            Call Completed
                                    ↓
                            Notify you with results
```

---

## 🚀 Usage Examples

### Example 1: Simple Availability Check
```
Call Sarah Johnson at +14155551234 and ask if she's available
for a meeting tomorrow at 2 PM. Let me know via text.
```

**What happens:**
- Agent calls Sarah
- "Hi Sarah, this is an AI assistant calling on behalf of [Your Name]"
- "I'm calling to check if you're available for a meeting tomorrow at 2 PM?"
- Agent waits for response
- Reports back: "Sarah confirmed she's available tomorrow at 2 PM"

### Example 2: RSVP Confirmation
```
Call Mike Chen at 305-555-9876 and confirm if he's coming to the
team dinner on Friday at 7 PM at Ocean Grill. Notify me on Telegram.
```

**What happens:**
- Agent calls Mike
- Asks about Friday dinner
- Gets confirmation
- Sends Telegram message: "Mike confirmed - he'll be there Friday 7 PM"

### Example 3: Information Gathering
```
Call Dr. Martinez at 786-555-4321 and ask what documents I need
to bring for my appointment next week. Text me the list.
```

**What happens:**
- Agent calls doctor's office
- Asks about required documents
- Agent lists documents needed
- Sends you SMS with the list

### Example 4: Follow-up Task
```
Call James at +17865551234 and remind him to send the proposal
by end of day. If he needs more time, ask when he can deliver it.
Notify me via Telegram.
```

**What happens:**
- Agent calls James
- Polite reminder about proposal
- If delayed, asks for new deadline
- Reports back with commitment

---

## 🔌 API Usage

### Endpoint: `/api/calls/ai-initiate`

**Request:**
```bash
curl -X POST http://localhost:3000/api/calls/ai-initiate \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Call JC Lopez at 786-731-8794 and ask if hes available for lunch today with Joe Machado at Chilis on Kendall Drive. Notify me via text at 305-555-1234.",
    "userId": "your_telegram_id",
    "userName": "Joe Machado"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Calling JC Lopez...",
  "details": {
    "contactName": "JC Lopez",
    "phoneNumber": "+17867318794",
    "instructions": "Ask if he's available for lunch today to meet with Joe Machado at Chili's on Kendall Drive",
    "roomName": "aime-ai-call-1739212345",
    "callId": "SI_abc123xyz",
    "monitorUrl": "https://cloud.livekit.io/..."
  },
  "notification": "You'll receive the result via SMS at +13055551234"
}
```

---

## 🎤 What the Voice Agent Says

The AI generates a custom script based on your instruction. Example:

**Agent's Script:**
```
"Hi JC, this is an AI assistant calling on behalf of Joe Machado.

I'm calling to check if you're available for lunch today to meet
with Joe at Chili's on Kendall Drive?

[Waits for response]

Great! So to confirm, you're available for lunch today at Chili's
on Kendall Drive with Joe Machado?

[Confirms]

Perfect! I'll let Joe know. Thanks for your time, JC. Have a great day!"
```

**Key Features:**
- ✅ Professional and polite
- ✅ Identifies itself as an AI
- ✅ States purpose immediately
- ✅ Confirms understanding
- ✅ Thanks and ends call

---

## 📱 Notification Examples

### SMS Notification
```
Call with JC Lopez completed!

Outcome: JC confirmed he's available for lunch today
at Chili's on Kendall Drive at 12:30 PM.

Duration: 1m 45s
```

### Telegram Notification
```
✅ Call Completed

Contact: JC Lopez
Duration: 1m 45s

Result: Available for lunch at 12:30 PM today at
Chili's on Kendall Drive.

Next steps: Meet at Chili's, Kendall Drive at 12:30 PM
```

---

## 🛠️ Setup Requirements

### 1. Environment Variables

Add to your `.env` file:

```env
# Required: Anthropic API key for parsing instructions
ANTHROPIC_API_KEY=sk-ant-api03-...

# Optional: Default GHL location
DEFAULT_GHL_LOCATION_ID=your_location_id

# Optional: Telegram bot token (for Telegram notifications)
TELEGRAM_BOT_TOKEN=your_bot_token

# Optional: Twilio credentials (for SMS notifications)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1...
```

### 2. Telegram Integration (Optional)

If you want to trigger calls from Telegram:

```typescript
// In your Telegram bot handler
bot.on('message', async (msg) => {
  const instruction = msg.text;

  const response = await fetch('http://localhost:3000/api/calls/ai-initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instruction: instruction,
      userId: msg.from.id,
      userName: msg.from.first_name,
    }),
  });

  const result = await response.json();
  bot.sendMessage(msg.chat.id, result.message);
});
```

### 3. SMS Notifications (Optional)

To enable SMS notifications, add Twilio integration:

```typescript
import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function sendSMS(to: string, message: string) {
  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: to,
  });
}
```

---

## 📝 Natural Language Tips

### ✅ Good Instructions
- "Call [Name] at [Phone] and ask [Question]. Notify me via [Method]."
- "Reach out to [Name] at [Phone] about [Topic]. Let me know the outcome."
- "Contact [Name] at [Phone] to confirm [Event]. Send results to [Your Phone]."

### ❌ Avoid
- Too vague: "Call someone" (Who? What number?)
- Missing context: "Ask about the thing" (What thing?)
- No notification: Agent won't know how to report back

### 💡 Pro Tips
1. **Always include phone number** - The AI can't look up numbers (yet)
2. **Be specific about the ask** - "Check availability" vs "Ask if they're free"
3. **Specify notification method** - "text me" or "notify me on Telegram"
4. **Keep it concise** - The agent will summarize, not read a script verbatim

---

## 🧪 Testing

### Test the Parsing (Without Making a Call)

You can test just the instruction parsing:

```bash
curl -X POST http://localhost:3000/api/calls/parse-instruction \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Call John at 555-1234 and ask about the meeting"
  }'
```

**Response:**
```json
{
  "phoneNumber": "+15551234",
  "contactName": "John",
  "instructions": "Ask about the meeting",
  "expectedOutcome": "Find out about the meeting status"
}
```

### Test End-to-End

1. Start AIME server: `npx pnpm run dev`
2. Start voice agent: `python agents/voice_agent.py start`
3. Send test instruction:

```bash
curl -X POST http://localhost:3000/api/calls/ai-initiate \
  -H "Content-Type: application/json" \
  -d '{
    "instruction": "Call 555-1234 and say this is a test call. Hang up after 10 seconds."
  }'
```

---

## 🔍 Monitoring

### Check Call Status

```bash
curl http://localhost:3000/api/calls/status/aime-ai-call-1739212345
```

### View Call History

All AI-initiated calls are logged in the contact memory with type `ai_call`:

```bash
curl http://localhost:3000/api/memory/search?q=ai_call
```

---

## 🚨 Error Handling

### Common Errors

**"Phone number must be in E.164 format"**
- Solution: Include country code (+1 for US)
- Example: Use "+17865551234" not "786-555-1234"

**"SIP trunk not configured"**
- Solution: Set `LIVEKIT_SIP_TRUNK_ID` in .env
- See: [NEXT_STEPS.md](NEXT_STEPS.md) Step 3

**"Failed to parse call instruction"**
- Solution: Be more explicit in your instruction
- Include: Who to call, phone number, what to ask, how to notify

---

## 💰 Cost Considerations (LiveKit Pricing Calculator)

### Option 1: ElevenLabs TTS (Premium Quality)
Each AI-initiated call (3-minute average) costs:
- **Instruction Parsing**: ~$0.01 (Claude Sonnet 4.5)
- **Voice Call**: $0.41 (LiveKit: $0.1369/min × 3 min)
  - Deepgram Nova-3 STT
  - GPT-5.2 Chat Latest LLM
  - ElevenLabs Flash v2.5 TTS
- **Notification**: $0.01 (Twilio SMS) or Free (Telegram)

**Total per call**: ~$0.43

**Cost per month** (100 hours = ~2,000 calls):
- Parsing: $20
- Calls: $821 (100 hours × 60 min × $0.1369/min)
- Notifications: $20 (SMS) or $0 (Telegram)
- **Total**: ~$861/month

### Option 2: Inworld TTS (Cost-Effective, Recommended)
Each AI-initiated call (3-minute average) costs:
- **Instruction Parsing**: ~$0.01 (Claude Sonnet 4.5)
- **Voice Call**: $0.17 (LiveKit: ~$0.056/min estimated × 3 min)
  - Deepgram Nova-3 STT
  - GPT-5.2 Chat Latest LLM
  - Inworld TTS 1.5 (20-25x cheaper than ElevenLabs)
- **Notification**: $0.01 (Twilio SMS) or Free (Telegram)

**Total per call**: ~$0.19

**Cost per month** (100 hours = ~2,000 calls):
- Parsing: $20
- Calls: $336 (estimated, 20-25x cheaper TTS)
- Notifications: $20 (SMS) or $0 (Telegram)
- **Total**: ~$376/month

**Cost Savings**: Inworld TTS saves ~$485/month (56% reduction) vs ElevenLabs

---

## 🎯 Use Cases

### Personal Assistant
- "Call the dentist and confirm my appointment for Friday"
- "Check if mom needs anything from the grocery store"
- "Ask Sarah if she got my email about the project"

### Business
- "Follow up with leads who haven't responded in 3 days"
- "Confirm all Friday meeting attendees"
- "Check inventory status with supplier"

### Event Planning
- "Call all RSVP pending guests and get final headcount"
- "Confirm catering order for Saturday"
- "Check with venue about setup time"

### Customer Service
- "Call customers who left 1-star reviews and offer resolution"
- "Check in with clients about their onboarding experience"
- "Gather feedback from recent purchases"

---

## 🔐 Privacy & Security

**Important Notes:**
- All calls are transcribed and stored
- Transcripts include personal information
- Ensure compliance with call recording laws
- Always inform contacts they're speaking with an AI
- Use secure channels for notifications

**Best Practices:**
- Only call people who've consented
- Be transparent about AI usage
- Protect notification phone numbers
- Delete transcripts after a reasonable period

---

## 🚀 Next Steps

1. **Test with a friend**: Call your own number first to hear how it sounds
2. **Refine instructions**: Experiment with different phrasings
3. **Set up notifications**: Configure SMS or Telegram
4. **Integrate with workflows**: Connect to your existing systems
5. **Monitor and optimize**: Review transcripts to improve prompts

---

## 📚 Related Documentation

- [NEXT_STEPS.md](NEXT_STEPS.md) - Initial setup
- [COMPLETE_SETUP_GUIDE.md](COMPLETE_SETUP_GUIDE.md) - Full platform guide
- [Plan file](C:\Users\buyaf\.claude\plans\steady-cooking-adleman.md) - Technical details

---

**Ready to make your first AI call?** 🎉

Just send:
```
Call yourself at [your number] and say "This is a test from AIME AI calling system. If you can hear this, it's working!"
```
