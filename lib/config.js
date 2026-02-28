// ==================== KONFIGURASI SUMBER BERITA ====================
export const RSS_SOURCES = {
  CORE: [
    {
      name: 'CNBC Market',
      url: 'https://www.cnbcindonesia.com/market/rss',
      tier: 'CORE',
      timeout: 8000,
      weight: 1.2
    },
    {
      name: 'Bloomberg Technoz',
      url: 'https://www.bloombergtechnoz.com/rss',
      tier: 'CORE',
      timeout: 8000,
      weight: 1.2
    },
    {
      name: 'Antara Ekonomi',
      url: 'https://www.antaranews.com/rss/ekonomi.xml',
      tier: 'CORE',
      timeout: 8000,
      weight: 1.2
    }
  ],
  SUPPORT: [
    {
      name: 'Tempo Bisnis',
      url: 'https://rss.tempo.co/bisnis',
      tier: 'SUPPORT',
      timeout: 5000,
      weight: 1.0
    },
    {
      name: 'CNN Ekonomi',
      url: 'https://www.cnnindonesia.com/ekonomi/rss',
      tier: 'SUPPORT',
      timeout: 5000,
      weight: 1.0
    },
    {
      name: 'Investing.com',
      url: 'https://id.investing.com/rss/news.rss',
      tier: 'SUPPORT',
      timeout: 5000,
      weight: 1.0
    }
  ],
  NOISE: [
    {
      name: 'Detik Finance',
      url: 'https://finance.detik.com/rss',
      tier: 'NOISE',
      timeout: 5000,
      weight: 0.6
    },
    {
      name: 'Liputan6 Saham',
      url: 'https://feed.liputan6.com/rss/saham',
      tier: 'NOISE',
      timeout: 5000,
      weight: 0.6
    },
    {
      name: 'Republika Ekonomi',
      url: 'https://www.republika.co.id/rss/ekonomi/',
      tier: 'NOISE',
      timeout: 5000,
      weight: 0.6
    }
  ]
};

// ==================== KEYWORD UNTUK IMPACT SCORING ====================
export const KEYWORDS = {
  HARD: [
    'outlook negatif', 'anjlok', 'melonjak',
    'asing keluar', 'capital outflow', 'intervensi',
    'suspensi', 'investigasi', 'fraud', 'likuidasi',
    'pailit', 'devaluasi', 'emergency', 'peringatan', 'risiko tinggi'
  ],
  SOFT: [
    'berpotensi', 'diperkirakan', 'diproyeksikan', 'kemungkinan',
    'prospek', 'target', 'optimis', 'menunggu', 'jika', 'apabila'
  ],
  EXTREME: [
    'krisis sistemik', 'intervensi BI', 'capital control',
    'suspensi perdagangan', 'investigasi OJK',
    'gagal bayar sistemik', 'default sovereign'
  ]
};

// ==================== TOPIK DENGAN SKOR DASAR ====================
export const TOPIC_SCORES = {
  L1_MACRO: {
    keywords: ['BI Rate', 'suku bunga', 'rating utang', 'S&P', 'Moody', 'Fitch',
               'APBN', 'defisit', 'fiskal', 'Fed', 'FOMC'],
    score: 90
  },
  L2_MARKET: {
    keywords: ['IHSG', 'asing', 'net buy', 'net sell', 'rupiah', 'USD/IDR',
               'yield obligasi', 'SUN', 'MSCI', 'FTSE'],
    score: 75
  },
  L3_SECTOR: {
    keywords: ['sektor', 'finansial', 'energi', 'tambang', 'komoditas',
               'regulasi', 'kebijakan sektoral'],
    score: 50
  },
  L4_ISSUER: {
    keywords: ['emiten', 'laba', 'dividen', 'rights issue', 'M&A',
               'akuisisi', 'merger', 'laporan keuangan'],
    score: 20
  }
};

// ==================== THRESHOLD IMPACT ====================
export const IMPACT_THRESHOLDS = {
  HIGH: 75,
  MED: 50,
  LOW: 0
};

// ==================== BATASAN PER SIKLUS ====================
export const CYCLE_LIMITS = {
  MAX_HIGH_PER_CYCLE: 5,
  MAX_MED_PER_CYCLE: 3,
  MAX_NOTIFICATIONS_PER_USER_PER_HOUR: 5
};

// ==================== QUIET HOURS (22:00 - 06:00 WIB) ====================
export const QUIET_HOURS = {
  START: 22,
  END: 6
};

// ==================== TTL STORAGE (dalam detik) ====================
export const TTL = {
  NEWS_DISPATCHED: 604800,   // 7 hari (dari 30 hari)
  NEWS_DELIVERED: 604800,    // 7 hari (dari 30 hari)
  CIRCUIT_BREAKER: 3600,     // 1 jam
  SUBSCRIBER_PENDING: 86400  // 24 jam
};

// ==================== ARTICLE FILTER ====================
export const ARTICLE_FILTER = {
  MAX_AGE_HOURS: 24,  // Hanya berita < 24 jam
  SKIP_FUTURE_DATE: true
};