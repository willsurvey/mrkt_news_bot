import {
  isAdmin,
  addUser,
  addGroup,
  getSubscriber,
  updateSubscriberStatus,
  getAllSubscribers
} from '../lib/kv-store.js';
import { fetchAllSources, normalizeArticle } from '../lib/rss-fetcher.js';
import { scoreArticle } from '../lib/impact-scorer.js';
import { filterDuplicates } from '../lib/dedup.js';
import { selectFinalArticles } from '../lib/priority-engine.js';
import { formatHIGHMessage, formatMEDMessage } from '../lib/message-formatter.js';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== /start ====================
export async function handleStart(ctx) {
  const message = `👋 *Selamat datang di Bot Berita Market\\!*

Bot ini mengirimkan berita terkini terkait sentimen pasar saham, ekonomi, dan finansial Indonesia\\.

📰 *Sumber Berita:*
• CNBC Indonesia Market
• Bloomberg Technoz
• Antara News Ekonomi
• Tempo Bisnis
• CNN Indonesia Ekonomi
• Detik Finance
• Liputan6 Saham

🔔 *Cara Pakai:*
/subscribe \\- Daftar notifikasi otomatis
/news \\- Ambil berita terbaru manual
/unsubscribe \\- Berhenti berlangganan
/status \\- Cek status subscription
/help \\- Daftar perintah

⚠️ _Disclaimer: Berita ini untuk informasi, bukan rekomendasi investasi\\._`;

  await ctx.reply(message, { parse_mode: 'MarkdownV2' });
}

