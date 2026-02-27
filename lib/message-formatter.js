export function formatHIGHMessage(article) {
  const pubDate = new Date(article.pubDate_utc7);
  const formattedDate = pubDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
  
  // Clean description
  const cleanDesc = article.description
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const shortDesc = cleanDesc.length > 200 
    ? cleanDesc.substring(0, 200) + '...' 
    : cleanDesc || 'Tidak ada deskripsi';
  
  return `🚨 *[IMPACT HIGH]* ${article.title}

📌 *Topik:* ${article.source}
📍 *Sumber:* ${article.source_tier}
⏰ *Waktu:* ${formattedDate} WIB

_${shortDesc}_

🔗 [Baca Selengkapnya](${article.link})

⚠️ _Ini adalah informasi untuk keperluan analisis. Lakukan riset mandiri sebelum mengambil keputusan investasi._`;
}

export function formatMEDMessage(article) {
  const pubDate = new Date(article.pubDate_utc7);
  const formattedDate = pubDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
  
  return `📈 ${article.title}

🔗 [Baca Selengkapnya](${article.link})
⏰ ${formattedDate} WIB | 📍 ${article.source}`;
}

export function formatQuietHoursMessage(article) {
  const baseMessage = formatHIGHMessage(article);
  return `[QUIET HOURS] ${baseMessage}`;
}

export function shouldSendInQuietHours(article, currentHour) {
  // Hanya kirim berita ekstrem di quiet hours
  const extremeKeywords = ['downgrade', 'krisis', 'intervensi', 'default', 'gagal bayar'];
  const text = `${article.title} ${article.description}`.toLowerCase();
  
  const hasExtreme = extremeKeywords.some(kw => text.includes(kw));
  
  return hasExtreme;
}

export function isQuietHours(currentHour) {
  return currentHour >= 22 || currentHour < 6;
}