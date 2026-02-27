import crypto from 'crypto';
import { isNewsDispatched, isNewsDelivered, markNewsDispatched } from './kv-store.js';

export function generateNewsHash(article) {
  // Primary: hash dari URL
  if (article.link) {
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
    const key = article.canonical_title;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(article);
  }
  
  return grouped;
}

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

export async function filterDuplicates(articles, executionId) {
  const unique = [];
  const duplicates = [];
  
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
    }
  }
  
  // Cek cross-source duplicate
  const crossSourceDups = await checkCrossSourceDuplicate(unique);
  
  for (const dup of crossSourceDups) {
    const index = unique.findIndex(a => a.link === dup.article.link);
    if (index > -1) {
      unique.splice(index, 1);
      duplicates.push(dup);
    }
  }
  
  return { unique, duplicates };
}