// ==================== /subscribe ====================
export async function handleSubscribe(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;

  try {
    if (chatType === 'private') {
      await addUser(chatId);
      await ctx.reply(
        `✅ *Berhasil berlangganan\\!*\n\nAnda akan menerima notifikasi berita market secara otomatis\\.\n\nID Anda: \`${chatId}\`\n\nGunakan /unsubscribe untuk berhenti\\.`,
        { parse_mode: 'MarkdownV2' }
      );
    } else if (chatType === 'group' || chatType === 'supergroup') {
      await addGroup(chatId);
      await ctx.reply(
        `✅ *Grup ini berhasil berlangganan\\!*\n\nGrup ID: \`${chatId}\`\n\nGunakan /unsubscribe untuk berhenti\\.`,
        { parse_mode: 'MarkdownV2' }
      );
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    await ctx.reply('❌ Gagal mendaftar\\. Silakan coba lagi\\.', { parse_mode: 'MarkdownV2' });
  }
}

// ==================== /unsubscribe ====================
export async function handleUnsubscribe(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;

  try {
    const type = chatType === 'private' ? 'user' : 'group';
    await updateSubscriberStatus(type, chatId, 'inactive');
    await ctx.reply(
      `✅ *Berhenti berlangganan\\.*\n\nAnda tidak akan lagi menerima notifikasi otomatis\\.\n\nGunakan /subscribe untuk mendaftar kembali\\.`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('Unsubscribe error:', error);
    await ctx.reply('❌ Gagal berhenti berlangganan\\. Silakan coba lagi\\.', { parse_mode: 'MarkdownV2' });
  }
}

// ==================== /status ====================
export async function handleStatus(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;

  try {
    const type = chatType === 'private' ? 'user' : 'group';
    const subscriber = await getSubscriber(type, chatId);

    if (!subscriber) {
      await ctx.reply(
        '❌ Anda belum terdaftar\\. Gunakan /subscribe untuk mendaftar\\.',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    const statusEmoji = subscriber.status === 'active' ? '✅' : '❌';
    const registeredDate = new Date(subscriber.created_at).toLocaleDateString('id-ID');
    const filters = (subscriber.preferences?.impact_filter || ['HIGH', 'MED']).join(', ');

    await ctx.reply(
      `📊 *Status Subscription*\n\n${statusEmoji} Status: *${subscriber.status.toUpperCase()}*\n📅 Terdaftar: ${registeredDate}\n🔔 Filter: ${filters}\n\nGunakan /unsubscribe untuk berhenti berlangganan\\.`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('Status error:', error);
    await ctx.reply('❌ Gagal cek status\\. Silakan coba lagi\\.', { parse_mode: 'MarkdownV2' });
  }
}

// ==================== /help ====================
export async function handleHelp(ctx) {
  const message = `📚 *Daftar Perintah*

*Public Commands:*
/start \\- Sambutan dan instruksi
/subscribe \\- Daftar notifikasi otomatis
/unsubscribe \\- Berhenti berlangganan
/status \\- Cek status subscription
/help \\- Tampilkan bantuan ini
/news \\- Ambil berita terbaru manual

*Admin Commands:*
/admin stats \\- Lihat statistik sistem
/admin subscribers \\- List subscriber
/admin export \\- Download CSV subscriber list

⚠️ *Disclaimer:*
_Berita ini untuk informasi, bukan rekomendasi investasi\\. Lakukan riset mandiri sebelum mengambil keputusan\\._`;

  await ctx.reply(message, { parse_mode: 'MarkdownV2' });
}

// ==================== /admin stats ====================
export async function handleAdminStats(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Akses ditolak\\. Admin only\\.', { parse_mode: 'MarkdownV2' });
    return;
  }

  try {
    const subscribers = await getAllSubscribers();
    const users = subscribers.filter(s => s.subscriber_type === 'user');
    const groups = subscribers.filter(s => s.subscriber_type === 'group');
    const active = subscribers.filter(s => s.status === 'active').length;
    const blocked = subscribers.filter(s => s.status === 'blocked').length;
    const inactive = subscribers.filter(s => s.status === 'inactive').length;

    await ctx.reply(
      `📊 *Statistik Sistem*\n\n👥 Total Subscriber: *${subscribers.length}*\n• Individual: ${users.length}\n• Grup: ${groups.length}\n\n✅ Aktif: ${active}\n🚫 Blocked: ${blocked}\n⏸️ Inactive: ${inactive}`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('Admin stats error:', error);
    await ctx.reply('❌ Gagal ambil statistik\\.', { parse_mode: 'MarkdownV2' });
  }
}

// ==================== /admin subscribers ====================
export async function handleAdminSubscribers(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Akses ditolak\\. Admin only\\.', { parse_mode: 'MarkdownV2' });
    return;
  }

  try {
    const subscribers = await getAllSubscribers();

    if (subscribers.length === 0) {
      await ctx.reply('📭 Belum ada subscriber\\.');
      return;
    }

    const list = subscribers
      .slice(0, 20)
      .map((s, i) => `${i + 1}\\. \`${s.identifier}\` \\| ${s.subscriber_type} \\| ${s.status}`)
      .join('\n');

    await ctx.reply(
      `📋 *Subscriber List* \\(20/${subscribers.length}\\)\n\n${list}\n\n_Gunakan /admin export untuk download lengkap\\._`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('Admin subscribers error:', error);
    await ctx.reply('❌ Gagal ambil list subscriber\\.', { parse_mode: 'MarkdownV2' });
  }
}

// ==================== /news ====================
export async function handleNews(ctx) {
  try {
    await ctx.reply('📰 *Mengambil berita terbaru\\.\\.\\.*', { parse_mode: 'MarkdownV2' });

    const fetchResults = await fetchAllSources();
    const allArticles = [];

    for (const result of fetchResults) {
      if (result.success) allArticles.push(...result.articles);
    }

    if (allArticles.length === 0) {
      await ctx.reply(
        '❌ *Tidak ada berita yang ditemukan\\.*\n\nMungkin sumber RSS sedang down atau tidak ada update terbaru\\.',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    const normalizedArticles = allArticles.map(normalizeArticle);
    const scoredArticles = normalizedArticles.map(scoreArticle);
    const { unique } = await filterDuplicates(scoredArticles, 'manual');
    const { selected } = selectFinalArticles(unique, 'manual');
    const topNews = selected.slice(0, 5);

    if (topNews.length === 0) {
      await ctx.reply(
        '❌ *Tidak ada berita yang memenuhi kriteria prioritas\\.*',
        { parse_mode: 'MarkdownV2' }
      );
      return;
    }

    for (const article of topNews) {
      const message = article.impact_category === 'HIGH'
        ? formatHIGHMessage(article)
        : formatMEDMessage(article);

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        link_preview_options: { is_disabled: true }
      });

      await sleep(500);
    }

    await ctx.reply(
      `✅ *Berhasil mengirim ${topNews.length} berita terbaru\\.*`,
      { parse_mode: 'MarkdownV2' }
    );
  } catch (error) {
    console.error('News handler error:', error);
    await ctx.reply(
      '❌ *Gagal mengambil berita\\.* Silakan coba lagi nanti\\.',
      { parse_mode: 'MarkdownV2' }
    );
  }
}

// ==================== /admin export ====================
export async function handleAdminExport(ctx) {
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.reply('❌ *Akses ditolak\\.* Admin only\\.', { parse_mode: 'MarkdownV2' });
    return;
  }

  try {
    const subscribers = await getAllSubscribers();

    if (subscribers.length === 0) {
      await ctx.reply('📭 *Belum ada subscriber\\.* ', { parse_mode: 'MarkdownV2' });
      return;
    }

    const csvHeader = 'ID,Tipe,Status,Terdaftar,Filter Impact\n';
    const csvRows = subscribers.map(s =>
      `${s.identifier},${s.subscriber_type},${s.status},${s.created_at},"${(s.preferences?.impact_filter || ['HIGH', 'MED']).join(', ')}"`
    ).join('\n');
    const csv = csvHeader + csvRows;

    // FIX: grammy v2 menggunakan InputFile untuk upload dokumen
    const { InputFile } = await import('grammy');
    const filename = `subscribers_${Date.now()}.csv`;
    const buffer = Buffer.from(csv, 'utf-8');

    await ctx.replyWithDocument(
      new InputFile(buffer, filename),
      {
        caption: `✅ Export berhasil\\! ${subscribers.length} subscriber\\.`,
        parse_mode: 'MarkdownV2'
      }
    );
  } catch (error) {
    console.error('Admin export error:', error);
    await ctx.reply('❌ *Gagal export subscriber\\.* Silakan coba lagi\\.', { parse_mode: 'MarkdownV2' });
  }
}
