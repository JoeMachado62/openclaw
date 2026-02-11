#!/usr/bin/env node
/**
 * Quick test script for GHL plugin
 * Creates test lead: Joe Testing (850-842-8707)
 */

import { GHLPlugin, loadGHLConfigFromEnv } from './extensions/gohighlevel/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCreateLead() {
  console.log('🚀 Testing GHL Plugin - Creating Lead...\n');

  try {
    // Initialize GHL plugin
    const config = loadGHLConfigFromEnv();
    const plugin = new GHLPlugin({ config });

    const locationId = process.env.GHL_LOCATION_ID;

    console.log('📍 Location ID:', locationId);
    console.log('🔑 Using PIT Token mode\n');

    // Test data
    const leadData = {
      firstName: 'Joe',
      lastName: 'Testing',
      phone: '+18508428707', // E.164 format
      email: 'joe.testing@example.com', // Adding email for completeness
      tags: ['Voice Automation Inquiry', 'AI Lead', 'Test Lead'],
      source: 'AIME Agent Test',
      customFields: {
        'inquiry_type': 'Voice Automation',
        'inquiry_date': new Date().toISOString(),
        'notes': 'Lead inquired about voice automation services. Follow-up needed to discuss AI implementation.'
      }
    };

    console.log('👤 Creating contact:', leadData.firstName, leadData.lastName);
    console.log('📞 Phone:', leadData.phone);
    console.log('🏷️  Tags:', leadData.tags.join(', '));
    console.log('\n⏳ Creating in GHL...\n');

    // Create the contact
    const contact = await plugin.contacts.createContact(locationId, leadData);

    if (contact) {
      console.log('✅ SUCCESS! Contact created:\n');
      console.log('   Contact ID:', contact.id);
      console.log('   Name:', contact.contactName || `${contact.firstName} ${contact.lastName}`);
      console.log('   Phone:', contact.phone);
      console.log('   Email:', contact.email);
      console.log('   Tags:', contact.tags?.join(', ') || 'None');
      console.log('\n📋 Next Steps:');
      console.log('   1. ✅ Contact created in GHL');
      console.log('   2. 📞 Ready for outbound call');
      console.log('   3. 📅 Can schedule appointment');
      console.log('   4. 💬 Can send follow-up messages\n');

      // Try to get the contact to verify
      console.log('🔍 Verifying contact creation...\n');
      const verifyContact = await plugin.contacts.getContact(locationId, contact.id);

      if (verifyContact) {
        console.log('✅ Contact verified in GHL database!');
        console.log('\n🎯 Test Result: GHL Integration FULLY OPERATIONAL\n');
        return contact;
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nFull error:', error);
    throw error;
  }
}

// Run the test
testCreateLead()
  .then(contact => {
    console.log('\n✨ Test completed successfully!');
    console.log(`\n📱 You can now use Telegram to send commands like:`);
    console.log(`"Get details for contact ${contact.id}"`);
    console.log(`"Create a follow-up task for Joe Testing"`);
    console.log(`"Send SMS to Joe Testing about voice automation"`);
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test failed:', error.message);
    process.exit(1);
  });
