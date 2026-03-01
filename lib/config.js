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
    // === VERB / IMPACT NEGATIF KERAS ===
    'ancam', 'mengancam', 'ancaman',
    'serang', 'menyerang', 'serangan',
    'eskalasi', 'eskalatif',
    'provokasi',
    'tekan', 'menekan', 'tekanan', 'tertekan',
    'hantam', 'menghantam', 'hantaman',
    'guncang', 'mengguncang', 'guncangan',
    'hambat', 'menghambat', 'hambatan',
    'ganggu', 'mengganggu', 'gangguan',
    'blokir', 'pemblokiran',
    'lumpuhkan', 'melumpuhkan',
    'gerus', 'menggerus', 'gerusan',
    'kikis', 'mengikis', 'pengikisan',
    'seret', 'menyeret',
    'pukul', 'memukul', 'pukulan',
    'jatuh', 'anjlok', 'merosot', 'ambles',
    'runtuh', 'kolaps', 'collapse',

    // === KONDISI PASAR & SISTEM ===
    'krisis', 'krisis keuangan', 'krisis likuiditas',
    'krisis energi', 'krisis pangan',
    'gejolak', 'bergejolak',
    'volatilitas', 'volatilitas tinggi',
    'instabilitas', 'ketidakstabilan',
    'panic', 'kepanikan', 'kepanikan pasar',
    'sell off', 'panic selling',
    'likuidasi', 'forced selling',
    'flight to safety',

    // === ARUS MODAL & FX ===
    'asing keluar', 'investor asing keluar',
    'capital outflow', 'outflow besar',
    'arus modal keluar',
    'pembalikan arus modal',
    'tekanan rupiah', 'rupiah tertekan',
    'rupiah melemah', 'pelemahan rupiah',
    'depresiasi', 'devaluasi',
    'krisis mata uang',
    'currency shock',

    // === KREDIT & KEUANGAN ===
    'gagal bayar', 'gagal bayar utang',
    'default', 'gagal bayar obligasi',
    'default korporasi', 'default sovereign',
    'credit crunch', 'pengetatan kredit',
    'krisis kredit',
    'risiko sistemik', 'krisis sistemik',
    'systemic risk',

    // === REGULATOR & DARURAT ===
    'intervensi', 'intervensi BI',
    'intervensi pasar',
    'capital control',
    'pembatasan likuiditas',
    'suspensi', 'suspensi perdagangan',
    'trading halt',
    'emergency', 'status darurat',
    'peringatan keras',
    'investigasi', 'investigasi OJK',
    'penyidikan',
    'fraud', 'skandal', 'manipulasi',
    'pailit', 'bangkrut', 'insolvensi',

    // === MAKRO EKSTREM ===
    'resesi', 'resesi global',
    'kontraksi ekonomi',
    'perlambatan tajam',
    'hard landing',
    'outlook negatif',
    'risiko tinggi',
    'ketidakpastian ekstrem'
  ],

  SOFT: [
    // === PROBABILITAS & EKSPEKTASI ===
    'berpotensi', 'potensi',
    'diperkirakan', 'diproyeksikan',
    'diprediksi',
    'kemungkinan', 'peluang',
    'berisiko', 'rawan',
    'antisipasi', 'antisipatif',
    'waspada', 'kehati-hatian',

    // === PROYEKSI & NARASI MEDIA ===
    'prospek', 'outlook',
    'pandangan', 'ekspektasi',
    'target', 'sasaran',
    'prediksi', 'perkiraan',
    'estimasi', 'proyeksi',

    // === KONDISI MENUNGGU / TRANSISI ===
    'menunggu', 'menanti',
    'bergantung pada',
    'jika', 'apabila', 'bila',
    'dalam jangka pendek',
    'jangka menengah',
    'jangka panjang',

    // === SENTIMEN NETRAL–POSITIF LEMAH ===
    'optimis terbatas',
    'optimisme terbatas',
    'peluang terbuka',
    'ruang pemulihan',
    'indikasi awal',
    'sinyal awal',
    'mulai stabil',
    'cenderung stabil',
    'relatif stabil',
    'terkendali'
  ],

  EXTREME: [
    // === SISTEMIK & NEGARA ===
    'krisis sistemik',
    'gagal bayar sistemik',
    'default sovereign',
    'krisis fiskal',
    'krisis moneter',
    'krisis utang negara',

    // === REGULATOR EKSTREM ===
    'intervensi BI besar-besaran',
    'capital control',
    'pembatasan transaksi',
    'pembekuan likuiditas',
    'penutupan pasar',
    'penutupan bursa',
    'suspensi perdagangan',

    // === KEUANGAN NASIONAL ===
    'krisis rupiah',
    'krisis perbankan',
    'rush bank',
    'penarikan dana besar-besaran',
    'krisis likuiditas nasional',

    // === GLOBAL SHOCK ===
    'krisis global',
    'global financial crisis',
    'financial contagion',
    'contagion effect',
    'systemic risk global',
    'shock global'
  ]
};

