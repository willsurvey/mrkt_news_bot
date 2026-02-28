import crypto from 'crypto';
import { isNewsDispatched, isNewsDelivered, markNewsDispatched } from './kv-store.js';

// ==================== HASH GENERATION ====================
export function generateNewsHash(article) {
  // Primary: hash dari URL (FIX: validate URL first)
  if (article.link && article.link.trim()) {
    const normalizedUrl = article.link.toLowerCase().trim();
    return crypto.createHash('sha256').update(normalizedUrl).digest('hex').slice(0, 16);
  }
  
  // Fallback: hash dari title + pubDate + source
  const content = `${article.canonical_title}|${article.pubDate_hour}|${article.source_domain}`;
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function generateCrossSourceHash(articles) {
  // Untuk deteksi berita sama dari sumber berbeda
  const grouped = {};
  
  for (const article of articles) {
    // FIX: Skip if canonical_title is empty
    if (!article.canonical_title) continue;
    
    const key = article.canonical_title;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(article);
  }
  
  return grouped;
}

// ==================== DUPLICATE CHECKING ====================
export async function checkDuplicate(newsHash) {
  return await isNewsDispatched(newsHash);
}

export async function checkCrossSourceDuplicate(articles) {
  const grouped = generateCrossSourceHash(articles);
  const duplicates = [];
  
  for (const [title, articleGroup] of Object.entries(grouped)) {
    if (articleGroup.length > 1) {
      // Ada berita sama dari multiple sources
      // Pilih yang dari sumber tier tertinggi
      const tierOrder = { 'CORE': 1, 'SUPPORT': 2, 'NOISE': 3 };
      articleGroup.sort((a, b) => tierOrder[a.source_tier] - tierOrder[b.source_tier]);
      
      // Tandai yang lain sebagai duplicate
      for (let i = 1; i < articleGroup.length; i++) {
        duplicates.push({
          article: articleGroup[i],
          reason: 'cross_source_duplicate',
          kept: articleGroup[0]
        });
      }
    }
  }
  
  return duplicates;
}

// ==================== MARK AS DISPATCHED ====================
export async function markAsDispatched(article, executionId) {
  const newsHash = generateNewsHash(article);
  
  await markNewsDispatched(newsHash, {
    impact_category: article.impact_category,
    source_tier: article.source_tier,
    topic_tags: [],
    execution_id: executionId
  });
  
  return newsHash;
}

// ==================== FILTER DUPLICATES ====================
export async function filterDuplicates(articles, executionId) {
  const unique = [];
  const duplicates = [];
  
  // FIX: Use Map for O(1) lookup instead of findIndex
  const uniqueMap = new Map();
  
  for (const article of articles) {
    const newsHash = generateNewsHash(article);
    const isDup = await checkDuplicate(newsHash);
    
    if (isDup) {
      duplicates.push({
        article,
        reason: 'already_dispatched',
        news_hash: newsHash
      });
    } else {
      unique.push(article);
      uniqueMap.set(article.link, article);
    }
  }
  
  // Cek cross-source duplicate
  const crossSourceDups = await checkCrossSourceDuplicate(unique);
  
  for (const dup of crossSourceDups) {
    // FIX: Use Map for O(1) lookup
    if (uniqueMap.has(dup.article.link)) {
      uniqueMap.delete(dup.article.link);
      duplicates.push(dup);
    }
  }
  
  // Convert Map back to array
  const finalUnique = Array.from(uniqueMap.values());
  
  return { unique: finalUnique, duplicates };
}