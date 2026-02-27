import Parser from 'rss-parser';
import { RSS_SOURCES } from './config.js';
import { getCircuitBreaker, incrementSourceFailure } from './kv-store.js';

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
    const imgMatch = html.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }
  
  return '';
}

function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, '')  // Remove CDATA wrappers
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // Remove scripts
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')    // Remove styles
    .replace(/<[^>]*>/g, '')                              // Remove HTML tags
    .replace(/\n+/g, ' ')                                 // Normalize newlines
    .replace(/\s+/g, ' ')                                 // Normalize spaces
    .trim();
}

function extractGuid(item) {
  if (!item.guid) return item.link || '';
  
  // Handle guid as object with isPermaLink attribute
  if (typeof item.guid === 'object') {
    return item.guid._ || item.guid.content || item.link || '';
  }
  
  return item.guid;
}

export async function fetchRSS(source) {
  const { url, timeout, name } = source;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const feed = await parser.parseURL(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const articles = feed.items
      .map(item => {
        // Extract title - handle CDATA and trim
        let title = item.title || '';
        title = cleanText(title);
        
        // Extract link
        const link = item.link || '';
        
        // Extract description - try multiple sources with priority
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
        
        // Clean description
        description = cleanText(description);
        
        // Extract image
        const imageUrl = extractImageUrl(item);
        
        // Extract GUID (handle object format)
        const guid = extractGuid(item);
        
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
      })
      .filter(article => {
        // Filter: must have title AND (link OR guid)
        return article.title && (article.link || article.guid);
      });
    
    return {
      success: true,
      source: name,
      articles,
      count: articles.length
    };
  } catch (error) {
    console.error(`RSS fetch error for ${name}:`, error.message);
    
    // Only increment failure for network/parse errors, not abort
    if (error.name !== 'AbortError') {
      await incrementSourceFailure(url);
    }
    
    return {
      success: false,
      source: name,
      error: error.message,
      errorType: error.name,
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
  
  // Fetch dengan prioritas tier (CORE dulu, lalu SUPPORT, lalu NOISE)
  for (const tier of ['CORE', 'SUPPORT', 'NOISE']) {
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
    
    // Wait for all sources in this tier
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
}

export function normalizeArticle(article) {
  // Normalisasi timestamp ke UTC+7 (Asia/Jakarta)
  let pubDate;
  try {
    pubDate = new Date(article.pubDate);
    if (isNaN(pubDate.getTime())) {
      pubDate = new Date();
    }
  } catch (e) {
    pubDate = new Date();
  }
  
  // Convert to UTC+7
  const utc7Date = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  
  // Generate canonical title for deduplication
  const canonicalTitle = article.title
    .toLowerCase()
    .replace(/[^\w\s\u0080-\uFFFF]/g, '')  // Keep Unicode chars for Indonesian
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract stock codes (4 uppercase letters) for potential filtering
  const stockCodes = article.title.match(/\b[A-Z]{4}\b/g) || [];
  
  return {
    ...article,
    pubDate_utc7: utc7Date.toISOString(),
    pubDate_hour: utc7Date.toISOString().slice(0, 13), // YYYY-MM-DDTHH for hourly grouping
    canonical_title: canonicalTitle,
    stock_codes: stockCodes,
    candidate_id: `${canonicalTitle}|${article.pubDate_hour}|${article.source_domain}`,
    // Hash for cross-source dedup (simplified - use crypto in production)
    content_hash: Buffer.from(`${canonicalTitle}|${article.description?.slice(0, 100)}`).toString('base64').slice(0, 16)
  };
}