// ==================== TOPIK DENGAN SKOR DASAR ====================
export const TOPIC_SCORES = {
  L1_MACRO: {
    keywords: [
      // === MONETER & BANK SENTRAL ===
      'BI Rate', 'suku bunga', 'suku bunga acuan', 'suku bunga BI',
      'bank sentral', 'kebijakan moneter', 'pengetatan moneter',
      'pelonggaran moneter', 'normalisasi moneter',
      'intervensi BI', 'operasi moneter',

      // === GLOBAL CENTRAL BANK ===
      'Fed', 'Federal Reserve', 'FOMC',
      'ECB', 'BOJ', 'BOE',
      'dot plot', 'hawkish', 'dovish',
      'higher for longer', 'policy pivot',

      // === FISKAL & ANGGARAN ===
      'APBN', 'defisit', 'defisit APBN', 'surplus',
      'fiskal', 'kebijakan fiskal',
      'utang negara', 'rasio utang',
      'penerimaan negara', 'belanja negara',
      'subsidi', 'kompensasi',
      'pembiayaan utang', 'lelang obligasi',

      // === INFLASI & PERTUMBUHAN ===
      'inflasi', 'deflasi', 'inflasi inti',
      'pertumbuhan ekonomi', 'PDB', 'GDP',
      'kontraksi ekonomi', 'perlambatan ekonomi',
      'resesi', 'stagflasi',
      'hard landing', 'soft landing',

      // === RATING & RISIKO NEGARA ===
      'rating utang', 'peringkat utang',
      'S&P', 'Standard & Poor’s',
      'Moody', 'Moody’s',
      'Fitch', 'rating outlook',
      'outlook negatif', 'outlook stabil',
      'sovereign risk', 'country risk',

      // === GEOPOLITIK & KEAMANAN GLOBAL ===
      'geopolitik', 'risiko geopolitik',
      'ketegangan geopolitik',
      'konflik geopolitik',
      'konflik regional',
      'perang', 'konflik bersenjata',
      'eskalasi konflik', 'deeskalasi',
      'serangan militer',
      'ancaman keamanan',
      'stabilitas kawasan',

      // === GEOEKONOMI & BLOK GLOBAL ===
      'geoekonomi', 'geo-economic risk',
      'fragmentasi global',
      'deglobalisasi',
      'decoupling',
      'friend shoring', 'reshoring',
      'blok ekonomi',
      'perang dagang', 'perang ekonomi',

      // === SANKSI & HUBUNGAN INTERNASIONAL ===
      'sanksi ekonomi', 'sanksi dagang',
      'embargo', 'larangan perdagangan',
      'pembatasan ekspor',
      'hubungan diplomatik',
      'ketegangan diplomatik',

      // === SUPPLY CHAIN & ENERGI GLOBAL ===
      'gangguan rantai pasok',
      'supply chain disruption',
      'krisis energi',
      'keamanan energi',
      'harga energi global',
      'harga minyak dunia',
      'harga pangan global',

      // === MAKRO GLOBAL & SHOCK ===
      'krisis global',
      'ketidakpastian global',
      'gejolak global',
      'volatilitas global',
      'global shock',
      'financial contagion',
      'systemic risk'
    ],
    score: 90
  },

  L2_MARKET: {
    keywords: [
      // === PASAR SAHAM ===
      'IHSG', 'indeks harga saham', 'pasar saham',
      'bursa', 'perdagangan saham',
      'volatilitas pasar',
      'sell off', 'panic selling',
      'trading halt',

      // === INVESTOR & ARUS MODAL ===
      'asing', 'investor asing', 'domestik',
      'net buy', 'net sell',
      'capital inflow', 'capital outflow',
      'arus modal', 'dana asing keluar',
      'risk off', 'risk on',

      // === VALUASI & SENTIMEN ===
      'valuasi', 'undervalued', 'overvalued',
      'sentimen pasar',
      'risk appetite', 'risk aversion',
      'flight to safety',

      // === PASAR OBLIGASI ===
      'yield obligasi', 'imbal hasil',
      'obligasi negara', 'SUN', 'SBN',
      'yield SUN', 'yield SBN',
      'spread yield',
      'yield US Treasury',

      // === VALUTA & FX ===
      'rupiah', 'nilai tukar', 'kurs',
      'USD/IDR', 'IDR', 'dolar AS',
      'indeks dolar', 'DXY',
      'depresiasi rupiah', 'apresiasi rupiah',
      'volatilitas kurs',

      // === INDEKS GLOBAL ===
      'MSCI', 'MSCI Index', 'MSCI Emerging Market',
      'FTSE', 'FTSE Index',
      'rebalancing indeks'
    ],
    score: 75
  },

  L3_SECTOR: {
    keywords: [
      // === UMUM SEKTOR ===
      'sektor', 'sektoral', 'rotasi sektor',
      'kinerja sektor', 'outlook sektor',

      // === SEKTOR STRATEGIS ===
      'finansial', 'perbankan', 'asuransi',
      'energi', 'minyak', 'gas',
      'pertambangan', 'tambang',
      'batubara', 'nikel', 'timah',
      'logam', 'emas',

      // === KOMODITAS & GLOBAL LINK ===
      'komoditas', 'harga komoditas',
      'CPO', 'minyak mentah', 'brent', 'WTI',
      'gas alam',
      'harga batu bara',
      'harga nikel',

      // === INDUSTRI DOMESTIK ===
      'properti', 'konstruksi',
      'infrastruktur',
      'konsumer', 'ritel',
      'manufaktur',
      'teknologi', 'telekomunikasi',
      'logistik',

      // === KEBIJAKAN SEKTORAL ===
      'regulasi', 'kebijakan sektoral',
      'insentif', 'disinsentif',
      'pajak sektor', 'royalti',
      'larangan ekspor', 'pembatasan ekspor',
      'kuota produksi'
    ],
    score: 50
  },

  L4_ISSUER: {
    keywords: [
      // === ENTITAS ===
      'emiten', 'perusahaan', 'korporasi',
      'grup usaha', 'anak usaha',
      'holding',

      // === KINERJA KEUANGAN ===
      'laba', 'rugi', 'pendapatan',
      'margin', 'arus kas', 'cash flow',
      'neraca', 'rasio keuangan',
      'utang', 'liabilitas',

      // === AKSI KORPORASI ===
      'dividen', 'dividend payout',
      'rights issue', 'private placement',
      'buyback saham',
      'obligasi korporasi',

      // === TRANSAKSI STRATEGIS ===
      'M&A', 'merger', 'akuisisi',
      'spin off', 'restrukturisasi',
      'divestasi',

      // === KEPATUHAN & LAPORAN ===
      'laporan keuangan',
      'keterbukaan informasi',
      'public expose',
      'audit', 'opini audit',
      'sanksi regulator'
    ],
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
  START: 0,
  END: 0
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