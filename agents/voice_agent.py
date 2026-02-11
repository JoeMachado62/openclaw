"""
AIME Voice Agent
LiveKit-based voice AI agent with GHL integration
"""

import asyncio
import logging
import os
from typing import Annotated
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, openai, elevenlabs, inworld
import httpx

from tools.ghl_tools import GHLTools
from tools.memory_tools import MemoryTools
from tools.sales_tools import SalesTools

logger = logging.getLogger("aime-voice-agent")
logger.setLevel(logging.INFO)


class AIMEVoiceAgent:
    """AIME Voice Agent with GHL and memory integration"""

    def __init__(self):
        self.openclaw_base_url = os.getenv("OPENCLAW_BASE_URL", "http://localhost:3000")
        self.tts_provider = os.getenv("TTS_PROVIDER", "inworld")  # Default to Inworld (cost-effective)
        self.ghl_tools = GHLTools(self.openclaw_base_url)
        self.memory_tools = MemoryTools(self.openclaw_base_url)
        self.sales_tools = SalesTools(self.openclaw_base_url)

    def _get_tts_provider(self):
        """Get TTS provider based on environment variable"""
        if self.tts_provider == "elevenlabs":
            logger.info("Using ElevenLabs Flash v2.5 TTS")
            return elevenlabs.TTS(
                model="flash_v2.5",  # 75ms latency, highest quality
                voice="Josh",  # Confident sales executive (replace with cloned voice ID later)
                # Optimization for human-like conversation:
                stability=0.4,  # Lower = more natural variation (0.3-0.5)
                similarity_boost=0.85,  # Higher = closer to source voice (0.8-0.9)
                style=0.6,  # Emotional expressiveness (0.5-0.7 for sales)
                use_speaker_boost=True,  # Enhance clarity
                optimize_streaming_latency=4,  # Max latency optimization (0-4)
            )
        else:
            # Default to Inworld (cost-effective, high-quality)
            logger.info("Using Inworld TTS 1.5 (20-25x cheaper than ElevenLabs)")
            return inworld.TTS(
                model="inworld-tts-1.5-max",  # Max quality model (<200ms P50 latency)
                voice="Sarah",  # Professional female voice
                temperature=1.0,  # Natural variation
                speaking_rate=1.0,  # Normal speed
                text_normalization="ON",  # Proper formatting
            )

    async def entry_point(self, ctx: JobContext):
        """Main entry point for voice agent"""
        logger.info(f"Voice agent starting for room: {ctx.room.name}")

        # Extract contact info from room metadata
        contact_info = await self._extract_contact_info(ctx)

        # Load contact context from unified memory
        contact_context = await self.memory_tools.get_contact_context(
            contact_info.get("contact_id")
        )

        # Build system prompt with context
        system_prompt = self._build_system_prompt(contact_info, contact_context)

        # Create agent session with premium sales configuration
        session = AgentSession(
            # STT: Deepgram Nova-3 - Multilingual support with auto language detection
            # Supports 10 languages: English, Spanish, French, German, Hindi, Russian,
            # Portuguese, Japanese, Italian, Dutch (with code-switching)
            stt=deepgram.STT(
                model="nova-3-general",
                detect_language=True,  # Enable automatic language detection
                smart_format=True,  # Automatic punctuation and formatting
                profanity_filter=False,  # Keep natural speech
                numerals=True,  # Convert spoken numbers to digits
            ),

            # LLM: GPT-5.2 Instant - Optimized for chat with fast responses
            llm=openai.LLM(
                model="gpt-5.2-instant",  # Released Dec 2025, 15-20% faster than GPT-5.1
                max_tokens=4096,
                temperature=0.7,  # Consistent but natural
            ),

            # TTS: Configurable provider (ElevenLabs or Inworld)
            # Set TTS_PROVIDER=elevenlabs for premium quality (75ms latency, $99/month)
            # Set TTS_PROVIDER=inworld for cost-effective quality (<200ms latency, 20-25x cheaper)
            tts=self._get_tts_provider(),
        )

        # Determine which tools to provide based on call direction
        is_outbound = contact_info.get('direction') == 'outbound'

        if is_outbound:
            # Outbound sales call tools
            tools = [
                self.sales_tools.qualify_lead,
                self.sales_tools.handle_objection,
                self.sales_tools.schedule_follow_up,
                self.sales_tools.log_sales_activity,
                self._lookup_contact,
                self._transfer_to_human,
            ]
        else:
            # Inbound customer service tools
            tools = [
                self._check_availability,
                self._book_appointment,
                self._lookup_contact,
                self._transfer_to_human,
            ]

        # Start agent with appropriate tools
        await session.start(
            agent=Agent(
                instructions=system_prompt,
                tools=tools,
            )
        )

        # Proactively greet (required for telephony)
        greeting = self._generate_greeting(contact_info, contact_context)
        await session.generate_reply(instructions=greeting)

        # Wait for session to end
        await session.wait_for_completion()

        # Post-call processing
        await self._post_call_processing(ctx, session, contact_info)

        logger.info(f"Voice agent completed for room: {ctx.room.name}")

    async def _extract_contact_info(self, ctx: JobContext) -> dict:
        """Extract contact information from room metadata or SIP participant"""
        import json

        metadata = json.loads(ctx.room.metadata or "{}")

        # Try to get phone number from metadata or SIP participant
        phone = metadata.get("caller", {}).get("phone") or metadata.get("phone_number")

        # If no phone in metadata, try to extract from SIP participant
        if not phone:
            for participant in ctx.room.remote_participants.values():
                if participant.identity.startswith("sip_"):
                    phone = participant.identity.replace("sip_", "")
                    break

        contact_info = {
            "phone": phone,
            "contact_id": metadata.get("caller", {}).get("contact_id") or metadata.get("contact_id"),
            "location_id": metadata.get("business_id") or metadata.get("location_id"),
            "direction": metadata.get("direction", "inbound"),
            "contact_name": metadata.get("contact_name"),
            # AI-initiated call fields
            "custom_prompt": metadata.get("custom_prompt"),
            "ai_instructions": metadata.get("ai_instructions"),
            "notification_phone": metadata.get("notification_phone"),
            "notification_method": metadata.get("notification_method"),
            "user_id": metadata.get("user_id"),
            "user_name": metadata.get("user_name"),
        }

        # If we have phone but no contact_id, try to look it up
        if phone and not contact_info["contact_id"]:
            try:
                contact = await self.ghl_tools.lookup_contact_by_phone(
                    contact_info["location_id"], phone
                )
                if contact:
                    contact_info["contact_id"] = contact.get("id")
                    contact_info["name"] = contact.get("contactName")
            except Exception as e:
                logger.error(f"Failed to lookup contact: {e}")

        return contact_info

    def _build_system_prompt(self, contact_info: dict, contact_context: dict | None) -> str:
        """Build sales-optimized system prompt based on call direction"""

        # Check if there's a custom AI-generated prompt
        if contact_info.get('custom_prompt'):
            logger.info("Using custom AI-generated prompt")
            return contact_info['custom_prompt']

        # Check if outbound or inbound
        is_outbound = contact_info.get('direction') == 'outbound'

        if is_outbound:
            # Outbound sales call prompt
            prompt = """You are an expert sales representative for [Business Name].

Your goal is to:
1. Build rapport quickly and naturally
2. Qualify the prospect's needs and budget using NEPQ techniques
3. Present solutions that address their specific pain points
4. Handle objections with empathy and data-driven insights
5. Move the conversation toward a clear next step (demo, proposal, or follow-up)

IMPORTANT RULES:
- Be conversational and human, never sound scripted or robotic
- Listen actively - ask clarifying questions before pitching
- Mirror the prospect's energy and tone
- Handle "not interested" with grace - ask permission to share one insight before ending
- Never argue or pressure - build trust and credibility instead
- If they're busy, acknowledge it and offer to call back at a better time
- Use their name naturally throughout the conversation
- Focus on their problems, not your product features

TONE: Confident, helpful, consultative (not pushy)

SALES FRAMEWORK (NEPQ):
1. Build rapport with genuine curiosity
2. Uncover problems with open-ended questions
3. Identify budget and timeline
4. Present solution tied to their specific pain points
5. Handle objections by validating concerns, then reframing
6. Close with a clear next step
"""
        else:
            # Inbound customer service prompt
            prompt = """You are AIME, a friendly AI assistant for [Business Name].

Your goal is to:
1. Answer questions about services and pricing
2. Schedule appointments
3. Help with customer inquiries
4. Transfer to a human when needed

Guidelines:
- Keep responses concise and conversational
- Use the caller's name when you know it
- Reference their history naturally
- Always confirm important details before booking
- Offer to transfer to a human if the request is complex

TONE: Warm, professional, helpful
"""

        if contact_context:
            prompt += f"\n\n# Contact Context\n\n{contact_context.get('summary', '')}\n"

            if contact_context.get("recent_interactions"):
                prompt += "\n## Recent History\n"
                for interaction in contact_context["recent_interactions"][:3]:
                    prompt += f"- {interaction}\n"

            if contact_context.get("key_facts"):
                prompt += "\n## Key Facts to Remember\n"
                for fact in contact_context["key_facts"][:3]:
                    prompt += f"- {fact}\n"

            if contact_context.get("recommendations"):
                prompt += "\n## Recommendations for This Call\n"
                for rec in contact_context["recommendations"]:
                    prompt += f"- {rec}\n"

        return prompt

    def _generate_greeting(self, contact_info: dict, contact_context: dict | None) -> str:
        """Generate personalized greeting"""
        name = contact_info.get("name")

        if name and contact_context:
            days_since = contact_context.get("days_since_last_contact", 999)
            if days_since < 7:
                return f"Greet {name} warmly and acknowledge it's good to hear from them again."
            else:
                return f"Greet {name} warmly - it's been a while since you last spoke."
        elif name:
            return f"Greet {name} professionally and ask how you can help them today."
        else:
            return "Greet the caller professionally and ask how you can help them today."

    async def _post_call_processing(
        self, ctx: JobContext, session: AgentSession, contact_info: dict
    ):
        """Process call data after completion"""
        try:
            # Get transcript
            transcript = session.get_transcript()

            # Check if this was an AI-initiated call
            is_ai_call = contact_info.get('ai_instructions') is not None

            # Send to OpenClaw bridge for processing
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.openclaw_base_url}/api/bridge/process-call",
                    json={
                        "contact_id": contact_info.get("contact_id"),
                        "location_id": contact_info.get("location_id"),
                        "phone": contact_info.get("phone"),
                        "transcript": transcript,
                        "duration_seconds": session.duration_seconds,
                        "room_name": ctx.room.name,
                    },
                    timeout=30.0,
                )

                # If this was an AI-initiated call, send completion webhook
                if is_ai_call:
                    logger.info("AI-initiated call completed, sending webhook...")

                    # Extract outcome from transcript (last agent message)
                    # In production, you'd use Claude to summarize the outcome
                    outcome = self._extract_outcome_from_transcript(transcript)

                    await client.post(
                        f"{self.openclaw_base_url}/api/calls/completed",
                        json={
                            "roomName": ctx.room.name,
                            "transcript": transcript,
                            "duration": session.duration_seconds,
                            "metadata": {
                                "contact_id": contact_info.get("contact_id"),
                                "contact_name": contact_info.get("contact_name"),
                                "notification_phone": contact_info.get("notification_phone"),
                                "notification_method": contact_info.get("notification_method"),
                                "user_id": contact_info.get("user_id"),
                                "user_name": contact_info.get("user_name"),
                            },
                            "outcome": outcome,
                        },
                        timeout=30.0,
                    )

            logger.info(f"Post-call processing completed for {contact_info.get('phone')}")

        except Exception as e:
            logger.error(f"Post-call processing failed: {e}")

    def _extract_outcome_from_transcript(self, transcript: str) -> str:
        """Extract key outcome from call transcript"""
        # Simple extraction - get last few agent messages
        # In production, use Claude to summarize
        lines = transcript.split('\n')
        agent_lines = [line for line in lines if line.startswith('Agent:')]

        if agent_lines:
            # Return last 2-3 agent messages as outcome
            return '\n'.join(agent_lines[-3:])

        return "Call completed successfully. See transcript for details."

    @function_tool
    async def _check_availability(
        self,
        date: Annotated[str, "Date in YYYY-MM-DD format"],
        service_type: Annotated[str, "Type of service"] = "consultation",
    ) -> str:
        """Check available appointment slots"""
        # This will call OpenClaw bridge → GHL API
        try:
            slots = await self.ghl_tools.check_availability(date, service_type)
            if slots:
                return f"Available slots on {date}: {', '.join(slots)}"
            else:
                return f"No availability on {date}. Would you like to try another date?"
        except Exception as e:
            logger.error(f"Failed to check availability: {e}")
            return "I'm having trouble checking availability right now. Let me transfer you to someone who can help."

    @function_tool
    async def _book_appointment(
        self,
        date: Annotated[str, "Date in YYYY-MM-DD format"],
        time: Annotated[str, "Time in HH:MM format"],
        name: Annotated[str, "Customer name"],
        phone: Annotated[str, "Customer phone number"],
        service: Annotated[str, "Service type"],
    ) -> str:
        """Book an appointment"""
        try:
            result = await self.ghl_tools.book_appointment(date, time, name, phone, service)
            if result.get("success"):
                return f"Great! I've booked your {service} appointment for {date} at {time}. You'll receive a confirmation shortly."
            else:
                return f"I'm sorry, there was an issue booking that slot. {result.get('error', 'Please try another time.')}"
        except Exception as e:
            logger.error(f"Failed to book appointment: {e}")
            return "I'm having trouble booking that appointment. Let me transfer you to someone who can help."

    @function_tool
    async def _lookup_contact(
        self,
        phone: Annotated[str, "Phone number to lookup"],
    ) -> str:
        """Look up contact information"""
        try:
            contact = await self.ghl_tools.lookup_contact_by_phone(None, phone)
            if contact:
                return f"Found contact: {contact.get('contactName', 'Unknown')}"
            else:
                return "No contact found with that phone number."
        except Exception as e:
            logger.error(f"Failed to lookup contact: {e}")
            return "I'm having trouble looking up that information right now."

    @function_tool
    async def _transfer_to_human(
        self,
        reason: Annotated[str, "Reason for transfer"],
        department: Annotated[str, "Department"] = "support",
    ) -> str:
        """Transfer the call to a human agent"""
        # This would trigger a warm transfer in production
        logger.info(f"Transfer requested: {reason} → {department}")
        return f"I understand you need {reason}. Let me connect you with our {department} team. Please hold for just a moment."


def main():
    """Entry point for running the agent"""
    agent = AIMEVoiceAgent()

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=agent.entry_point,
            agent_name="aime-voice-agent",
        )
    )


if __name__ == "__main__":
    main()
