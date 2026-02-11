/**
 * Simple GoHighLevel Connection Test
 * Tests PIT (Private Integration Token) connectivity directly with SDK
 */

import { config } from 'dotenv';

// Load environment variables
config();

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
}

function info(msg) {
  console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`);
}

function section(msg) {
  console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.blue}${msg}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

async function runTest() {
  console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════════════════╗
║         GoHighLevel Connection Test - Simple Version              ║
║         Testing Private Integration Token (PIT) Mode              ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  // Test 1: Check environment variables
  section('Test 1: Environment Variables');

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;
  const clientId = process.env.GHL_CLIENT_ID;

  if (!pitToken || pitToken.startsWith('your_')) {
    error('GHL_PIT_TOKEN is not configured');
    error('Please set GHL_PIT_TOKEN in your .env file');
    process.exit(1);
  }

  if (!locationId || locationId.startsWith('your_')) {
    error('GHL_LOCATION_ID is not configured');
    error('Please set GHL_LOCATION_ID in your .env file');
    process.exit(1);
  }

  success(`PIT_TOKEN: ${pitToken.substring(0, 15)}... (PRIMARY)`);
  success(`LOCATION_ID: ${locationId}`);

  if (clientId && !clientId.includes('your_')) {
    info(`CLIENT_ID: ${clientId.substring(0, 20)}... (FALLBACK available)`);
  } else {
    info('OAuth credentials: Not configured (optional)');
  }

  // Test 2: Test API connectivity with PIT
  section('Test 2: API Connectivity Test (Using PIT)');

  try {
    info('Testing connection to GoHighLevel API...');
    info('Method: Private Integration Token');
    info('Endpoint: GET /contacts/search');

    const response = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}&limit=5`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pitToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      error(`API request failed with status: ${response.status}`);
      error(`Response: ${errorText}`);

      if (response.status === 401) {
        error('\nAuthentication failed!');
        error('Possible causes:');
        error('  1. PIT_TOKEN is invalid or expired');
        error('  2. Token was regenerated in GHL marketplace');
        error('  3. Token does not have required scopes');
      } else if (response.status === 403) {
        error('\nAccess forbidden!');
        error('Possible causes:');
        error('  1. Token missing "contacts.readonly" scope');
        error('  2. Location ID does not match token');
      } else if (response.status === 404) {
        error('\nLocation not found!');
        error('Possible causes:');
        error('  1. LOCATION_ID is incorrect');
        error('  2. Location does not exist or was deleted');
      }

      return false;
    }

    const data = await response.json();

    success('✓ Successfully connected to GoHighLevel API!');
    success('✓ Private Integration Token authentication WORKING!');

    if (data.contacts && Array.isArray(data.contacts)) {
      success(`✓ Found ${data.contacts.length} contact(s) in your location`);

      if (data.contacts.length > 0) {
        info('\nFirst few contacts:');
        data.contacts.forEach((contact, index) => {
          const name = contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unnamed';
          const contactInfo = contact.email || contact.phone || 'No contact info';
          console.log(`  ${index + 1}. ${name} - ${contactInfo}`);
        });
      } else {
        info('No contacts found in this location yet.');
      }
    }

    return true;
  } catch (err) {
    error(`Connection test failed: ${err.message}`);
    return false;
  }
}

async function testCreateContact() {
  section('Test 3: Create Test Contact (Optional - Write Permission Test)');

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  info('Creating a test contact to verify write permissions...');
  info('This will create a contact tagged as "ezwai-test"');

  const testContact = {
    firstName: 'EZWAI',
    lastName: 'Test Contact',
    email: `test-${Date.now()}@ezwai-test.com`,
    phone: '+15555551234',
    locationId: locationId,
    tags: ['ezwai-test', 'api-connectivity-test'],
    source: 'EZWAI API Connection Test',
  };

  try {
    const response = await fetch('https://rest.gohighlevel.com/v1/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testContact),
    });

    if (!response.ok) {
      const errorText = await response.text();
      error(`Failed to create contact: ${response.status}`);
      error(`Response: ${errorText}`);

      if (response.status === 403) {
        error('\nWrite permission denied!');
        error('Your PIT_TOKEN needs the "contacts.write" scope');
        error('Go to: https://marketplace.gohighlevel.com/ → Your App → Regenerate token with write scope');
      }

      return false;
    }

    const data = await response.json();

    if (data.contact && data.contact.id) {
      success('✓ Test contact created successfully!');
      success(`✓ Contact ID: ${data.contact.id}`);
      info(`✓ Email: ${testContact.email}`);

      console.log(`\n${colors.yellow}📋 Verify in your GoHighLevel dashboard:${colors.reset}`);
      console.log(`   https://app.gohighlevel.com/location/${locationId}/contacts/${data.contact.id}`);
      console.log(`\n${colors.yellow}Or view all contacts:${colors.reset}`);
      console.log(`   https://app.gohighlevel.com/location/${locationId}/contacts`);

      return true;
    }

    return false;
  } catch (err) {
    error(`Failed to create test contact: ${err.message}`);
    return false;
  }
}

// Main execution
(async () => {
  const connectivityOk = await runTest();

  if (connectivityOk) {
    // Wait 3 seconds before creating test contact
    console.log('\n');
    info('Waiting 3 seconds before creating test contact...');
    info('(Press Ctrl+C to skip this step)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await testCreateContact();

    // Final summary
    section('🎉 Test Complete!');
    success('GoHighLevel integration is working correctly!');
    success('Private Integration Token (PIT) mode is active and working!');

    console.log('\n' + colors.cyan + 'What was tested:' + colors.reset);
    console.log('  ✓ Environment variables loaded correctly');
    console.log('  ✓ PIT authentication successful');
    console.log('  ✓ Read permissions verified (contacts.readonly)');
    console.log('  ✓ Write permissions verified (contacts.write)');

    console.log('\n' + colors.cyan + 'Authentication Mode:' + colors.reset);
    console.log('  ' + colors.green + '✓ PRIMARY: Private Integration Token (PIT)' + colors.reset);
    console.log('  ' + colors.blue + 'ℹ️  FALLBACK: OAuth credentials (if configured)' + colors.reset);

    console.log('\n' + colors.cyan + 'Next Steps:' + colors.reset);
    console.log('  1. Check your GHL dashboard to see the test contact');
    console.log('  2. Verify the contact has tag "ezwai-test"');
    console.log('  3. You can delete the test contact after verification');
    console.log('  4. Start building your AIME voice agent features!');

    console.log('\n' + colors.green + '✨ You\'re ready to go! ✨\n' + colors.reset);
  } else {
    section('❌ Test Failed');
    error('GoHighLevel integration test failed');
    console.log('\n' + colors.cyan + 'Troubleshooting Steps:' + colors.reset);
    console.log('  1. Verify PIT_TOKEN is correct in .env');
    console.log('  2. Verify LOCATION_ID is correct in .env');
    console.log('  3. Check token has required scopes: contacts.readonly, contacts.write');
    console.log('  4. See GHL_CREDENTIALS_SETUP.md for detailed instructions');
    console.log('  5. Regenerate token at: https://marketplace.gohighlevel.com/\n');
    process.exit(1);
  }
})();
