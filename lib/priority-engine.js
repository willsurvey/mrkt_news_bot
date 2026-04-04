import { CYCLE_LIMITS } from './config.js';

export function applyPriorityRules(articles) {
  const highArticles = articles.filter(a => a.impact_category === 'HIGH');
  const medArticles = articles.filter(a => a.impact_category === 'MED');
  const lowArticles = articles.filter(a => a.impact_category === 'LOW');

  // Urutkan by score descending
  highArticles.sort((a, b) => b.impact_score - a.impact_score);
  medArticles.sort((a, b) => b.impact_score - a.impact_score);

  return { highArticles, medArticles, lowArticles };
}

/**
 * FIX: Logika sebelumnya salah — suppress semua MED jika ada HIGH dari CORE.
 * Ini menyebabkan tidak ada artikel tambahan yang dikirim.
 *
 * Sekarang: HIGH dari CORE dikirim PENUH (sampai MAX_HIGH_PER_CYCLE).
 * MED hanya dikirim jika tidak ada HIGH sama sekali.
 * Ini adalah perilaku yang benar sesuai desain priority engine.
 */
export function selectFinalArticles(articles, executionId) {
  const { highArticles, medArticles, lowArticles } = applyPriorityRules(articles);
  const allSuppressed = [];

  let finalSelected = [];

  if (highArticles.length > 0) {
    // Ada HIGH → kirim HIGH saja (sampai limit)
    const { selected: highLimited, suppressed: highLimitSuppressed } =
      limitPerCycle(highArticles, CYCLE_LIMITS.MAX_HIGH_PER_CYCLE);

    finalSelected = highLimited;
    allSuppressed.push(...highLimitSuppressed);

    // Semua MED di-suppress karena HIGH sudah dikirim
    allSuppressed.push(
      ...medArticles.map(a => ({ article: a, reason: 'suppressed_by_high' }))
    );
  } else if (medArticles.length > 0) {
    // Tidak ada HIGH → kirim MED
    const { selected: medLimited, suppressed: medLimitSuppressed } =
      limitPerCycle(medArticles, CYCLE_LIMITS.MAX_MED_PER_CYCLE);

    finalSelected = medLimited;
    allSuppressed.push(...medLimitSuppressed);
  }

  // LOW selalu di-suppress
  allSuppressed.push(...lowArticles.map(a => ({ article: a, reason: 'low_impact' })));

  // Hapus redundansi topik dari final selection
  const { selected: final, suppressed: redundancySuppressed } =
    removeTopicRedundancy(finalSelected);
  allSuppressed.push(...redundancySuppressed);

  // Tandai urutan pengiriman
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

function limitPerCycle(articles, maxCount) {
  if (articles.length <= maxCount) {
    return { selected: articles, suppressed: [] };
  }

  return {
    selected: articles.slice(0, maxCount),
    suppressed: articles.slice(maxCount).map(a => ({
      article: a,
      reason: 'cycle_limit_exceeded'
    }))
  };
}

function removeTopicRedundancy(articles) {
  const seenTopics = new Map();
  const selected = [];
  const suppressed = [];

  for (const article of articles) {
    if (!article.canonical_title) {
      selected.push(article);
      continue;
    }

    // Gunakan 4 kata pertama sebagai topic key
    const topicKey = article.canonical_title.split(' ').slice(0, 4).join(' ');

    if (!seenTopics.has(topicKey)) {
      seenTopics.set(topicKey, article);
      selected.push(article);
    } else {
      suppressed.push({
        article,
        reason: 'topic_redundancy',
        kept: seenTopics.get(topicKey)
      });
    }
  }

  return { selected, suppressed };
}
