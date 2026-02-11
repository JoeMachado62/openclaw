#!/usr/bin/env node
/**
 * Delete Joe Testing test contact
 */

import dotenv from 'dotenv';

dotenv.config();

const GHL_PIT_TOKEN = process.env.GHL_PIT_TOKEN;
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const CONTACT_ID = 'll0CKQTZeHNXS7hPVD4m';

async function deleteContact() {
  console.log('🗑️  Deleting test contact...\n');

  try {
    const response = await fetch(
      `${GHL_API_BASE}/contacts/${CONTACT_ID}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${GHL_PIT_TOKEN}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    console.log('✅ Contact deleted successfully');
    console.log('   Contact ID:', CONTACT_ID);
    console.log('\n📱 Now ready for proper Telegram test!\n');

  } catch (error) {
    console.error('❌ Error deleting contact:', error.message);
    throw error;
  }
}

deleteContact()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
