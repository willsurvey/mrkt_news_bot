import Parser from 'rss-parser';
import { RSS_SOURCES, ARTICLE_FILTER } from './config.js';
import { getCircuitBreaker, incrementSourceFailure } from './kv-store.js';
import crypto from 'crypto';

// ==================== PARSER CONFIG (Adopsi dari kode Anda) ====================
const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['dc:creator', 'creator'],
      ['enclosure', 'enclosure']
    ]
  },
  headers: {
    'User-Agent': 'Market News Bot/1.0 (Market Sentiment Aggregator)'
  }
});

// ==================== HELPER FUNCTIONS ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// FIX: strip() sederhana seperti kode Anda
function strip(html) {
  return html
    ?.replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ==================== PER-SOURCE EXTRACTION RULES (Adopsi dari kode Anda) ====================
const extractionRules = {
  COMMON: (i) => ({
    guid: i.guid || i.link,
    title: i.title?.trim() || '',
    pubDate: i.pubDate,
    link: i.link || ''
  }),

  'CNBC Market': (i) => ({
    description: strip(i.contentSnippet || ''),
    content: strip(i.contentEncoded || ''),
    imageUrl: i.mediaContent?.$?.url || null
  }),

  'Bloomberg Technoz': (i) => ({
    description: strip(i.contentSnippet || ''),
    content: strip(i.contentEncoded || ''),
    imageUrl: i.mediaContent?.$?.url || null
  }),

  'Antara Ekonomi': (i) => ({
    description: strip(i.contentSnippet || ''),
    content: strip(i.contentEncoded || ''),
    imageUrl: i.mediaContent?.$?.url || null
  }),

  'Tempo Bisnis': (i) => ({
    description: i.contentSnippet || '',
    content: null,
    imageUrl: i.img || null
  }),

  'CNN Ekonomi': (i) => ({
    description: strip(i.contentEncoded || ''),
    content: null,
    imageUrl: i.enclosure?.url || null
  }),

  'Detik Finance': (i) => ({
    description: strip(i.contentEncoded || ''),
    content: null,
    imageUrl: i.enclosure?.url || null
  }),

  'Liputan6 Saham': (i) => ({
    description: i.contentSnippet || '',
    content: null,
    imageUrl: i.enclosure?.url || i.mediaContent?.url || i.mediaThumbnail?.url || null
  }),

  'Republika Ekonomi': (i) => ({
    description: strip(i.description || ''),
    content: strip(i.contentEncoded || ''),
    imageUrl: i.mediaContent?.$?.url || null,
    author: i.creator || null
  }),

  'Investing.com': (i) => ({
    description: null,
    content: null,
    imageUrl: i.enclosure?.url || null,
    author: i.author || null
  })
};

// ==================== FETCH WITH TIMEOUT ====================
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Market News Bot/1.0 (Market Sentiment Aggregator)'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ==================== FETCH RSS ====================
export async function fetchRSS(source, maxRetries = 2) {
  const { url, timeout, name, tier, weight } = source;
  const trimmedUrl = url.trim();
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // FIX: Use fetch + parseString (avoid AbortController conflict)
      const xmlContent = await fetchWithTimeout(trimmedUrl, timeout);
      const feed = await parser.parseString(xmlContent);
      
      // Validate feed structure
      if (!feed || !feed.items) {
        throw new Error('Invalid RSS feed structure');
      }
      
      // Handle items as object or array
      let items = feed.items;
      if (!Array.isArray(items)) {
        items = [items];
      }
      
      // Time-based filtering
      const now = Date.now();
      const maxAgeMs = ARTICLE_FILTER.MAX_AGE_HOURS * 60 * 60 * 1000;
      
      const articles = items
        .filter(item => {
          if (!item) return false;
          if (!item.pubDate) return true;
          const pubTime = new Date(item.pubDate).getTime();
          if (isNaN(pubTime)) return true;
          if (ARTICLE_FILTER.SKIP_FUTURE_DATE && pubTime > now) return false;
          return (now - pubTime) <= maxAgeMs;
        })
        .map(item => {
          // APPLY PER-SOURCE EXTRACTION RULES (Ini inti adopsi logika Anda)
          const common = extractionRules.COMMON(item);
          const specific = extractionRules[name]?.(item) || {};
          
          // Safe source_domain parsing
          let source_domain = 'unknown';
          try {
            source_domain = new URL(trimmedUrl).hostname;
          } catch (e) {
            console.warn(`Invalid URL for ${name}: ${trimmedUrl}`);
          }
          
          return {
            ...common,
            ...specific,
            description: specific.description || strip(item.description || ''),
            source: name,
            source_tier: tier,
            source_weight: weight,
            source_domain
          };
        })
        .filter(article => article.title && (article.link || article.guid));
      
      return {
        success: true,
        source: name,
        articles,
        count: articles.length
      };
    } catch (error) {
      console.error(`RSS fetch error for ${name} (attempt ${attempt}):`, error.message);
      
      if (attempt > maxRetries) {
        if (error.name !== 'AbortError' && !error.message.includes('HTTP')) {
          await incrementSourceFailure(trimmedUrl);
        }
        
        return {
          success: false,
          source: name,
          error: error.message,
          errorType: error.name,
          articles: []
        };
      }
      
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}

// ==================== FETCH ALL SOURCES ====================
export async function fetchAllSources() {
  const allSources = [
    ...RSS_SOURCES.CORE,
    ...RSS_SOURCES.SUPPORT,
    ...RSS_SOURCES.NOISE
  ];
  
  const results = [];
  const overallTimeoutMs = 50000;
  const overallTimeoutId = setTimeout(() => {
    console.warn('⚠️ Overall timeout reached');
  }, overallTimeoutMs);
  
  try {
    for (const tier of ['CORE', 'SUPPORT', 'NOISE']) {
      const sources = allSources.filter(s => s.tier === tier);
      if (sources.length === 0) continue;
      
      console.log(`Fetching ${tier} tier sources: ${sources.map(s => s.name).join(', ')}`);
      
      const tierPromises = sources.map(async (source) => {
        const breaker = await getCircuitBreaker(source.url);
        if (breaker?.skip_until && new Date(breaker.skip_until) > new Date()) {
          console.log(`⚡ Skipping ${source.name} - circuit breaker active until ${breaker.skip_until}`);
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
      
      tierResults.forEach((result, index) => {
        const sourceName = sources[index]?.name || 'unknown';
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            console.log(`✓ ${sourceName}: ${result.value.count} articles`);
          } else {
            console.log(`✗ ${sourceName}: ${result.value.error}`);
          }
        } else {
          console.error(`✗ ${sourceName}: Promise rejected - ${result.reason}`);
          results.push({
            success: false,
            source: sourceName,
            error: result.reason?.message || 'Unknown error',
            articles: []
          });
        }
      });
    }
    
    const totalArticles = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.articles.length, 0);
      
    console.log(`\n📊 Fetch complete: ${results.filter(r => r.success).length}/${results.length} sources OK, ${totalArticles} total articles`);
    
    return results;
  } finally {
    clearTimeout(overallTimeoutId);
  }
}

// ==================== NORMALIZE ARTICLE ====================
export function normalizeArticle(article) {
  let pubDate;
  try {
    pubDate = new Date(article.pubDate);
    if (isNaN(pubDate.getTime())) {
      pubDate = new Date();
    }
  } catch (e) {
    pubDate = new Date();
  }
  
  const now = Date.now();
  const maxAge = ARTICLE_FILTER.MAX_AGE_HOURS * 60 * 60 * 1000;
  if (pubDate.getTime() > now || (now - pubDate.getTime()) > maxAge) {
    console.warn(`Article "${article.title}" has suspicious date: ${article.pubDate}`);
  }
  
  const utc7Date = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  const canonicalTitle = article.title
    .toLowerCase()
    .replace(/[^\w\s\u0080-\uFFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  const stockCodes = article.title.match(/\b[A-Z]{4}\b/g) || [];
  
  return {
    ...article,
    pubDate_utc7: utc7Date.toISOString(),
    pubDate_hour: utc7Date.toISOString().slice(0, 13),
    canonical_title: canonicalTitle,
    stock_codes: stockCodes,
    candidate_id: `${canonicalTitle}|${article.pubDate_hour}|${article.source_domain}`,
    content_hash: crypto.createHash('md5')
      .update(`${canonicalTitle}|${article.description?.slice(0, 100) || ''}`)
      .digest('hex')
      .slice(0, 16)
  };
}