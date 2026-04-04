import crypto from 'crypto';
import { isNewsDispatched, markNewsDispatched } from './kv-store.js';

// ==================== HASH GENERATION ====================

export function generateNewsHash(article) {
  // Primary: hash dari URL yang sudah dinormalisasi
  if (article.link && article.link.trim()) {
    const normalizedUrl = article.link.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalizedUrl).digest('hex').slice(0, 16);
  }

  // Fallback: hash dari canonical_title + pubDate_hour + source_domain
  const content = `${article.canonical_title || article.title || ''}|${article.pubDate_hour || ''}|${article.source_domain || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Kelompokkan artikel berdasarkan canonical_title untuk deteksi
 * berita yang sama dari sumber berbeda (cross-source duplicate).
 */
function groupByCanonicalTitle(articles) {
  const grouped = new Map();

  for (const article of articles) {
    if (!article.canonical_title) continue;
    const key = article.canonical_title;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(article);
  }

  return grouped;
}

// ==================== MARK AS DISPATCHED ====================

export async function markAsDispatched(article, executionId) {
  const newsHash = article.news_hash || generateNewsHash(article);
  await markNewsDispatched(newsHash, {
    impact_category: article.impact_category,
    source_tier: article.source_tier,
    topic_tags: article.stock_codes || [],
    execution_id: executionId
  });
  return newsHash;
}

// ==================== FILTER DUPLICATES ====================

export async function filterDuplicates(articles, executionId) {
  const unique = [];
  const duplicates = [];

  // Step 1: Hapus artikel yang sudah pernah di-dispatch ke Redis
  for (const article of articles) {
    const newsHash = generateNewsHash(article);
    article.news_hash = newsHash; // Simpan hash ke artikel agar tidak di-generate ulang

    const isDup = await isNewsDispatched(newsHash);
    if (isDup) {
      duplicates.push({ article, reason: 'already_dispatched', news_hash: newsHash });
    } else {
      unique.push(article);
    }
  }

  // Step 2: Hapus cross-source duplicate (berita sama dari sumber berbeda)
  const tierOrder = { CORE: 1, SUPPORT: 2, NOISE: 3 };
  const grouped = groupByCanonicalTitle(unique);

  const finalUniqueMap = new Map(); // key: news_hash

  for (const [, articleGroup] of grouped) {
    if (articleGroup.length === 1) {
      finalUniqueMap.set(articleGroup[0].news_hash, articleGroup[0]);
      continue;
    }

    // Urutkan: tier terbaik dulu, lalu impact_score tertinggi
    articleGroup.sort((a, b) => {
      const tierDiff = (tierOrder[a.source_tier] || 9) - (tierOrder[b.source_tier] || 9);
      if (tierDiff !== 0) return tierDiff;
      return (b.impact_score || 0) - (a.impact_score || 0);
    });

    // Artikel terbaik masuk unique, sisanya jadi duplicate
    finalUniqueMap.set(articleGroup[0].news_hash, articleGroup[0]);
    for (let i = 1; i < articleGroup.length; i++) {
      duplicates.push({
        article: articleGroup[i],
        reason: 'cross_source_duplicate',
        kept: articleGroup[0]
      });
    }
  }

  return {
    unique: Array.from(finalUniqueMap.values()),
    duplicates
  };
}
