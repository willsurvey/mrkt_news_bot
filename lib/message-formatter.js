import { QUIET_HOURS } from './config.js';

// ==================== FORMAT PESAN HIGH ====================
export function formatHIGHMessage(article) {
  const pubDate = new Date(article.pubDate_utc7 || article.pubDate || new Date());
  const formattedDate = pubDate.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });

  // Bersihkan deskripsi dari HTML tags
  const cleanDesc = (article.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const shortDesc = cleanDesc.length > 200
    ? cleanDesc.substring(0, 200) + '...'
    : cleanDesc || 'Tidak ada deskripsi.';

  // FIX: article.source = nama sumber (mis. "CNBC Market")
  //      article.source_tier = tier (mis. "CORE")
  return `🚨 *\\[IMPACT HIGH\\]* ${escapeMarkdown(article.title)}

📰 *Sumber:* ${article.source || 'Unknown'} \\(${article.source_tier || ''}\\)
⏰ *Waktu:* ${formattedDate} WIB

_${escapeMarkdown(shortDesc)}_

🔗 [Baca Selengkapnya](${article.link})

⚠️ _Informasi untuk analisis\\. Bukan rekomendasi investasi\\._`;
}

// ==================== FORMAT PESAN MED ====================
export function formatMEDMessage(article) {
  const pubDate = new Date(article.pubDate_utc7 || article.pubDate || new Date());
  const formattedDate = pubDate.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });

  return `📈 *${escapeMarkdown(article.title)}*

🔗 [Baca Selengkapnya](${article.link})
⏰ ${formattedDate} WIB \\| 📰 ${article.source || 'Unknown'}`;
}

// ==================== QUIET HOURS ====================

/**
 * Cek apakah jam saat ini adalah quiet hours (WIB).
 * Quiet hours: START (22:00) — END (06:00)
 */
export function isQuietHours(currentHourWIB) {
  const { START, END } = QUIET_HOURS;
  // Quiet hours melewati tengah malam: 22, 23, 0, 1, 2, 3, 4, 5
  if (START > END) {
    return currentHourWIB >= START || currentHourWIB < END;
  }
  return currentHourWIB >= START && currentHourWIB < END;
}

/**
 * Di quiet hours, hanya kirim berita dengan kata kunci EXTREME
 * (berita yang sangat mendesak dan tidak bisa ditunda).
 */
export function shouldSendInQuietHours(article) {
  // Kirim jika impact_score sangat tinggi (mis. > 90) atau ada kata kunci extreme
  return (article.impact_score || 0) >= 90;
}

// ==================== HELPER ====================

/**
 * Escape karakter khusus Markdown v2 Telegram.
 * Hanya untuk konten plaintext, jangan pakai di dalam URL atau *bold*.
 */
function escapeMarkdown(text) {
  if (!text) return '';
  // Karakter yang perlu di-escape di MarkdownV2: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}
