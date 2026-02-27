import Parser from 'rss-parser';
import { RSS_SOURCES } from './config.js';
import { getCircuitBreaker, incrementSourceFailure } from './kv-store.js';

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'media:content']
  }
});

export async function fetchRSS(source) {
  const { url, timeout, name } = source;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const feed = await parser.parseURL(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const articles = feed.items.map(item => ({
      title: item.title?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      description: item.contentSnippet || item.content || item.description || '',
      guid: item.guid || item.link || '',
      source: name,
      source_tier: source.tier,
      source_weight: source.weight,
      source_domain: new URL(url).hostname
    }));
    
    return {
      success: true,
      source: name,
      articles
    };
  } catch (error) {
    console.error(`RSS fetch error for ${name}:`, error.message);
    await incrementSourceFailure(source.url);
    
    return {
      success: false,
      source: name,
      error: error.message,
      articles: []
    };
  }
}

export async function fetchAllSources() {
  const allSources = [
    ...RSS_SOURCES.CORE,
    ...RSS_SOURCES.SUPPORT,
    ...RSS_SOURCES.NOISE
  ];
  
  const results = [];
  
  // Fetch dengan prioritas (CORE dulu)
  for (const tier of ['CORE', 'SUPPORT', 'NOISE']) {
    const sources = allSources.filter(s => s.tier === tier);
    
    const tierPromises = sources.map(async (source) => {
      // Cek circuit breaker
      const breaker = await getCircuitBreaker(source.url);
      if (breaker?.skip_until && new Date(breaker.skip_until) > new Date()) {
        console.log(`Skipping ${source.name} due to circuit breaker`);
        return {
          success: false,
          source: source.name,
          error: 'Circuit breaker active',
          articles: []
        };
      }
      
      return await fetchRSS(source);
    });
    
    const tierResults = await Promise.allSettled(tierPromises);
    tierResults.forEach(result => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });
  }
  
  return results;
}

export function normalizeArticle(article) {
  // Normalisasi timestamp ke UTC+7
  const pubDate = new Date(article.pubDate);
  const utc7Date = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  // Generate candidate ID untuk dedup awal
  const canonicalTitle = article.title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return {
    ...article,
    pubDate_utc7: utc7Date.toISOString(),
    pubDate_hour: utc7Date.toISOString().slice(0, 13),
    canonical_title: canonicalTitle,
    candidate_id: `${canonicalTitle}|${article.pubDate_hour}|${article.source_domain}`
  };
}