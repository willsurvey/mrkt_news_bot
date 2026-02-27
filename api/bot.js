import { Bot } from 'grammy';
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
} from '../bot/handlers.js';
import { addUser, addGroup } from '../lib/kv-store.js';

// Initialize bot with botInfo for serverless
const bot = new Bot(process.env.BOT_TOKEN, {
  botInfo: {
    id: 0,
    is_bot: true,
    first_name: 'Market News Bot',
    username: 'market_news_bot',
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  },
});

// Register command handlers
bot.command('start', handleStart);
bot.command('subscribe', handleSubscribe);
bot.command('unsubscribe', handleUnsubscribe);
bot.command('status', handleStatus);
bot.command('help', handleHelp);
bot.command('news', handleNews);

bot.command('admin', async (ctx) => {
  const args = ctx.match?.split(' ') || [];
  const command = args[0];
  
  if (command === 'stats') {
    await handleAdminStats(ctx);
  } else if (command === 'subscribers') {
    await handleAdminSubscribers(ctx);
  } else if (command === 'export') {
    await handleAdminExport(ctx);
  } else {
    await ctx.reply('❌ Command tidak dikenali. Gunakan /help', { parse_mode: 'Markdown' });
  }
});

// Message handler (untuk auto-save user/group saat chat)
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

// Vercel Serverless Handler (untuk webhook Telegram)
export async function POST(req) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Test endpoint
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'Bot is running! 🤖',
      tokenSet: !!process.env.BOT_TOKEN
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}