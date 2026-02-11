"""
Update dispatch rule using direct REST API calls
"""
import os
import httpx
import json
from dotenv import load_dotenv
from livekit import api
from livekit.api import AccessToken, VideoGrants

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def main():
    livekit_url = os.getenv('LIVEKIT_URL')
    livekit_api_key = os.getenv('LIVEKIT_API_KEY')
    livekit_api_secret = os.getenv('LIVEKIT_API_SECRET')
    sip_trunk_id = os.getenv('LIVEKIT_SIP_TRUNK_ID')

    print(f'LiveKit URL: {livekit_url}')
    print(f'Outbound Trunk: {sip_trunk_id}')

    # Generate access token
    token = AccessToken(livekit_api_key, livekit_api_secret)
    token.identity = 'admin'
    jwt_token = token.to_jwt()

    # Convert WSS to HTTPS
    api_url = livekit_url.replace('wss://', 'https://').replace('ws://', 'http://')

    print(f'\n[1] Listing dispatch rules via REST API...')
    print(f'    API URL: {api_url}')

    # Try to get dispatch rules via REST
    try:
        response = httpx.post(
            f'{api_url}/twirp/livekit.SIPService/ListSIPDispatchRule',
            headers={
                'Authorization': f'Bearer {jwt_token}',
                'Content-Type': 'application/json',
            },
            json={},
            timeout=30.0
        )

        if response.status_code == 200:
            result = response.json()
            print(f'    Found dispatch rules: {json.dumps(result, indent=2)}')

            # Look for AIME rule
            if 'items' in result:
                for rule in result['items']:
                    if 'aime' in rule.get('name', '').lower():
                        print(f'\n[2] Found AIME dispatch rule:')
                        print(f'    Rule ID: {rule.get("sipDispatchRuleId")}')
                        print(f'    Name: {rule.get("name")}')
                        print(f'    Trunks: {rule.get("trunkIds", [])}')

                        # Check if it needs updating
                        current_trunks = rule.get('trunkIds', [])
                        if sip_trunk_id not in current_trunks:
                            print(f'\n    >> NEEDS UPDATE: Adding trunk {sip_trunk_id}')

                            # Update the rule
                            updated_trunks = current_trunks + [sip_trunk_id]
                            update_payload = {
                                'sipDispatchRuleId': rule.get('sipDispatchRuleId'),
                                'trunkIds': updated_trunks,
                                'rule': rule.get('rule'),
                                'attributes': {
                                    'roomPreset': 'aime-voice-agent'
                                }
                            }

                            print(f'\n[3] Updating dispatch rule...')
                            update_response = httpx.post(
                                f'{api_url}/twirp/livekit.SIPService/UpdateSIPDispatchRule',
                                headers={
                                    'Authorization': f'Bearer {jwt_token}',
                                    'Content-Type': 'application/json',
                                },
                                json=update_payload,
                                timeout=30.0
                            )

                            if update_response.status_code == 200:
                                print(f'    >> SUCCESS! Dispatch rule updated')
                                print(f'       New trunks: {updated_trunks}')
                                print(f'       Agent: aime-voice-agent')
                            else:
                                print(f'    ERROR: {update_response.status_code}')
                                print(f'    Response: {update_response.text}')
                        else:
                            print(f'\n    >> Trunk already configured!')

                            # Still need to set the agent
                            print(f'\n[3] Setting agent name...')
                            update_payload = {
                                'sipDispatchRuleId': rule.get('sipDispatchRuleId'),
                                'trunkIds': current_trunks,
                                'rule': rule.get('rule'),
                                'attributes': {
                                    'roomPreset': 'aime-voice-agent'
                                }
                            }

                            update_response = httpx.post(
                                f'{api_url}/twirp/livekit.SIPService/UpdateSIPDispatchRule',
                                headers={
                                    'Authorization': f'Bearer {jwt_token}',
                                    'Content-Type': 'application/json',
                                },
                                json=update_payload,
                                timeout=30.0
                            )

                            if update_response.status_code == 200:
                                print(f'    >> SUCCESS! Agent configured')
                            else:
                                print(f'    ERROR: {update_response.status_code}')
                                print(f'    Response: {update_response.text}')
        else:
            print(f'    API returned: {response.status_code}')
            print(f'    Response: {response.text}')

    except Exception as e:
        print(f'\n[ERROR] REST API call failed: {e}')
        import traceback
        traceback.print_exc()

    print('\n' + '='*60)
    print('MANUAL CONFIGURATION (if automatic update failed)')
    print('='*60)
    print('\n1. Go to: https://cloud.livekit.io/')
    print('2. Sign in with: buyaford4lesstoday@gmail.com')
    print('3. Select: AIME Voice Agent project')
    print('4. Navigate: Telephony → Dispatch Rules')
    print('5. Click: "AIME Voice Agent" rule')
    print('6. Click: Edit')
    print('7. Update:')
    print(f'   - Add trunk: {sip_trunk_id} (EZWAI AIME Assistant)')
    print(f'   - Set Target Agent: aime-voice-agent')
    print('8. Save')
    print('\nSee DISPATCH_RULE_SETUP.md for detailed instructions.')

if __name__ == '__main__':
    main()
