import { CYCLE_LIMITS } from './config.js';

export function applyPriorityRules(articles) {
  // Kelompokkan by impact
  const highArticles = articles.filter(a => a.impact_category === 'HIGH');
  const medArticles = articles.filter(a => a.impact_category === 'MED');
  const lowArticles = articles.filter(a => a.impact_category === 'LOW');
  
  // Urutkan by score descending
  highArticles.sort((a, b) => b.impact_score - a.impact_score);
  medArticles.sort((a, b) => b.impact_score - a.impact_score);
  
  return { highArticles, medArticles, lowArticles };
}

export function suppressMEDIfHIGHFromCORE(highArticles, medArticles) {
  const hasHighFromCore = highArticles.some(a => a.source_tier === 'CORE');
  
  if (hasHighFromCore) {
    // Suppress semua MED
    return {
      selected: highArticles,
      suppressed: medArticles.map(a => ({
        article: a,
        reason: 'suppressed_by_high_core'
      }))
    };
  }
  
  return {
    selected: highArticles,
    suppressed: []
  };
}

export function limitPerCycle(articles, maxCount) {
  if (articles.length <= maxCount) {
    return {
      selected: articles,
      suppressed: []
    };
  }
  
  const selected = articles.slice(0, maxCount);
  const suppressed = articles.slice(maxCount).map(a => ({
    article: a,
    reason: 'cycle_limit_exceeded'
  }));
  
  return { selected, suppressed };
}

export function removeTopicRedundancy(articles) {
  // Hapus artikel dengan topik sama dalam siklus yang sama
  const topicTags = {};
  const selected = [];
  const suppressed = [];
  
  for (const article of articles) {
    // Extract topic dari title
    const topicKey = article.canonical_title.split(' ').slice(0, 3).join(' ');
    
    if (!topicTags[topicKey]) {
      topicTags[topicKey] = article;
      selected.push(article);
    } else {
      suppressed.push({
        article,
        reason: 'topic_redundancy',
        kept: topicTags[topicKey]
      });
    }
  }
  
  return { selected, suppressed };
}

export function selectFinalArticles(articles, executionId) {
  const { highArticles, medArticles, lowArticles } = applyPriorityRules(articles);
  
  // Step 1: Apply HIGH from CORE suppression
  const { selected: highSelected, suppressed: highSuppressed } = 
    suppressMEDIfHIGHFromCORE(highArticles, medArticles);
  
  // Step 2: Limit HIGH per cycle
  const { selected: highLimited, suppressed: highLimitSuppressed } = 
    limitPerCycle(highSelected, CYCLE_LIMITS.MAX_HIGH_PER_CYCLE);
  
  // Step 3: If no HIGH, select MED
  let finalSelected = highLimited;
  let allSuppressed = [...highSuppressed, ...highLimitSuppressed];
  
  if (highLimited.length === 0) {
    const { selected: medLimited, suppressed: medSuppressed } = 
      limitPerCycle(medArticles, CYCLE_LIMITS.MAX_MED_PER_CYCLE);
    finalSelected = medLimited;
    allSuppressed.push(...medSuppressed);
  }
  
  // Step 4: Remove topic redundancy
  const { selected: final, suppressed: redundancySuppressed } = 
    removeTopicRedundancy(finalSelected);
  
  allSuppressed.push(...redundancySuppressed);
  
  // Add LOW to suppressed
  allSuppressed.push(...lowArticles.map(a => ({
    article: a,
    reason: 'low_impact'
  })));
  
  // Add send order
  final.forEach((article, index) => {
    article.send_order = index + 1;
  });
  
  return {
    selected: final,
    suppressed: allSuppressed,
    metrics: {
      total_processed: articles.length,
      selected: final.length,
      suppressed: allSuppressed.length,
      high_count: highArticles.length,
      med_count: medArticles.length,
      low_count: lowArticles.length
    }
  };
}