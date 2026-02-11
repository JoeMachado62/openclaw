/**
 * Token Debug Test - Try different API versions
 */

import { config } from 'dotenv';
config();

const pitToken = process.env.GHL_PIT_TOKEN;
const locationId = process.env.GHL_LOCATION_ID;

console.log('\n🔍 Testing token with different API configurations...\n');

async function testAPI(version, endpoint, description) {
  console.log(`Testing: ${description}`);
  console.log(`  Version: ${version}`);
  console.log(`  Endpoint: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pitToken}`,
        'Version': version,
        'Content-Type': 'application/json',
      },
    });

    console.log(`  Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`  ✅ SUCCESS!`);
      console.log(`  Response:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
      return true;
    } else {
      const error = await response.text();
      console.log(`  ❌ FAILED: ${error}`);
      return false;
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
    return false;
  }

  console.log('');
}

(async () => {
  console.log('Token:', pitToken);
  console.log('Location ID:', locationId);
  console.log('');

  // Test 1: V1 API with contacts endpoint
  await testAPI(
    '2021-07-28',
    `https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}&limit=1`,
    'V1 API - Contacts (current test)'
  );

  console.log('');

  // Test 2: V1 API with locations endpoint (to get valid location ID)
  await testAPI(
    '2021-07-28',
    'https://rest.gohighlevel.com/v1/locations/',
    'V1 API - List Locations'
  );

  console.log('');

  // Test 3: Try without version header
  console.log('Testing: No version header');
  try {
    const response = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/?locationId=${locationId}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pitToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`  Status: ${response.status}`);
    if (response.ok) {
      console.log(`  ✅ SUCCESS without version header!`);
    } else {
      console.log(`  ❌ FAILED:`, await response.text());
    }
  } catch (err) {
    console.log(`  ❌ ERROR: ${err.message}`);
  }

  console.log('\n');
})();
