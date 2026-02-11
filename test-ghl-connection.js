/**
 * GoHighLevel Connection Test Script
 * Tests connectivity using Private Integration Token (primary) with OAuth fallback
 */

import { config } from 'dotenv';
import { createGHLPlugin, loadGHLConfigFromEnv } from './src/plugins/ghl/index.js';

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

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
}

function section(msg) {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}${msg}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

/**
 * Test 1: Verify environment variables are loaded
 */
function testEnvironmentVariables() {
  section('Test 1: Environment Variables');

  const requiredVars = {
    'GHL_PIT_TOKEN': process.env.GHL_PIT_TOKEN,
    'GHL_LOCATION_ID': process.env.GHL_LOCATION_ID,
  };

  const optionalVars = {
    'GHL_CLIENT_ID': process.env.GHL_CLIENT_ID,
    'GHL_CLIENT_SECRET': process.env.GHL_CLIENT_SECRET,
    'GHL_REDIRECT_URI': process.env.GHL_REDIRECT_URI,
    'GHL_WEBHOOK_SECRET': process.env.GHL_WEBHOOK_SECRET,
  };

  let allPresent = true;

  // Check required variables
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value && value !== 'your_private_integration_token_here' && value !== 'your_location_id_here') {
      success(`${key}: Set (${value.substring(0, 20)}...)`);
    } else {
      error(`${key}: Missing or not configured`);
      allPresent = false;
    }
  }

  // Check optional variables
  for (const [key, value] of Object.entries(optionalVars)) {
    if (value && !value.startsWith('your_')) {
      info(`${key}: Set (optional)`);
    } else {
      info(`${key}: Not set (optional)`);
    }
  }

  return allPresent;
}

/**
 * Test 2: Load GHL configuration
 */
function testLoadConfiguration() {
  section('Test 2: Load Configuration');

  try {
    const config = loadGHLConfigFromEnv();

    // Check if PIT mode is active
    if (config.pitToken) {
      success('Configuration loaded successfully');
      success('Using Private Integration Token mode (PRIMARY)');
      info(`Location ID: ${process.env.GHL_LOCATION_ID}`);

      // Check if OAuth credentials are also present
      if (config.clientId && !config.clientId.includes('not_required')) {
        info('OAuth credentials also available (FALLBACK)');
      }

      return config;
    } else {
      warning('Using OAuth mode (PIT token not found)');
      return config;
    }
  } catch (err) {
    error(`Failed to load configuration: ${err.message}`);
    return null;
  }
}

/**
 * Test 3: Initialize GHL Plugin
 */
async function testInitializePlugin(config) {
  section('Test 3: Initialize GHL Plugin');

  try {
    const ghl = createGHLPlugin(config);
    await ghl.initialize();
    success('GHL Plugin initialized successfully');
    return ghl;
  } catch (err) {
    error(`Failed to initialize plugin: ${err.message}`);
    return null;
  }
}

/**
 * Test 4: Test API connectivity by searching contacts
 */
async function testAPIConnectivity(ghl) {
  section('Test 4: API Connectivity Test');

  const locationId = process.env.GHL_LOCATION_ID;

  try {
    info('Attempting to search contacts...');

    // Search for any contacts (empty query returns all)
    const contacts = await ghl.contacts.searchContacts(locationId, {
      query: ''
    });

    if (contacts && Array.isArray(contacts)) {
      success(`Successfully connected to GHL API!`);
      success(`Found ${contacts.length} contact(s) in your location`);

      if (contacts.length > 0) {
        info('\nFirst few contacts:');
        contacts.slice(0, 3).forEach((contact, index) => {
          console.log(`  ${index + 1}. ${contact.contactName || contact.firstName || 'Unnamed'} (${contact.email || contact.phone || 'No contact info'})`);
        });
      } else {
        warning('No contacts found. Your location may be empty.');
        info('You can verify this in: https://app.gohighlevel.com/location/' + locationId + '/contacts');
      }

      return true;
    } else {
      warning('Unexpected response format from API');
      return false;
    }
  } catch (err) {
    error(`API connectivity test failed: ${err.message}`);

    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
      error('Authentication failed - check your PIT_TOKEN');
    } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
      error('Access denied - check your token permissions/scopes');
    } else if (err.message.includes('404')) {
      error('Location not found - check your LOCATION_ID');
    }

    return false;
  }
}

