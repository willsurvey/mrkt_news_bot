import { fetchAllSources } from '../lib/rss-fetcher.js';
import { normalizeArticle } from '../lib/rss-fetcher.js';
import { scoreArticle } from '../lib/impact-scorer.js';
import { filterDuplicates, markAsDispatched } from '../lib/dedup.js';
import { selectFinalArticles } from '../lib/priority-engine.js';
import { broadcastToAll } from '../lib/broadcast.js';
import { updateHealthCheck } from '../lib/kv-store.js';
import crypto from 'crypto';

export async function GET(req) {
  const executionId = crypto.randomUUID();
  const startedAt = Date.now();
  
  console.log(`[${executionId}] Cron job started`);
  
  try {
    // Step 1: Fetch semua sources
    console.log(`[${executionId}] Fetching RSS sources...`);
    const fetchResults = await fetchAllSources();
    const allArticles = [];
    const fetchMetrics = {
      attempted: fetchResults.length,
      succeeded: 0,
      failed: 0
    };

    for (const result of fetchResults) {
      if (result.success) {
        fetchMetrics.succeeded++;
        allArticles.push(...result.articles);
      } else {
        fetchMetrics.failed++;
        console.error(`[${executionId}] Failed to fetch ${result.source}: ${result.error}`);
      }
    }

    console.log(`[${executionId}] Fetched ${allArticles.length} articles`);

    if (allArticles.length === 0) {
      await updateHealthCheck();
      return new Response(
        JSON.stringify({
          execution_id: executionId,
          status: 'no_articles',
          metrics: { fetch: fetchMetrics }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Normalisasi
    console.log(`[${executionId}] Normalizing articles...`);
    const normalizedArticles = allArticles.map(normalizeArticle);

    // Step 3: Impact scoring
    console.log(`[${executionId}] Scoring articles...`);
    const scoredArticles = normalizedArticles.map(scoreArticle);

    const scoreMetrics = {
      high: scoredArticles.filter(a => a.impact_category === 'HIGH').length,
      med: scoredArticles.filter(a => a.impact_category === 'MED').length,
      low: scoredArticles.filter(a => a.impact_category === 'LOW').length
    };

    console.log(`[${executionId}] Scored: HIGH=${scoreMetrics.high}, MED=${scoreMetrics.med}, LOW=${scoreMetrics.low}`);

    // Step 4: Deduplication
    console.log(`[${executionId}] Filtering duplicates...`);
    const { unique, duplicates } = await filterDuplicates(scoredArticles, executionId);

    console.log(`[${executionId}] After dedup: ${unique.length} unique, ${duplicates.length} duplicates`);

    // Step 5: Priority selection
    console.log(`[${executionId}] Applying priority rules...`);
    const { selected, suppressed, metrics: priorityMetrics } = selectFinalArticles(unique, executionId);

    console.log(`[${executionId}] Selected ${selected.length} articles for broadcast`);

    // Step 6: Add news_hash to articles
    for (const article of selected) {
      const { generateNewsHash } = await import('../lib/dedup.js');
      article.news_hash = generateNewsHash(article);
    }

    // Step 7: Broadcast
    console.log(`[${executionId}] Broadcasting to subscribers...`);
    const broadcastResults = await broadcastToAll(selected, executionId);

    // Step 8: Mark as dispatched
    for (const article of selected) {
      await markAsDispatched(article, executionId);
    }

    // Step 9: Update health check
    await updateHealthCheck();

    const duration = Date.now() - startedAt;

    console.log(`[${executionId}] Cron job completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        execution_id: executionId,
        status: 'success',
        duration_ms: duration,
        metrics: {
          fetch: fetchMetrics,
          scoring: scoreMetrics,
          dedup: {
            unique: unique.length,
            duplicates: duplicates.length
          },
          priority: priorityMetrics,
          broadcast: broadcastResults
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`[${executionId}] Cron job error:`, error);
    return new Response(
      JSON.stringify({
        execution_id: executionId,
        status: 'error',
        error: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}