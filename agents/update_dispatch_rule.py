"""
Update LiveKit SIP Dispatch Rule to include outbound trunk and agent name
"""
import os
import asyncio
from dotenv import load_dotenv
from livekit import api

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

async def main():
    livekit_url = os.getenv('LIVEKIT_URL')
    livekit_api_key = os.getenv('LIVEKIT_API_KEY')
    livekit_api_secret = os.getenv('LIVEKIT_API_SECRET')
    sip_trunk_id = os.getenv('LIVEKIT_SIP_TRUNK_ID')

    print(f'LiveKit URL: {livekit_url}')
    print(f'Outbound Trunk ID: {sip_trunk_id}')

    # Create API client
    client = api.LiveKitAPI(livekit_url, livekit_api_key, livekit_api_secret)

    try:
        # List existing dispatch rules
        print('\n[1] Finding existing AIME dispatch rule...')
        from livekit.protocol.sip import ListSIPDispatchRuleRequest
        rules_response = await client.sip.list_dispatch_rule(
            ListSIPDispatchRuleRequest()
        )

        aime_rule = None
        for rule in rules_response.items:
            if 'aime' in rule.name.lower():
                aime_rule = rule
                print(f'    Found: {rule.name} (ID: {rule.sip_dispatch_rule_id})')
                print(f'    Current Trunks: {list(rule.trunk_ids)}')
                print(f'    Current Agent: {rule.attributes.room_preset if rule.attributes else "N/A"}')
                break

        if not aime_rule:
            print('    ERROR: No AIME dispatch rule found!')
            return

        # Update the dispatch rule
        print(f'\n[2] Updating dispatch rule...')
        from livekit.protocol.sip import UpdateSIPDispatchRuleRequest

        # Build updated trunk list (combine existing + new outbound trunk)
        updated_trunks = list(set(list(aime_rule.trunk_ids) + [sip_trunk_id]))
        print(f'    Updated Trunks: {updated_trunks}')

        # Create update request
        update_request = UpdateSIPDispatchRuleRequest(
            sip_dispatch_rule_id=aime_rule.sip_dispatch_rule_id,
            name=aime_rule.name,
            trunk_ids=updated_trunks,
            metadata=aime_rule.metadata or 'Routes SIP calls to AIME voice agent',
        )

        # CRITICAL: Set room_preset to agent name
        if not update_request.attributes:
            from livekit.protocol.sip import SIPCallAttributes
            update_request.attributes = SIPCallAttributes()

        update_request.attributes.room_preset = 'aime-voice-agent'

        # Copy over the rule (Direct or Individual)
        if aime_rule.rule.WhichOneof('rule') == 'dispatch_rule_direct':
            update_request.rule.dispatch_rule_direct.CopyFrom(aime_rule.rule.dispatch_rule_direct)
        elif aime_rule.rule.WhichOneof('rule') == 'dispatch_rule_individual':
            update_request.rule.dispatch_rule_individual.CopyFrom(aime_rule.rule.dispatch_rule_individual)

        result = await client.sip.update_dispatch_rule(update_request)

        print(f'\n    >> SUCCESS! Dispatch rule updated!')
        print(f'       Rule ID: {result.sip_dispatch_rule_id}')
        print(f'       Name: {result.name}')
        print(f'       Trunks: {list(result.trunk_ids)}')
        print(f'       Agent: {result.attributes.room_preset if result.attributes else "N/A"}')
        print(f'\n[OK] Voice agent "aime-voice-agent" will now answer all calls!')

    except Exception as e:
        print(f'\n[ERROR] Failed to update dispatch rule: {e}')
        import traceback
        traceback.print_exc()

        print('\n' + '='*60)
        print('PLEASE UPDATE MANUALLY IN DASHBOARD')
        print('='*60)
        print('\n1. Go to: https://cloud.livekit.io/')
        print('2. Sign in with: buyaford4lesstoday@gmail.com')
        print('3. Select project: AIME Voice Agent')
        print('4. Navigate to: Telephony > Dispatch Rules')
        print('5. Click on: "AIME Voice Agent" rule')
        print('6. Click: Edit')
        print('7. Update:')
        print(f'   - Associated Trunks: Add "{sip_trunk_id}"')
        print(f'   - Target Agent: Set to "aime-voice-agent"')
        print('8. Save')
    finally:
        await client.aclose()

if __name__ == '__main__':
    asyncio.run(main())
