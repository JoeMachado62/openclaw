"""
Outbound Call Initiator for AIME Sales Agent
Enables programmatic initiation of outbound sales calls via LiveKit SIP
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Optional

from livekit import api
from livekit.protocol import sip as sip_proto

logger = logging.getLogger("outbound-dialer")
logger.setLevel(logging.INFO)


class OutboundDialer:
    """Manages outbound call initiation via LiveKit SIP"""

    def __init__(self, livekit_url: str, api_key: str, api_secret: str, sip_trunk_id: str):
        """
        Initialize outbound dialer

        Args:
            livekit_url: LiveKit server URL (e.g., wss://project.livekit.cloud)
            api_key: LiveKit API key
            api_secret: LiveKit API secret
            sip_trunk_id: SIP trunk ID for outbound calls
        """
        self.livekit_url = livekit_url
        self.api_key = api_key
        self.api_secret = api_secret
        self.sip_trunk_id = sip_trunk_id
        self.livekit_api = api.LiveKitAPI(livekit_url, api_key, api_secret)

    async def initiate_call(
        self,
        phone_number: str,
        contact_id: str,
        location_id: str,
        campaign_id: Optional[str] = None,
        agent_instructions: Optional[str] = None,
    ) -> dict:
        """
        Initiate an outbound sales call

        Args:
            phone_number: Phone number to call (E.164 format, e.g., +13055551234)
            contact_id: GoHighLevel contact ID
            location_id: GoHighLevel location ID
            campaign_id: Optional campaign identifier
            agent_instructions: Optional custom instructions for the AI agent

        Returns:
            dict: Call initiation result with room_name, call_id, status
        """
        try:
            # Validate phone number format
            if not phone_number.startswith("+"):
                raise ValueError(f"Phone number must be in E.164 format (start with +): {phone_number}")

            # Create unique room name for this call
            timestamp = int(time.time())
            room_name = f"aime-outbound-{contact_id}-{timestamp}"

            # Prepare metadata for the call
            call_metadata = {
                "contact_id": contact_id,
                "location_id": location_id,
                "campaign_id": campaign_id,
                "direction": "outbound",
                "initiated_at": datetime.utcnow().isoformat(),
                "phone_number": phone_number,
            }

            if agent_instructions:
                call_metadata["agent_instructions"] = agent_instructions

            logger.info(f"Initiating outbound call to {phone_number} (contact: {contact_id})")

            # Create SIP outbound call request
            sip_request = sip_proto.CreateSIPOutboundCallRequest(
                sip_trunk_id=self.sip_trunk_id,
                phone_number=phone_number,
                room_name=room_name,
                metadata=json.dumps(call_metadata),
                # Optional: Set headers for caller ID, etc.
                # headers={
                #     "X-Contact-ID": contact_id,
                #     "X-Campaign-ID": campaign_id or "",
                # }
            )

            # Execute the call via LiveKit API
            response = await self.livekit_api.sip.create_sip_outbound_call(sip_request)

            logger.info(f"Outbound call initiated successfully: room={room_name}, sip_call_id={response.sip_call_id}")

            return {
                "success": True,
                "room_name": room_name,
                "sip_call_id": response.sip_call_id,
                "phone_number": phone_number,
                "contact_id": contact_id,
                "initiated_at": call_metadata["initiated_at"],
                "status": "initiated",
            }

        except ValueError as e:
            logger.error(f"Invalid phone number format: {e}")
            return {
                "success": False,
                "error": "invalid_phone_number",
                "message": str(e),
            }

        except Exception as e:
            logger.error(f"Failed to initiate outbound call: {e}")
            return {
                "success": False,
                "error": "call_initiation_failed",
                "message": str(e),
            }

    async def initiate_batch_calls(
        self,
        contacts: list[dict],
        campaign_id: str,
        delay_between_calls: int = 5,
    ) -> dict:
        """
        Initiate multiple outbound calls with delay between each

        Args:
            contacts: List of contact dicts with 'phone_number', 'contact_id', 'location_id'
            campaign_id: Campaign identifier for tracking
            delay_between_calls: Seconds to wait between calls (default: 5)

        Returns:
            dict: Batch results with success/failure counts
        """
        results = {
            "total": len(contacts),
            "successful": 0,
            "failed": 0,
            "calls": [],
        }

        logger.info(f"Starting batch call campaign: {campaign_id} ({len(contacts)} contacts)")

        for i, contact in enumerate(contacts):
            try:
                # Initiate individual call
                call_result = await self.initiate_call(
                    phone_number=contact["phone_number"],
                    contact_id=contact["contact_id"],
                    location_id=contact["location_id"],
                    campaign_id=campaign_id,
                )

                results["calls"].append(call_result)

                if call_result["success"]:
                    results["successful"] += 1
                    logger.info(f"Call {i+1}/{len(contacts)} initiated: {contact['phone_number']}")
                else:
                    results["failed"] += 1
                    logger.warning(f"Call {i+1}/{len(contacts)} failed: {contact['phone_number']}")

                # Delay between calls (except after last call)
                if i < len(contacts) - 1:
                    await asyncio.sleep(delay_between_calls)

            except Exception as e:
                logger.error(f"Error processing contact {contact.get('contact_id')}: {e}")
                results["failed"] += 1
                results["calls"].append({
                    "success": False,
                    "contact_id": contact.get("contact_id"),
                    "error": str(e),
                })

        logger.info(f"Batch campaign completed: {results['successful']} successful, {results['failed']} failed")

        return results

    async def get_call_status(self, room_name: str) -> dict:
        """
        Get the status of an active or completed call

        Args:
            room_name: LiveKit room name for the call

        Returns:
            dict: Call status information
        """
        try:
            # Use LiveKit API to get room info
            room_service = api.RoomServiceClient(self.livekit_url, self.api_key, self.api_secret)
            room_list = await room_service.list_rooms([room_name])

            if not room_list.rooms:
                return {
                    "status": "not_found",
                    "room_name": room_name,
                }

            room = room_list.rooms[0]

            return {
                "status": "active" if room.num_participants > 0 else "ended",
                "room_name": room_name,
                "num_participants": room.num_participants,
                "created_at": room.creation_time,
                "metadata": json.loads(room.metadata) if room.metadata else {},
            }

        except Exception as e:
            logger.error(f"Failed to get call status for {room_name}: {e}")
            return {
                "status": "error",
                "room_name": room_name,
                "error": str(e),
            }


# CLI interface for testing
async def main():
    """
    CLI interface for testing outbound dialer

    Usage:
        python outbound_dialer.py --phone +13055551234 --contact-id abc123 --location-id xyz789
    """
    import argparse
    import os
    from dotenv import load_dotenv

    load_dotenv()

    parser = argparse.ArgumentParser(description="AIME Outbound Dialer")
    parser.add_argument("--phone", required=True, help="Phone number to call (E.164 format)")
    parser.add_argument("--contact-id", required=True, help="GoHighLevel contact ID")
    parser.add_argument("--location-id", required=True, help="GoHighLevel location ID")
    parser.add_argument("--campaign-id", help="Campaign ID (optional)")

    args = parser.parse_args()

    # Load credentials from environment
    livekit_url = os.getenv("LIVEKIT_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    sip_trunk_id = os.getenv("LIVEKIT_SIP_TRUNK_ID")

    if not all([livekit_url, api_key, api_secret, sip_trunk_id]):
        print("❌ Missing required environment variables:")
        print("   - LIVEKIT_URL")
        print("   - LIVEKIT_API_KEY")
        print("   - LIVEKIT_API_SECRET")
        print("   - LIVEKIT_SIP_TRUNK_ID")
        return

    # Initialize dialer
    dialer = OutboundDialer(livekit_url, api_key, api_secret, sip_trunk_id)

    # Initiate call
    print(f"\n📞 Initiating outbound call to {args.phone}...")
    result = await dialer.initiate_call(
        phone_number=args.phone,
        contact_id=args.contact_id,
        location_id=args.location_id,
        campaign_id=args.campaign_id,
    )

    if result["success"]:
        print(f"✅ Call initiated successfully!")
        print(f"   Room: {result['room_name']}")
        print(f"   SIP Call ID: {result['sip_call_id']}")
        print(f"\n💡 Monitor the call in LiveKit dashboard:")
        print(f"   https://cloud.livekit.io/projects/{livekit_url.split('//')[1].split('.')[0]}/rooms/{result['room_name']}")
    else:
        print(f"❌ Call initiation failed: {result.get('message')}")


if __name__ == "__main__":
    asyncio.run(main())
