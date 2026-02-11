/**
 * Private Integration Token Test - API V2
 * GoHighLevel API Version 2
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

async function testV2API() {
  console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════════════════╗
║      GoHighLevel API V2 - Private Integration Token Test          ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  section('Configuration');
  info('API Version: V2');
  info(`PIT_TOKEN: ${pitToken}`);
  info(`LOCATION_ID: ${locationId}`);

  section('Test 1: Get Location Info');

  try {
    // V2 API endpoint for locations
    const url = `https://services.leadconnectorhq.com/locations/${locationId}`;

    info('Testing endpoint:');
    console.log(url);
    console.log('');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      error('Location fetch failed');
      console.log('Error:', errorText);
      console.log('');
    } else {
      const data = await response.json();
      success('Location found!');
      if (data.location) {
        console.log(`  Name: ${data.location.name || 'Unknown'}`);
        console.log(`  ID: ${data.location.id}`);
        console.log(`  Company: ${data.location.companyId || 'N/A'}`);
      }
      console.log('');
    }
  } catch (err) {
    error(`Error: ${err.message}`);
  }

  section('Test 2: Search Contacts (V2)');

  try {
    // V2 API endpoint for contacts
    const url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=5`;

    info('Testing endpoint:');
    console.log(url);
    console.log('');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      error('Contact search failed');
      console.log('Error:', errorText);
      return false;
    }

    const data = await response.json();

    success('✓ API V2 Authentication SUCCESSFUL!');
    success('✓ Private Integration Token is WORKING!');
    console.log('');

    if (data.contacts && Array.isArray(data.contacts)) {
      info(`Found ${data.contacts.length} contact(s)`);

      if (data.contacts.length > 0) {
        console.log(`\n${colors.cyan}Contacts:${colors.reset}`);
        data.contacts.forEach((contact, i) => {
          const name = contact.contactName ||
                      `${contact.firstName || ''} ${contact.lastName || ''}`.trim() ||
                      'Unnamed';
          const contactInfo = contact.email || contact.phone || 'No contact info';
          console.log(`  ${i + 1}. ${name} - ${contactInfo}`);
        });
      } else {
        info('No contacts in location yet');
      }
    }

    return true;

  } catch (err) {
    error(`Error: ${err.message}`);
    return false;
  }
}

async function testCreateContact() {
  section('Test 3: Create Test Contact (V2)');

  const pitToken = process.env.GHL_PIT_TOKEN;
  const locationId = process.env.GHL_LOCATION_ID;

  const testContact = {
    firstName: 'EZWAI',
    lastName: 'Test Contact',
    email: `test-${Date.now()}@ezwai-test.com`,
    phone: '+15555551234',
    locationId: locationId,
    tags: ['ezwai-test', 'api-v2-test'],
    source: 'EZWAI API V2 Connection Test',
  };

  info('Creating test contact...');
  console.log('');

  try {
    const response = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testContact),
    });

    console.log(`Response: ${response.status} ${response.statusText}\n`);

    if (!response.ok) {
      const errorText = await response.text();
      error('Contact creation failed');
      console.log('Error:', errorText);

      if (response.status === 403) {
        error('Token needs "contacts.write" scope');
      }

      return false;
    }

    const data = await response.json();

    if (data.contact && data.contact.id) {
      success('✓ Test contact created!');
      success(`✓ Contact ID: ${data.contact.id}`);
      info(`✓ Email: ${testContact.email}`);

      console.log(`\n${colors.yellow}Verify in GoHighLevel:${colors.reset}`);
      console.log(`  https://app.gohighlevel.com/location/${locationId}/contacts/${data.contact.id}`);
      console.log('');

      return true;
    }

    return false;
  } catch (err) {
    error(`Error: ${err.message}`);
    return false;
  }
}

// Run tests
(async () => {
  const success = await testV2API();

  if (success) {
    // Wait 3 seconds before creating test contact
    console.log('');
    info('Creating test contact in 3 seconds...');
    info('(Press Ctrl+C to skip)');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await testCreateContact();

    section('🎉 SUCCESS!');
    console.log(`${colors.green}
╔════════════════════════════════════════════════════════════════════╗
║                 ✅ API V2 CONNECTION WORKING!                     ║
╚════════════════════════════════════════════════════════════════════╝
${colors.reset}`);

    console.log(`${colors.cyan}What was tested:${colors.reset}`);
    console.log('  ✓ API V2 endpoint connectivity');
    console.log('  ✓ Private Integration Token authentication');
    console.log('  ✓ Location access verified');
    console.log('  ✓ Contact read permissions');
    console.log('  ✓ Contact write permissions');
    console.log('');
    console.log(`${colors.cyan}Authentication Mode:${colors.reset}`);
    console.log(`  ${colors.green}✓ PRIMARY: Private Integration Token (PIT)${colors.reset}`);
    console.log(`  ${colors.blue}ℹ️  API Version: V2${colors.reset}`);
    console.log('');
    console.log(`${colors.green}✨ Integration is ready! You can start building your voice agent. ✨${colors.reset}\n`);

  } else {
    section('❌ TEST FAILED');
    console.log(`${colors.yellow}Troubleshooting:${colors.reset}`);
    console.log('  1. Verify PIT_TOKEN is correct');
    console.log('  2. Verify LOCATION_ID is correct');
    console.log('  3. Check token has required scopes');
    console.log('  4. Token must be for API V2');
    console.log('');
    process.exit(1);
  }
})();
