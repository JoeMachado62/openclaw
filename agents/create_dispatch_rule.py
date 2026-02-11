"""
Create LiveKit SIP Dispatch Rule
"""
import os
import asyncio
from dotenv import load_dotenv
from livekit import api
from livekit.protocol import models as proto_models

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

async def main():
    livekit_url = os.getenv('LIVEKIT_URL')
    livekit_api_key = os.getenv('LIVEKIT_API_KEY')
    livekit_api_secret = os.getenv('LIVEKIT_API_SECRET')
    sip_trunk_id = os.getenv('LIVEKIT_SIP_TRUNK_ID')

    print(f'LiveKit URL: {livekit_url}')
    print(f'SIP Trunk ID: {sip_trunk_id}')
    print(f'Agent Name: aime-voice-agent')

    # Create API client
    client = api.LiveKitAPI(livekit_url, livekit_api_key, livekit_api_secret)

    try:
        # List existing dispatch rules
        print('\n[1] Checking for existing dispatch rules...')
        try:
            from livekit.protocol.sip import ListSIPDispatchRuleRequest
            rules_response = await client.sip.list_sip_dispatch_rule(
                ListSIPDispatchRuleRequest()
            )
            print(f'    Found {len(rules_response.items)} existing dispatch rule(s)')

            # Check if our rule already exists
            for rule in rules_response.items:
                print(f'    - {rule.name} (ID: {rule.sip_dispatch_rule_id})')
                if 'aime' in rule.name.lower():
                    print(f'    >> AIME dispatch rule already exists!')
                    print(f'       Trunk IDs: {list(rule.trunk_ids)}')
                    print(f'       Room Preset: {rule.attributes.room_preset if rule.attributes else "N/A"}')
                    return
        except Exception as e:
            print(f'    Could not list rules (might not exist yet): {e}')

        # Create new dispatch rule
        print('\n[2] Creating new dispatch rule...')
        from livekit.protocol.sip import (
            CreateSIPDispatchRuleRequest,
            SIPDispatchRuleDirect,
        )

        request = CreateSIPDispatchRuleRequest(
            rule=SIPDispatchRuleDirect(
                room_name='aime-call-{callId}',
                pin='',
            ),
            trunk_ids=[sip_trunk_id],
            name='AIME Voice Agent',
            metadata='Routes SIP calls to AIME voice agent',
        )

        # Set room preset to agent name
        request.attributes.room_preset = 'aime-voice-agent'

        result = await client.sip.create_sip_dispatch_rule(request)

        print(f'    >> SUCCESS! Dispatch rule created!')
        print(f'       Rule ID: {result.sip_dispatch_rule_id}')
        print(f'       Name: {result.name}')
        print(f'       Trunk IDs: {list(result.trunk_ids)}')
        print(f'\n[OK] Voice agent will now answer calls from trunk {sip_trunk_id}')

    except Exception as e:
        print(f'\n[ERROR] Failed to create dispatch rule: {e}')
        import traceback
        traceback.print_exc()

        print('\n' + '='*60)
        print('MANUAL CONFIGURATION REQUIRED')
        print('='*60)
        print('\nPlease configure the dispatch rule manually:')
        print('1. Go to: https://cloud.livekit.io/')
        print('2. Navigate to: Telephony > Dispatch Rules')
        print('3. Click: Create Dispatch Rule')
        print('4. Configure:')
        print(f'   - Name: AIME Voice Agent')
        print(f'   - Rule Type: SIP Trunk')
        print(f'   - Direction: Inbound + Outbound')
        print(f'   - Associated Trunks: {sip_trunk_id}')
        print(f'   - Target Agent: aime-voice-agent')
        print('5. Save the rule')
    finally:
        await client.aclose()

if __name__ == '__main__':
    asyncio.run(main())
