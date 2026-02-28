import Parser from 'rss-parser';
import { RSS_SOURCES, ARTICLE_FILTER } from './config.js';
import { getCircuitBreaker, incrementSourceFailure } from './kv-store.js';
import crypto from 'crypto';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'content'],
      ['media:content', 'mediaContent'],
      ['media:description', 'mediaDescription'],
      ['media:title', 'mediaTitle'],
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

function extractImageUrl(item) {
  // Priority 1: media:content with url attribute
  if (item.mediaContent) {
    if (typeof item.mediaContent === 'string') {
      return item.mediaContent;
    } else if (item.mediaContent.$?.url) {
      return item.mediaContent.$.url;
    } else if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
      const first = item.mediaContent[0];
      return first.$?.url || first.url || first;
    }
  }
  
  // Priority 2: enclosure (used by Bloomberg, CNN, etc.)
  if (item.enclosure) {
    if (typeof item.enclosure === 'string') {
      return item.enclosure;
    } else if (item.enclosure.$?.url) {
      return item.enclosure.$.url;
    } else if (item.enclosure.url) {
      return item.enclosure.url;
    } else if (Array.isArray(item.enclosure) && item.enclosure.length > 0) {
      const first = item.enclosure[0];
      return first.$?.url || first.url || first;
    }
  }
  
  // Priority 3: Extract from description HTML <img> tag
  if (item.description || item.content) {
    const html = item.content || item.description;
    // Improved regex: handle single quotes & no quotes
    const imgMatch = html.match(/<img[^>]+src\s*=\s*["']?([^"'>\s]+)["']?/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }
  
  return '';
}

function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGuid(item) {
  if (!item.guid) return item.link || '';
  
  if (typeof item.guid === 'object') {
    return item.guid._ || item.guid.content || item.link || '';
  }
  
  return item.guid;
}

// ==================== FETCH RSS WITH RETRY ====================
export async function fetchRSS(source, maxRetries = 2) {
  const { url, timeout, name } = source;
  const trimmedUrl = url.trim(); // FIX: Trim URL before fetch
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const feed = await parser.parseURL(trimmedUrl, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // FIX: Validate feed.items before .map()
      if (!feed || !feed.items || !Array.isArray(feed.items)) {
        throw new Error('Invalid RSS feed structure: items is not an array');
      }
      
      // Time-based filtering
      const now = Date.now();
      const maxAgeMs = ARTICLE_FILTER.MAX_AGE_HOURS * 60 * 60 * 1000;
      
      const articles = feed.items
        .filter(item => {
          if (!item.pubDate) return true; // Keep if no date
          const pubTime = new Date(item.pubDate).getTime();
          if (isNaN(pubTime)) return true; // Keep if invalid date
          
          // Skip future dates
          if (ARTICLE_FILTER.SKIP_FUTURE_DATE && pubTime > now) {
            return false;
          }
          
          // Skip old articles
          return (now - pubTime) <= maxAgeMs;
        })
        .map(item => {
          let title = item.title || '';
          title = cleanText(title);
          
          const link = item.link || '';
          
          let description = '';
          if (item.content && typeof item.content === 'string') {
            description = item.content;
          } else if (item.contentSnippet) {
            description = item.contentSnippet;
          } else if (item.mediaDescription) {
            description = item.mediaDescription;
          } else if (item.description) {
            description = item.description;
          }
          
          description = cleanText(description);
          
          const imageUrl = extractImageUrl(item);
          const guid = extractGuid(item);
          const pubDate = item.pubDate || new Date().toISOString();
          
          // FIX: Safe URL parsing
          let source_domain = 'unknown';
          try {
            source_domain = new URL(trimmedUrl).hostname;
          } catch (e) {
            console.warn(`Invalid URL for ${name}: ${trimmedUrl}`);
          }
          
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
            source_domain
          };
        })
        .filter(article => {
          return article.title && (article.link || article.guid);
        });
      
      return {
        success: true,
        source: name,
        articles,
        count: articles.length
      };
    } catch (error) {
      console.error(`RSS fetch error for ${name} (attempt ${attempt}):`, error.message);
      
      // Only increment failure after all retries exhausted
      if (attempt > maxRetries) {
        if (error.name !== 'AbortError') {
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
      
      // Exponential backoff before retry
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
  
  // Overall timeout for Vercel 60s limit
  const overallTimeoutMs = 50000;
  const overallController = new AbortController();
  const overallTimeoutId = setTimeout(() => overallController.abort(), overallTimeoutMs);
  
  try {
    for (const tier of ['CORE', 'SUPPORT', 'NOISE']) {
      // Check overall timeout before each tier
      if (overallController.signal.aborted) {
        console.warn('⚠️ Overall timeout reached, skipping remaining tiers');
        break;
      }
      
      const sources = allSources.filter(s => s.tier === tier);
      if (sources.length === 0) continue;
      
      console.log(`Fetching ${tier} tier sources: ${sources.map(s => s.name).join(', ')}`);
      
      const tierPromises = sources.map(async (source) => {
        // Cek circuit breaker
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
  
  // Validate pubDate
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
    // FIX: Use crypto instead of Buffer for serverless compatibility
    content_hash: crypto.createHash('md5')
      .update(`${canonicalTitle}|${article.description?.slice(0, 100)}`)
      .digest('hex')
      .slice(0, 16)
  };
}