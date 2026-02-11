/**
 * Private Integration Token (PIT) Only Test
 * Step-by-step verification of PIT authentication
 */

import { config } from 'dotenv';
config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function success(msg) { console.log(`${colors.green}✅ ${msg}${colors.reset}`); }
function error(msg) { console.log(`${colors.red}❌ ${msg}${colors.reset}`); }
function info(msg) { console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`); }
function section(msg) {
  console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.blue}${msg}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

async function step1_verifyCredentials() {
  section('STEP 1: Verify Credentials');

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  info('Checking environment variables...');
  console.log(`\nPIT_TOKEN: ${pitToken}`);
  console.log(`LOCATION_ID: ${locationId}\n`);

  if (!pitToken || pitToken.startsWith('your_')) {
    error('GHL_PIT_TOKEN is not configured');
    return false;
  }

  if (!locationId || locationId.startsWith('your_')) {
    error('GHL_LOCATION_ID is not configured');
    return false;
  }

  success('Both credentials are present');

  // Validate token format
  if (!pitToken.startsWith('pit-')) {
    error('WARNING: Token does not start with "pit-" prefix');
    error('Expected format: pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    info('Your token: ' + pitToken);
    return false;
  }

  success('Token format looks correct (starts with "pit-")');
  return true;
}

async function step2_testAuthentication() {
  section('STEP 2: Test API Authentication');

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  info('Making API request to GoHighLevel...');
  info('Endpoint: GET /contacts/');
  info('Method: Private Integration Token (Bearer auth)');
  console.log('');

  try {
    const url = `https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}&limit=5`;

    info('Request URL:');
    console.log(url);
    console.log('');

    info('Request Headers:');
    console.log('Authorization: Bearer ' + pitToken.substring(0, 20) + '...');
    console.log('Version: 2021-07-28');
    console.log('');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    info('Response received:');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('');

    if (!response.ok) {
      const errorText = await response.text();
      error(`API request failed!`);
      console.log(`\n${colors.red}Full error response:${colors.reset}`);
      console.log(errorText);
      console.log('');

      if (response.status === 401) {
        error('401 Unauthorized - Authentication Failed');
        console.log(`\n${colors.yellow}Possible causes:${colors.reset}`);
        console.log('1. Token is invalid or expired');
        console.log('2. Token was not generated correctly');
        console.log('3. Token does not match the location');
        console.log('');
        console.log(`${colors.yellow}Next steps:${colors.reset}`);
        console.log('1. Go to: https://marketplace.gohighlevel.com/');
        console.log('2. Find your Private Integration app');
        console.log('3. Regenerate the token');
        console.log('4. Make sure to select ALL scopes');
        console.log('5. Copy the NEW token immediately');
        console.log('6. Update GHL_PIT_TOKEN in .env');
      } else if (response.status === 403) {
        error('403 Forbidden - Permission Denied');
        console.log(`\n${colors.yellow}The token is valid but lacks permissions${colors.reset}`);
        console.log('Solution: Regenerate token with "contacts.readonly" scope');
      } else if (response.status === 404) {
        error('404 Not Found - Location ID Invalid');
        console.log(`\n${colors.yellow}The LOCATION_ID is incorrect${colors.reset}`);
        console.log('Current: ' + locationId);
        console.log('');
        console.log('How to get correct Location ID:');
        console.log('1. Go to: https://app.gohighlevel.com/');
        console.log('2. Look at the URL: /location/[LOCATION_ID]/dashboard');
        console.log('3. Copy that LOCATION_ID value');
      }

      return false;
    }

    const data = await response.json();

    success('Authentication successful!');
    success('Private Integration Token is WORKING!');
    console.log('');

    if (data.contacts) {
      info(`Found ${data.contacts.length} contact(s)`);

      if (data.contacts.length > 0) {
        console.log(`\n${colors.cyan}Contacts in your location:${colors.reset}`);
        data.contacts.forEach((contact, i) => {
          const name = contact.contactName ||
                      `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                      'Unnamed';
          const info = contact.email || contact.phone || 'No contact info';
          console.log(`  ${i + 1}. ${name} - ${info}`);
        });
      } else {
        info('No contacts in this location yet (location is empty)');
      }
    }

    return true;

  } catch (err) {
    error('Network error or unexpected failure');
    console.log(`\n${colors.red}Error details:${colors.reset}`);
    console.log(err.message);
    console.log('');
    console.log(`${colors.yellow}This could mean:${colors.reset}`);
    console.log('1. Network connectivity issue');
    console.log('2. GoHighLevel API is down');
    console.log('3. Firewall blocking the request');
    return false;
  }
}

// Run both steps
(async () => {
  console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════════════════╗
║        GoHighLevel - Private Integration Token Test               ║
║        Testing ONLY PIT Mode (No OAuth/Marketplace)               ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // Step 1
  const step1Pass = await step1_verifyCredentials();

  if (!step1Pass) {
    error('\nStep 1 failed. Please fix credentials before continuing.');
    process.exit(1);
  }

  // Step 2
  const step2Pass = await step2_testAuthentication();

  // Summary
  section('SUMMARY');

  if (step1Pass && step2Pass) {
    console.log(`${colors.green}
╔════════════════════════════════════════════════════════════════════╗
║                      ✅ ALL TESTS PASSED!                         ║
║                                                                    ║
║  Private Integration Token is configured correctly and working!   ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`\n${colors.cyan}What was verified:${colors.reset}`);
    console.log('  ✓ PIT_TOKEN format is correct');
    console.log('  ✓ LOCATION_ID is valid');
    console.log('  ✓ Authentication successful');
    console.log('  ✓ Read permissions working');
    console.log('');
    console.log(`${colors.cyan}Verify in GoHighLevel:${colors.reset}`);
    console.log(`  https://app.gohighlevel.com/location/${process.env.GHL_LOCATION_ID}/contacts`);
    console.log('');
    console.log(`${colors.green}✨ Your integration is ready to use! ✨${colors.reset}\n`);

  } else {
    console.log(`${colors.red}
╔════════════════════════════════════════════════════════════════════╗
║                       ❌ TEST FAILED                              ║
║                                                                    ║
║          Please follow the troubleshooting steps above            ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`\n${colors.yellow}Quick Checklist:${colors.reset}`);
    console.log('  □ Generated fresh PIT token from marketplace');
    console.log('  □ Token has all required scopes selected');
    console.log('  □ Copied entire token including "pit-" prefix');
    console.log('  □ Updated GHL_PIT_TOKEN in .env file');
    console.log('  □ LOCATION_ID matches your actual location');
    console.log('');

    process.exit(1);
  }
})();
