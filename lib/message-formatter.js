import { QUIET_HOURS } from './config.js';

// ==================== ESCAPE HELPER ====================
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

// ==================== FORMAT PESAN HIGH ====================
export function formatHIGHMessage(article) {
  const pubDate = new Date(article.pubDate_utc7 || article.pubDate || new Date());

  const pad = (n) => String(n).padStart(2, '0');
  const wib = new Date(pubDate.getTime() + 7 * 60 * 60 * 1000);
  const formattedDate = `${pad(wib.getUTCDate())}/${pad(wib.getUTCMonth() + 1)}/${wib.getUTCFullYear()} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;

  const cleanDesc = (article.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const shortDesc = cleanDesc.length > 200
    ? cleanDesc.substring(0, 200) + '...'
    : cleanDesc || 'Tidak ada deskripsi.';

  const source = escapeMarkdown(article.source || 'Unknown');
  const tier = escapeMarkdown(article.source_tier || '');

  return `🚨 *\\[HIGH IMPACT\\]* ${escapeMarkdown(article.title)}

📰 *Sumber:* ${source} \\(${tier}\\)
⏰ *Waktu:* ${escapeMarkdown(formattedDate)} WIB

_${escapeMarkdown(shortDesc)}_

🔗 [Baca Selengkapnya](${article.link})

⚠️ _Informasi untuk analisis\\. Bukan rekomendasi investasi\\._`;
}

// ==================== FORMAT PESAN MED ====================
export function formatMEDMessage(article) {
  const pubDate = new Date(article.pubDate_utc7 || article.pubDate || new Date());

  const pad = (n) => String(n).padStart(2, '0');
  const wib = new Date(pubDate.getTime() + 7 * 60 * 60 * 1000);
  const formattedDate = `${pad(wib.getUTCDate())}/${pad(wib.getUTCMonth() + 1)} ${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;

  const source = escapeMarkdown(article.source || 'Unknown');

  return `📈 *${escapeMarkdown(article.title)}*

🔗 [Baca Selengkapnya](${article.link})
⏰ ${escapeMarkdown(formattedDate)} WIB \\| 📰 ${source}`;
}

// ==================== FORMAT RINGKASAN (dikirim pertama) ====================
export function formatSummaryMessage(articles) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const timeStr = `${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}`;

  const highCount = articles.filter(a => a.impact_category === 'HIGH').length;
  const medCount = articles.filter(a => a.impact_category === 'MED').length;

  const lines = articles.map((a, i) => {
    const emoji = a.impact_category === 'HIGH' ? '🚨' : '📈';
    const title = escapeMarkdown(
      (a.title || '').length > 80
        ? (a.title || '').substring(0, 80) + '...'
        : (a.title || '')
    );
    return `${i + 1}\\. ${emoji} ${title}`;
  });

  const countLine = highCount > 0
    ? `🚨 *${highCount} berita HIGH IMPACT*`
    : `📈 *${medCount} berita market*`;

  return `📊 *Rangkuman Berita Market*
🕐 Update: ${escapeMarkdown(timeStr)} WIB

${lines.join('\n')}

${countLine} dikirim berikutnya\\.`;
}

// ==================== QUIET HOURS ====================
export function isQuietHours(currentHourWIB) {
  const { START, END } = QUIET_HOURS;
  if (START > END) {
    return currentHourWIB >= START || currentHourWIB < END;
  }
  return currentHourWIB >= START && currentHourWIB < END;
}

export function shouldSendInQuietHours(article) {
  return (article.impact_score || 0) >= 90;
}
