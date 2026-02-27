import { Bot } from 'grammy';
import { getActiveSubscribers, isNewsDelivered, markNewsDelivered, updateSubscriberStatus } from './kv-store.js';
import { formatHIGHMessage, formatMEDMessage, isQuietHours, shouldSendInQuietHours } from './message-formatter.js';
import { CYCLE_LIMITS } from './config.js';

const bot = new Bot(process.env.BOT_TOKEN);

export async function getRecipients(impactCategory) {
  const subscribers = await getActiveSubscribers();
  
  // Filter berdasarkan preferensi
  return subscribers.filter(sub => {
    const filters = sub.preferences?.impact_filter || ['HIGH', 'MED'];
    return filters.includes(impactCategory);
  });
}

export async function sendMessageWithRetry(chatId, message, maxRetries = 1) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      await bot.api.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      return { success: true, error: null };
    } catch (error) {
      console.error(`Send attempt ${attempt} failed for ${chatId}:`, error.message);
      
      // Cek error type
      if (error.message.includes('bot was blocked')) {
        await updateSubscriberStatus(
          chatId > 0 ? 'user' : 'group',
          chatId,
          'blocked'
        );
        return { success: false, error: 'blocked' };
      }
      
      if (error.message.includes('chat not found')) {
        await updateSubscriberStatus(
          chatId > 0 ? 'user' : 'group',
          chatId,
          'inactive'
        );
        return { success: false, error: 'not_found' };
      }
      
      if (attempt > maxRetries) {
        return { success: false, error: error.message };
      }
      
      // Wait before retry
      await sleep(1000);
    }
  }
  
  return { success: false, error: 'max_retries_exceeded' };
}

export async function broadcastToAll(articles, executionId) {
  const results = {
    sent: 0,
    skipped_duplicate: 0,
    failed: 0,
    quiet_hours_skipped: 0
  };
  
  const currentHour = new Date().getHours();
  const quietHours = isQuietHours(currentHour);
  
  for (const article of articles) {
    // Skip jika quiet hours dan bukan berita ekstrem
    if (quietHours && !shouldSendInQuietHours(article, currentHour)) {
      results.quiet_hours_skipped++;
      continue;
    }
    
    const recipients = await getRecipients(article.impact_category);
    
    for (const recipient of recipients) {
      const chatId = recipient.identifier;
      
      // Cek dedup per subscriber
      const isDelivered = await isNewsDelivered(article.news_hash, chatId);
      if (isDelivered) {
        results.skipped_duplicate++;
        continue;
      }
      
      // Format message
      const message = article.impact_category === 'HIGH'
        ? formatHIGHMessage(article)
        : formatMEDMessage(article);
      
      // Send
      const sendResult = await sendMessageWithRetry(chatId, message);
      
      if (sendResult.success) {
        await markNewsDelivered(article.news_hash, chatId, { execution_id: executionId });
        results.sent++;
        
        // Update subscriber stats
        if (recipient.delivery_stats) {
          recipient.delivery_stats.last_success = new Date().toISOString();
          recipient.delivery_stats.success_count_7d = 
            (recipient.delivery_stats.success_count_7d || 0) + 1;
        }
      } else {
        results.failed++;
        
        if (recipient.delivery_stats) {
          recipient.delivery_stats.last_attempt = new Date().toISOString();
          recipient.delivery_stats.fail_count_7d = 
            (recipient.delivery_stats.fail_count_7d || 0) + 1;
        }
      }
      
      // Rate limiting: delay antar pesan
      await sleep(300);
    }
  }
  
  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}