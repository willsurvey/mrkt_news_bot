import { Bot } from 'grammy';
import {
  getActiveSubscribers,
  isNewsDelivered,
  markNewsDelivered,
  updateSubscriberStatus
} from './kv-store.js';
import {
  formatHIGHMessage,
  formatMEDMessage,
  isQuietHours,
  shouldSendInQuietHours
} from './message-formatter.js';

const bot = new Bot(process.env.BOT_TOKEN);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getRecipients(impactCategory) {
  const subscribers = await getActiveSubscribers();
  return subscribers.filter(sub => {
    const filters = sub.preferences?.impact_filter || ['HIGH', 'MED'];
    return filters.includes(impactCategory);
  });
}

export async function sendMessageWithRetry(chatId, message, maxRetries = 1) {
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      await bot.api.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true }
      });
      return { success: true, error: null };
    } catch (error) {
      const errMsg = error.message || '';
      console.error(`Send attempt ${attempt} failed for ${chatId}:`, errMsg);

      if (errMsg.includes('bot was blocked') || errMsg.includes('Forbidden')) {
        await updateSubscriberStatus(
          Number(chatId) > 0 ? 'user' : 'group',
          chatId,
          'blocked'
        ).catch(() => {});
        return { success: false, error: 'blocked' };
      }

      if (errMsg.includes('chat not found') || errMsg.includes('USER_DEACTIVATED')) {
        await updateSubscriberStatus(
          Number(chatId) > 0 ? 'user' : 'group',
          chatId,
          'inactive'
        ).catch(() => {});
        return { success: false, error: 'not_found' };
      }

      if (errMsg.includes('Too Many Requests') || errMsg.includes('retry after')) {
        const retryAfter = error.parameters?.retry_after || 5;
        console.warn(`Rate limited. Waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
      }

      if (attempt > maxRetries) {
        return { success: false, error: errMsg };
      }

      await sleep(1000 * attempt);
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

  const nowWIB = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })
  );
  const currentHourWIB = nowWIB.getHours();
  const quietHours = isQuietHours(currentHourWIB);

  for (const article of articles) {
    if (quietHours && !shouldSendInQuietHours(article)) {
      console.log(`[${executionId}] Quiet hours — skip: ${article.title?.slice(0, 50)}`);
      results.quiet_hours_skipped++;
      continue;
    }

    const recipients = await getRecipients(article.impact_category);
    const newsHash = article.news_hash;

    for (const recipient of recipients) {
      const chatId = recipient.identifier;

      const isDelivered = await isNewsDelivered(newsHash, chatId);
      if (isDelivered) {
        results.skipped_duplicate++;
        continue;
      }

      const message = article.impact_category === 'HIGH'
        ? formatHIGHMessage(article)
        : formatMEDMessage(article);

      const sendResult = await sendMessageWithRetry(chatId, message);

      if (sendResult.success) {
        await markNewsDelivered(newsHash, chatId, { execution_id: executionId });
        results.sent++;
      } else {
        results.failed++;
        console.error(`[${executionId}] Failed to send to ${chatId}: ${sendResult.error}`);
      }

      await sleep(100);
    }
  }

  return results;
}
