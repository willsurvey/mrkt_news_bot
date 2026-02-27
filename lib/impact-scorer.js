import { KEYWORDS, TOPIC_SCORES, IMPACT_THRESHOLDS } from './config.js';

export function calculateTopicScore(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  
  // Cek L1_MACRO
  for (const keyword of TOPIC_SCORES.L1_MACRO.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return TOPIC_SCORES.L1_MACRO.score;
    }
  }
  
  // Cek L2_MARKET
  for (const keyword of TOPIC_SCORES.L2_MARKET.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return TOPIC_SCORES.L2_MARKET.score;
    }
  }
  
  // Cek L3_SECTOR
  for (const keyword of TOPIC_SCORES.L3_SECTOR.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return TOPIC_SCORES.L3_SECTOR.score;
    }
  }
  
  // Cek L4_ISSUER
  for (const keyword of TOPIC_SCORES.L4_ISSUER.keywords) {
    if (text.includes(keyword.toLowerCase())) {
      return TOPIC_SCORES.L4_ISSUER.score;
    }
  }
  
  return 10; // Default untuk berita umum
}

export function calculateKeywordMultiplier(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  
  let hardCount = 0;
  let softCount = 0;
  
  for (const keyword of KEYWORDS.HARD) {
    if (text.includes(keyword.toLowerCase())) {
      hardCount++;
    }
  }
  
  for (const keyword of KEYWORDS.SOFT) {
    if (text.includes(keyword.toLowerCase())) {
      softCount++;
    }
  }
  
  // Hitung multiplier
  if (hardCount >= 2) {
    return 1.5;
  } else if (hardCount === 1) {
    return 1.3;
  } else if (softCount > hardCount) {
    return 0.8;
  }
  
  return 1.0;
}

export function calculateSourceWeight(article) {
  return article.source_weight || 1.0;
}

export function calculateScopeMultiplier(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  
  // Cek cakupan
  if (text.includes('ihsg') || text.includes('pasar saham indonesia') || 
      text.includes('indeks utama') || text.includes('market-wide')) {
    return 1.5;
  }
  
  if (text.includes('multi sektor') || text.includes('beberapa sektor')) {
    return 1.2;
  }
  
  if (text.includes('sektor') || text.includes('industri')) {
    return 1.0;
  }
  
  // Emiten individual
  if (text.match(/\b[A-Z]{4}\b/)) { // Kode saham 4 huruf
    return 0.8;
  }
  
  return 1.0;
}

export function calculateFinalScore(article) {
  const topicScore = calculateTopicScore(article);
  const keywordMultiplier = calculateKeywordMultiplier(article);
  const sourceWeight = calculateSourceWeight(article);
  const scopeMultiplier = calculateScopeMultiplier(article);
  
  // Weighted calculation
  const rawScore = (topicScore * 0.40) + 
                   ((50 * keywordMultiplier) * 0.25) + 
                   ((70 * sourceWeight) * 0.20) + 
                   ((60 * scopeMultiplier) * 0.15);
  
  return Math.round(rawScore);
}

export function classifyImpact(score) {
  if (score >= IMPACT_THRESHOLDS.HIGH) {
    return 'HIGH';
  } else if (score >= IMPACT_THRESHOLDS.MED) {
    return 'MED';
  }
  return 'LOW';
}

export function hasExtremeKeyword(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  
  for (const keyword of KEYWORDS.EXTREME) {
    if (text.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function scoreArticle(article) {
  const score = calculateFinalScore(article);
  let impact = classifyImpact(score);
  
  // Override: extreme keyword force HIGH
  if (hasExtremeKeyword(article)) {
    impact = 'HIGH';
  }
  
  // Override: CORE + L1_MACRO minimum MED
  if (article.source_tier === 'CORE' && calculateTopicScore(article) >= 90) {
    if (impact === 'LOW') {
      impact = 'MED';
    }
  }
  
  return {
    ...article,
    impact_score: score,
    impact_category: impact,
    topic_score: calculateTopicScore(article),
    keyword_multiplier: calculateKeywordMultiplier(article),
    scope_multiplier: calculateScopeMultiplier(article)
  };
}