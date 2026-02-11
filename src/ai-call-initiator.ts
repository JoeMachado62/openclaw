/**
 * AI-Powered Call Initiator
 * Accepts natural language instructions and initiates outbound calls
 */

import Anthropic from '@anthropic-ai/sdk';

interface ParsedCallInstruction {
  phoneNumber: string;
  contactName: string;
  instructions: string;
  notificationPhone?: string;
  notificationMethod?: 'sms' | 'telegram';
  expectedOutcome?: string;
}

export class AICallInitiator {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Parse natural language call instruction into structured data
   */
  async parseCallInstruction(instruction: string): Promise<ParsedCallInstruction> {
    const prompt = `You are an AI assistant that parses call instructions into structured data.

Given a natural language instruction to make a phone call, extract:
1. Phone number to call (in E.164 format if possible, e.g., +17867318794)
2. Contact name
3. The specific instructions/questions for the AI agent
4. Phone number for notifications (if mentioned)
5. Expected outcome/what to report back

Instruction: "${instruction}"

Respond with JSON only:
{
  "phoneNumber": "+1...",
  "contactName": "Name",
  "instructions": "Detailed instructions for the AI agent",
  "notificationPhone": "+1..." (if mentioned, otherwise null),
  "notificationMethod": "sms" or "telegram" (if mentioned),
  "expectedOutcome": "What outcome to report"
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4.5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse call instruction');
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedCallInstruction;

    // Validate phone number format
    if (!parsed.phoneNumber.startsWith('+')) {
      // Try to add +1 if it looks like a US number
      if (parsed.phoneNumber.replace(/\D/g, '').length === 10) {
        parsed.phoneNumber = '+1' + parsed.phoneNumber.replace(/\D/g, '');
      } else {
        throw new Error('Phone number must be in E.164 format (e.g., +17867318794)');
      }
    }

    return parsed;
  }

  /**
   * Generate custom system prompt for the voice agent based on instructions
   */
  generateCustomPrompt(parsed: ParsedCallInstruction): string {
    return `You are an AI voice assistant making a call on behalf of your user.

**CONTACT INFORMATION:**
- Calling: ${parsed.contactName}
- Phone: ${parsed.phoneNumber}

**YOUR INSTRUCTIONS:**
${parsed.instructions}

**EXPECTED OUTCOME:**
${parsed.expectedOutcome || 'Complete the task and report back with the result.'}

**IMPORTANT GUIDELINES:**
1. **Be polite and professional** - You're representing your user
2. **Identify yourself clearly** - "Hi ${parsed.contactName}, this is an AI assistant calling on behalf of [User Name]"
3. **State your purpose immediately** - Don't waste their time
4. **Listen actively** - Pay attention to their responses
5. **Confirm understanding** - Repeat back important details
6. **Handle objections gracefully** - If they're busy, offer to call back
7. **Close professionally** - Thank them and confirm next steps
8. **Keep it brief** - Get the information and end the call

**TONE:** Friendly, professional, efficient (not salesy - this is a personal request)

**RESPONSE FORMAT:**
After the call, you will report back:
- What you learned
- The contact's response/availability
- Any commitments made
- Recommended next steps

Begin the call now.`;
  }
}
