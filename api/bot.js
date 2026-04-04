import { Bot, webhookCallback } from 'grammy';
import {
  handleStart,
  handleSubscribe,
  handleUnsubscribe,
  handleStatus,
  handleHelp,
  handleAdminStats,
  handleAdminSubscribers,
  handleNews,
  handleAdminExport
} from './handlers.js';
import { addUser, addGroup } from '../lib/kv-store.js';

// ==================== BOT SETUP ====================
const bot = new Bot(process.env.BOT_TOKEN);

// Command handlers
bot.command('start', handleStart);
bot.command('subscribe', handleSubscribe);
bot.command('unsubscribe', handleUnsubscribe);
bot.command('status', handleStatus);
bot.command('help', handleHelp);
bot.command('news', handleNews);

bot.command('admin', async (ctx) => {
  const args = (ctx.match || '').trim().split(/\s+/);
  const subCommand = args[0];

  if (subCommand === 'stats') {
    await handleAdminStats(ctx);
  } else if (subCommand === 'subscribers') {
    await handleAdminSubscribers(ctx);
  } else if (subCommand === 'export') {
    await handleAdminExport(ctx);
  } else {
    await ctx.reply(
      '❌ Command tidak dikenali\\. Gunakan /help untuk daftar perintah\\.',
      { parse_mode: 'MarkdownV2' }
    );
  }
});

// Auto-save user/group saat berinteraksi
bot.on('message', async (ctx) => {
  const chatId = ctx.chat.id;
  try {
    if (ctx.chat.type === 'private') {
      await addUser(chatId);
    } else if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
      await addGroup(chatId);
    }
  } catch (error) {
    console.error('Message handler error:', error);
  }
});

// Error handler global
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error handling update ${ctx.update.update_id}:`, err.error);
});

// ==================== VERCEL SERVERLESS HANDLER ====================
const handleUpdate = webhookCallback(bot, 'std/http');

export async function POST(req) {
  try {
    return await handleUpdate(req);
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'Bot is running! 🤖',
      token_set: !!process.env.BOT_TOKEN
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
