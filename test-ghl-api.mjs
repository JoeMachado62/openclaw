#!/usr/bin/env node
/**
 * Direct GHL API test - creates Joe Testing lead
 */

import dotenv from 'dotenv';

dotenv.config();

const GHL_PIT_TOKEN = process.env.GHL_PIT_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_API_BASE = 'https://services.leadconnectorhq.com';

async function createContact() {
  console.log('🚀 Creating Joe Testing contact in GHL...\n');

  const contactData = {
    firstName: 'Joe',
    lastName: 'Testing',
    phone: '+18508428707',
    email: 'joe.testing@example.com',
    tags: ['Voice Automation Inquiry', 'AI Lead', 'Test Lead'],
    source: 'AIME Agent Test'
  };

  try {
    const response = await fetch(
      `${GHL_API_BASE}/contacts/`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_PIT_TOKEN}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...contactData,
          locationId: GHL_LOCATION_ID
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const contact = await response.json();
    console.log('✅ Contact created successfully!\n');
    console.log('Contact ID:', contact.contact?.id || contact.id);
    console.log('Name:', `${contactData.firstName} ${contactData.lastName}`);
    console.log('Phone:', contactData.phone);
    console.log('Email:', contactData.email);
    console.log('Tags:', contactData.tags.join(', '));
    console.log('\n📋 Next: Make outbound call about voice automation inquiry');
    console.log('📱 Report back to @line_logic on Telegram\n');

    return contact.contact || contact;
  } catch (error) {
    console.error('❌ Error creating contact:', error.message);
    throw error;
  }
}

createContact()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
