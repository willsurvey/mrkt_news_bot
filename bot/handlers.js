import { isAdmin, addUser, addGroup, getSubscriber, updateSubscriberStatus, getAllSubscribers } from '../lib/kv-store.js';

export async function handleStart(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  
  let message = `👋 *Selamat datang di Bot Berita Market!*

Bot ini mengirimkan berita terkini terkait sentimen pasar saham, ekonomi, dan finansial Indonesia.

📰 *Sumber Berita:*
• CNBC Indonesia Market
• Bloomberg Technoz
• Antara News Ekonomi
• Tempo Bisnis
• CNN Indonesia Ekonomi
• Investing.com
• Detik Finance
• Liputan6 Saham
• Republika Ekonomi

🔔 *Cara Pakai:*
/subscribe - Daftar notifikasi otomatis
/news - Ambil berita terbaru manual
/unsubscribe - Berhenti berlangganan
/status - Cek status subscription
/help - Daftar perintah

⚠️ *Disclaimer:* Berita ini untuk informasi, bukan rekomendasi investasi.`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleSubscribe(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  
  try {
    if (chatType === 'private') {
      await addUser(chatId);
      await ctx.reply(
        `✅ *Berhasil berlangganan!*

Anda akan menerima notifikasi berita market secara otomatis.

ID Anda: \`${chatId}\`

Gunakan /unsubscribe untuk berhenti.`,
        { parse_mode: 'Markdown' }
      );
    } else if (chatType === 'group' || chatType === 'supergroup') {
      await addGroup(chatId);
      await ctx.reply(
        `✅ *Grup ini berhasil berlangganan!*

Grup ID: \`${chatId}\`

Gunakan /unsubscribe untuk berhenti.`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (error) {
    console.error('Subscribe error:', error);
    await ctx.reply('❌ Gagal mendaftar. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
}

export async function handleUnsubscribe(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  
  try {
    const type = chatType === 'private' ? 'user' : 'group';
    await updateSubscriberStatus(type, chatId, 'inactive');
    
    await ctx.reply(
      `✅ *Berhenti berlangganan.*

Anda tidak akan lagi menerima notifikasi otomatis.

Gunakan /subscribe untuk mendaftar kembali.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Unsubscribe error:', error);
    await ctx.reply('❌ Gagal berhenti berlangganan. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
}

export async function handleStatus(ctx) {
  const chatId = ctx.chat.id;
  const chatType = ctx.chat.type;
  
  try {
    const type = chatType === 'private' ? 'user' : 'group';
    const subscriber = await getSubscriber(type, chatId);
    
    if (!subscriber) {
      await ctx.reply('❌ Anda belum terdaftar. Gunakan /subscribe untuk mendaftar.', { parse_mode: 'Markdown' });
      return;
    }
    
    const statusEmoji = subscriber.status === 'active' ? '✅' : '❌';
    
    await ctx.reply(
      `📊 *Status Subscription*

${statusEmoji} Status: ${subscriber.status.toUpperCase()}
📅 Terdaftar: ${new Date(subscriber.created_at).toLocaleDateString('id-ID')}
🔔 Filter: ${subscriber.preferences?.impact_filter?.join(', ') || 'HIGH, MED'}

Gunakan /unsubscribe untuk berhenti berlangganan.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Status error:', error);
    await ctx.reply('❌ Gagal cek status. Silakan coba lagi.', { parse_mode: 'Markdown' });
  }
}

export async function handleHelp(ctx) {
  const message = `📚 *Daftar Perintah*

*Public Commands:*
/start - Sambutan dan instruksi
/subscribe - Daftar notifikasi otomatis
/unsubscribe - Berhenti berlangganan
/status - Cek status subscription
/help - Tampilkan bantuan ini

*Admin Commands:*
/admin stats - Lihat statistik sistem
/admin subscribers - List subscriber
/admin export - Download CSV subscriber list

⚠️ *Disclaimer:*
Berita ini untuk informasi, bukan rekomendasi investasi. Lakukan riset mandiri sebelum mengambil keputusan.`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

export async function handleAdminStats(ctx) {
  const userId = ctx.from.id;
  
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Akses ditolak. Admin only.', { parse_mode: 'Markdown' });
    return;
  }
  
  try {
    const subscribers = await getAllSubscribers();
    const users = subscribers.filter(s => s.subscriber_type === 'user');
    const groups = subscribers.filter(s => s.subscriber_type === 'group');
    
    await ctx.reply(
      `📊 *Statistik Sistem*

👥 Total Subscriber: ${subscribers.length}
• Individual: ${users.length}
• Grup: ${groups.length}

✅ Aktif: ${subscribers.filter(s => s.status === 'active').length}
❌ Blocked: ${subscribers.filter(s => s.status === 'blocked').length}
⏸️ Inactive: ${subscribers.filter(s => s.status === 'inactive').length}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Admin stats error:', error);
    await ctx.reply('❌ Gagal ambil statistik.', { parse_mode: 'Markdown' });
  }
}

export async function handleAdminSubscribers(ctx) {
  const userId = ctx.from.id;
  
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Akses ditolak. Admin only.', { parse_mode: 'Markdown' });
    return;
  }
  
  try {
    const subscribers = await getAllSubscribers();
    
    if (subscribers.length === 0) {
      await ctx.reply('📭 Belum ada subscriber.');
      return;
    }
    
    // Show first 20
    const list = subscribers.slice(0, 20).map((s, i) => 
      `${i + 1}. \`${s.identifier}\` | ${s.subscriber_type} | ${s.status}`
    ).join('\n');
    
    await ctx.reply(
      `📋 *Subscriber List* (20/${subscribers.length})

${list}

_Gunakan /admin export untuk download lengkap._`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Admin subscribers error:', error);
    await ctx.reply('❌ Gagal ambil list subscriber.', { parse_mode: 'Markdown' });
  }
}