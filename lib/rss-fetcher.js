import Parser from 'rss-parser';
import { RSS_SOURCES } from './config.js';
import { getCircuitBreaker, incrementSourceFailure } from './kv-store.js';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['media:content', 'mediaContent'],
      ['media:description', 'mediaDescription'],
      ['media:title', 'mediaTitle']
    ]
  },
  headers: {
    'User-Agent': 'Market News Bot/1.0'
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
    
    const articles = feed.items.map(item => {
      // Extract title - handle CDATA
      let title = item.title || '';
      title = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      
      // Extract link
      const link = item.link || '';
      
      // Extract description - try multiple sources
      let description = '';
      if (item.content) {
        description = item.content;
      } else if (item.contentSnippet) {
        description = item.contentSnippet;
      } else if (item.mediaDescription) {
        description = item.mediaDescription;
      } else if (item.description) {
        description = item.description;
      }
      
      // Clean HTML tags from description
      description = description
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\n+/g, ' ')
        .trim();
      
      // Extract image from media:content if available
      let imageUrl = '';
      if (item.mediaContent) {
        if (typeof item.mediaContent === 'string') {
          imageUrl = item.mediaContent;
        } else if (item.mediaContent.$?.url) {
          imageUrl = item.mediaContent.$.url;
        } else if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
          imageUrl = item.mediaContent[0].$?.url || item.mediaContent[0];
        }
      }
      
      // Extract GUID
      const guid = item.guid || item.link || '';
      
      // Extract pubDate
      const pubDate = item.pubDate || new Date().toISOString();
      
      return {
        title,
        link,
        pubDate,
        description,
        guid,
        imageUrl,
        source: name,
        source_tier: source.tier,
        source_weight: source.weight,
        source_domain: new URL(url).hostname
      };
    }).filter(article => article.title && article.link); // Filter out invalid articles
    
    return {
      success: true,
      source: name,
      articles
    };
  } catch (error) {
    console.error(`RSS fetch error for ${name}:`, error.message);
    await incrementSourceFailure(url);
    
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
  let pubDate;
  try {
    pubDate = new Date(article.pubDate);
    // Handle invalid dates
    if (isNaN(pubDate.getTime())) {
      pubDate = new Date();
    }
  } catch (e) {
    pubDate = new Date();
  }
  
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