/**
 * Test 5: Create a test contact (optional)
 */
async function testCreateContact(ghl) {
  section('Test 5: Create Test Contact (Optional)');

  const locationId = process.env.GHL_LOCATION_ID;
  const testEmail = `test-${Date.now()}@ezwai-test.com`;

  try {
    info('Creating a test contact to verify write permissions...');

    const contact = await ghl.contacts.upsertContact(locationId, {
      firstName: 'EZWAI',
      lastName: 'Test Contact',
      email: testEmail,
      phone: '+15555551234',
      tags: ['ezwai-test', 'api-test'],
      source: 'EZWAI Connection Test',
    });

    if (contact && contact.id) {
      success(`Test contact created successfully!`);
      success(`Contact ID: ${contact.id}`);
      info(`Email: ${testEmail}`);
      info('\nVerify in GHL:');
      console.log(`  https://app.gohighlevel.com/location/${locationId}/contacts/${contact.id}`);

      return contact;
    } else {
      warning('Contact creation response unexpected');
      return null;
    }
  } catch (err) {
    error(`Failed to create test contact: ${err.message}`);

    if (err.message.includes('403') || err.message.includes('Forbidden')) {
      error('Write permission denied - check token has contacts.write scope');
    }

    return null;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`${colors.cyan}
╔═══════════════════════════════════════════════════════════╗
║         GoHighLevel Connection Test Script               ║
║         Testing Private Integration Token Mode           ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Environment Variables
  if (testEnvironmentVariables()) {
    testsPassed++;
  } else {
    testsFailed++;
    error('\nPlease configure your .env file with GHL credentials');
    process.exit(1);
  }

  // Test 2: Load Configuration
  const config = testLoadConfiguration();
  if (config) {
    testsPassed++;
  } else {
    testsFailed++;
    error('\nFailed to load configuration. Check your .env file');
    process.exit(1);
  }

  // Test 3: Initialize Plugin
  const ghl = await testInitializePlugin(config);
  if (ghl) {
    testsPassed++;
  } else {
    testsFailed++;
    error('\nFailed to initialize GHL plugin');
    process.exit(1);
  }

  // Test 4: API Connectivity
  const connected = await testAPIConnectivity(ghl);
  if (connected) {
    testsPassed++;
  } else {
    testsFailed++;
  }

  // Test 5: Create Test Contact (optional)
  if (connected) {
    info('\nDo you want to create a test contact? (This will verify write permissions)');
    info('Press Ctrl+C to skip, or wait 5 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const testContact = await testCreateContact(ghl);
    if (testContact) {
      testsPassed++;
    } else {
      // Don't fail the test suite if this fails
      warning('Test contact creation skipped or failed (optional test)');
    }
  }

  // Summary
  section('Test Summary');
  console.log(`Tests Passed: ${colors.green}${testsPassed}${colors.reset}`);
  console.log(`Tests Failed: ${colors.red}${testsFailed}${colors.reset}`);

  if (testsFailed === 0) {
    console.log(`\n${colors.green}╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  ✅ ALL TESTS PASSED! GHL Integration is working!       ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

    info('Authentication Mode Confirmed:');
    if (config.pitToken) {
      success('✓ Using Private Integration Token (PRIMARY)');
      success('✓ OAuth credentials available as fallback');
    } else {
      warning('! Using OAuth mode (PIT not configured)');
    }

    info('\nNext Steps:');
    console.log('  1. Check your GoHighLevel dashboard to verify the test results');
    console.log(`     https://app.gohighlevel.com/location/${process.env.GHL_LOCATION_ID}/contacts`);
    console.log('  2. If you see the test contact, the integration is working perfectly!');
    console.log('  3. You can now start building your AIME voice agent features');
  } else {
    console.log(`\n${colors.red}╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  ❌ SOME TESTS FAILED - Review errors above             ║`);
    console.log(`╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);

    info('Troubleshooting:');
    console.log('  1. Verify your PIT_TOKEN is correct');
    console.log('  2. Verify your LOCATION_ID is correct');
    console.log('  3. Check token has required scopes: contacts.readonly, contacts.write');
    console.log('  4. See: GHL_CREDENTIALS_SETUP.md for detailed setup instructions');
  }
}

// Run tests
runTests().catch(err => {
  error(`\nUnexpected error: ${err.message}`);
  console.error(err);
  process.exit(1);
});
