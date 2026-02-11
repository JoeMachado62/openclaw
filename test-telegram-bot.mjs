#!/usr/bin/env node
/**
 * Get Telegram bot info - find the bot username
 */

import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function getBotInfo() {
  console.log('🤖 Fetching Telegram bot information...\n');

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getMe`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const bot = data.result;

    console.log('✅ Bot Information:\n');
    console.log(`   Bot ID: ${bot.id}`);
    console.log(`   Bot Name: ${bot.first_name}`);
    console.log(`   Username: @${bot.username}`);
    console.log(`   Can Join Groups: ${bot.can_join_groups}`);
    console.log(`   Can Read All Group Messages: ${bot.can_read_all_group_messages}`);
    console.log(`   Supports Inline Queries: ${bot.supports_inline_queries}`);
    console.log('\n📱 To test the bot:');
    console.log(`   1. Open Telegram and search for: @${bot.username}`);
    console.log(`   2. Send the bot a /start message to begin pairing`);
    console.log(`   3. Once paired, you can send commands like:`);
    console.log(`      "Create a contact in GHL: Joe Testing, 850-842-8707"`);
    console.log(`      "Get contact details for ll0CKQTZeHNXS7hPVD4m"`);
    console.log('\n🔗 Direct bot link:');
    console.log(`   https://t.me/${bot.username}\n`);

    return bot;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

getBotInfo()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
