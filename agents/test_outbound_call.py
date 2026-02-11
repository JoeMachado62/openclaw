"""
Simple script to test outbound calling using REST API
"""
import os
import time
import httpx
from dotenv import load_dotenv
from livekit.api import AccessToken

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def make_test_call():
    """Make a test outbound call to +12398881606"""

    # Get credentials from environment
    livekit_url = os.getenv('LIVEKIT_URL')
    livekit_api_key = os.getenv('LIVEKIT_API_KEY')
    livekit_api_secret = os.getenv('LIVEKIT_API_SECRET')
    sip_trunk_id = os.getenv('LIVEKIT_SIP_TRUNK_ID')

    print(f"LiveKit URL: {livekit_url}")
    print(f"SIP Trunk ID: {sip_trunk_id}")

    # Phone number to call
    phone_number = "+12398881606"
    room_name = f"sarah-test-call-{int(time.time())}"

    print(f"\nInitiating call to {phone_number}...")
    print(f"Room name: {room_name}")

    # Create metadata for the call
    metadata = {
        "contact_id": "test-contact",
        "contact_name": "Test User",
        "direction": "outbound",
        "phone_number": phone_number,
        "custom_prompt": """You are Sarah, an AI assistant testing the EZWAI AIME voice system.

Your task:
1. When the call connects to voicemail, wait for the beep
2. Leave this exact message: "This is Sarah testing your EZWAI AIME system."
3. After delivering the message, end the call

Be clear, professional, and concise."""
    }

    try:
        # Generate LiveKit access token
        token = AccessToken(livekit_api_key, livekit_api_secret)
        token.identity = "test-caller"
        jwt_token = token.to_jwt()

        # Convert WSS URL to HTTPS for API calls
        api_url = livekit_url.replace('wss://', 'https://').replace('ws://', 'http://')
        sip_api_url = f"{api_url}/sip/create_outbound_call"

        print(f"\nCalling API: {sip_api_url}")

        # Make the API call
        response = httpx.post(
            sip_api_url,
            headers={
                'Authorization': f'Bearer {jwt_token}',
                'Content-Type': 'application/json',
            },
            json={
                'sip_trunk_id': sip_trunk_id,
                'phone_number': phone_number,
                'room_name': room_name,
                'metadata': str(metadata),
            },
            timeout=30.0,
        )

        print(f"Status Code: {response.status_code}")
        print(f"Response Text: {response.text}")

        if response.status_code == 200:
            try:
                call_data = response.json()
                print(f"\n[OK] Call initiated successfully!")
                print(f"Response: {call_data}")
            except:
                print(f"\n[OK] Call initiated (empty response)")
            print(f"Room: {room_name}")
            print(f"\nMonitor at: https://cloud.livekit.io")
        else:
            print(f"\n[ERROR] API call failed")
            print(f"Status: {response.status_code}")

    except Exception as e:
        print(f"\n[ERROR] Error initiating call: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    make_test_call()
