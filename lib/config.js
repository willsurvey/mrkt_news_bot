// config.js - Konfigurasi Sistem Market News Bot

export const RSS_SOURCES = [
  {
    id: 'cnbc-market',
    name: 'CNBC Indonesia Market',
    url: 'https://www.cnbcindonesia.com/market/rss',
    source_tier: 'CORE',
    source_weight: 1.0,
    language: 'id',
    category: 'market'
  },
  {
    id: 'bloomberg-technoz',
    name: 'Bloomberg Technoz',
    url: 'https://www.bloombergtechnoz.com/rss',
    source_tier: 'CORE',
    source_weight: 1.0,
    language: 'id',
    category: 'business-tech'
  },
  {
    id: 'antara-ekonomi',
    name: 'Antara News Ekonomi',
    url: 'https://www.antaranews.com/rss/ekonomi.xml',
    source_tier: 'CORE',
    source_weight: 0.95,
    language: 'id',
    category: 'economy'
  },
  {
    id: 'tempo-bisnis',
    name: 'Tempo Bisnis',
    url: 'https://rss.tempo.co/bisnis',
    source_tier: 'CORE',
    source_weight: 0.95,
    language: 'id',
    category: 'business'
  },
  {
    id: 'cnn-ekonomi',
    name: 'CNN Indonesia Ekonomi',
    url: 'https://www.cnnindonesia.com/ekonomi/rss',
    source_tier: 'CORE',
    source_weight: 0.95,
    language: 'id',
    category: 'economy'
  },
  {
    id: 'detik-finance',
    name: 'Detik Finance',
    url: 'https://finance.detik.com/rss',
    source_tier: 'SECONDARY',
    source_weight: 0.85,
    language: 'id',
    category: 'finance'
  },
  {
    id: 'liputan6-saham',
    name: 'Liputan6 Saham',
    url: 'https://feed.liputan6.com/rss/saham',
    source_tier: 'SECONDARY',
    source_weight: 0.85,
    language: 'id',
    category: 'stocks'
  }
];

export const TOPIC_SCORES = {
  L1_MACRO: {
    keywords: [
      'ihsg', 'indeks harga saham gabungan', 'bi rate', 'suku bunga acuan',
      'inflasi', 'pdb', 'pertumbuhan ekonomi', 'nilai tukar', 'rupiah',
      'dolar', 'cadangan devisa', 'utang negara', 'defisit', 'surplus',
      'kebijakan fiskal', 'kebijakan moneter', 'ojk', 'bank indonesia',
      'perjanjian dagang', 'tarif', 'ekspor', 'impor', 'msci', 'ftse',
      'rating utang', 'sovereign rating', 'capital outflow', 'foreign investment'
    ],
    score: 95
  },
  L2_MARKET: {
    keywords: [
      'pasar saham', 'bursa efek indonesia', 'bei', 'trading halt',
      'volume perdagangan', 'asing net buy', 'asing net sell', 'bandarmology',
      'analisis teknikal', 'resistance', 'support', 'breakout', 'correction',
      'rebound', 'bullish', 'bearish', 'volatilitas', 'likuiditas',
      'ipo', 'right issue', 'stock split', 'dividen', 'buyback',
      'analyst upgrade', 'analyst downgrade', 'target price', 'fair value'
    ],
    score: 85
  },
  L3_SECTOR: {
    keywords: [
      'perbankan', 'banking', 'bbri', 'bbca', 'bmri', 'bbni',
      'komoditas', 'batu bara', 'nikel', 'cpo', 'minyak', 'gas',
      'properti', 'real estate', 'infrastruktur', 'konstruksi',
      'telekomunikasi', 'teknologi', 'e-commerce', 'fintech',
      'konsumsi', 'retail', 'otomotif', 'farmasi', 'healthcare',
      'energi terbarukan', 'ev', 'kendaraan listrik', 'semikonduktor'
    ],
    score: 70
  },
  L4_ISSUER: {
    keywords: [
      'laporan keuangan', 'earnings', 'revenue', 'profit', 'laba',
      'akuisisi', 'merger', 'ekspansi', 'kontrak baru', 'proyek baru',
      'restrukturisasi', 'divestasi', 'spin-off', 'management change',
      'corporate action', 'rups', 'rapat umum', 'komisaris', 'direksi'
    ],
    score: 55
  }
};

export const KEYWORDS = {
  HARD: [
    'crash', 'anjlok', 'runtuh', 'default', 'gagal bayar', 'pailit',
    'suspensi', 'delisting', 'fraud', 'korupsi', 'investigasi', 'penyidikan',
    'sita', 'blokir', 'sanksi', 'denda', 'tuntutan', 'vonis',
    'force majeure', 'bencana', 'kebakaran', 'ledakan', 'kecelakaan fatal',
    'phk massal', 'demonstrasi', 'mogok kerja', 'kerusuhan', 'gejolak',
    'capital outflow', 'depresiasi tajam', 'intervensi', 'trading halt',
    'margin call', 'likuidasi', 'black swan', 'systemic risk'
  ],
  SOFT: [
    'melemah', 'tertekan', 'koreksi', 'volatil', 'ketidakpastian',
    'risiko', 'tantangan', 'hambatan', 'penurunan', 'penyusutan',
    'waspadai', 'antisipasi', 'monitoring', 'evaluasi', 'review',
    'proyeksi', 'estimasi', 'forecast', 'outlook', 'sentimen',
    'spekulasi', 'rumor', 'isu', 'wacana', 'rencana', 'persiapan'
  ],
  EXTREME: [
    'darurat', 'krisis', 'collapse', 'meltdown', 'contagion',
    'systemic failure', 'bailout', 'rescue package', 'emergency rate cut',
    'market closure', 'circuit breaker', 'trading suspension',
    'sovereign default', 'currency crisis', 'banking crisis',
    'pandemic', 'lockdown', 'state of emergency', 'martial law'
  ]
};

export const IMPACT_THRESHOLDS = {
  HIGH: 75,
  MED: 50,
  LOW: 0
};

export const CYCLE_LIMITS = {
  MAX_HIGH_PER_CYCLE: 3,
  MAX_MED_PER_CYCLE: 2,
  MAX_TOTAL_PER_CYCLE: 5,
  MIN_INTERVAL_MINUTES: 15
};

export const QUIET_HOURS = {
  start: 22, // 22:00
  end: 6,    // 06:00
  exceptions: {
    allow_extreme_keywords: true,
    allow_l1_macro_with_core_source: true,
    max_score_override: 90
  }
};

export const DEDUP_CONFIG = {
  title_similarity_threshold: 0.85,
  time_window_hours: 6,
  source_priority: ['CORE', 'SECONDARY'],
  prefer_newer: true
};

export const BROADCAST_CONFIG = {
  retry_attempts: 3,
  retry_delay_ms: 1000,
  rate_limit_per_second: 2,
  batch_size: 10,
  timeout_ms: 30000
};

export const HEALTH_CHECK = {
  endpoint: '/health',
  interval_seconds: 60,
  max_fetch_failures: 3,
  alert_threshold_minutes: 10
};

export const LOGGING = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: 'json',
  include_stack_trace: process.env.NODE_ENV !== 'production'
};