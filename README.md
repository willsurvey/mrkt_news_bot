# 📈 Market News Intelligence Bot

Bot Telegram untuk news intelligence pasar modal Indonesia. Mengambil berita dari 9 sumber RSS, men-scoring berdasarkan impact, dan mengirim broadcast otomatis ke subscriber.

---

## 🏗️ Struktur Project

```
project/
├── api/
│   ├── bot.js              ← Telegram webhook (POST /api/bot)
│   ├── cron.js             ← Cron job runner (GET /api/cron)
│   ├── health.js           ← Health check (GET /api/health)
│   ├── handlers.js         ← Bot command handlers
│   └── admin/
│       └── subscribers.js  ← Admin API (GET/POST /api/admin/subscribers)
├── lib/
│   ├── config.js           ← Semua konfigurasi & keyword
│   ├── kv-store.js         ← Redis data layer
│   ├── rss-fetcher.js      ← Fetch & parse RSS
│   ├── impact-scorer.js    ← Scoring artikel
│   ├── dedup.js            ← Deduplication
│   ├── priority-engine.js  ← Seleksi artikel final
│   ├── broadcast.js        ← Kirim ke subscriber
│   └── message-formatter.js ← Format pesan Telegram
├── public/
│   └── index.html          ← Admin dashboard
├── package.json
├── vercel.json
└── .env.example
```

---

## ⚙️ Setup

### 1. Clone & Install

```bash
git clone <repo>
cd market-news-bot
npm install
```

### 2. Environment Variables

Salin `.env.example` ke `.env.local` dan isi:

```env
# Telegram
BOT_TOKEN=1234567890:ABCdef...

# Redis (Upstash → Settings → Redis CLI → URL format)
REDIS_URL=redis://default:password@your-host.upstash.io:6379

# Admin Telegram user IDs (untuk command /admin)
ADMIN_USER_IDS=123456789,987654321

# Secret untuk Admin Dashboard web
ADMIN_SECRET=buat_string_acak_yang_panjang_di_sini

# URL app (setelah deploy)
APP_URL=https://your-app.vercel.app
```

### 3. Deploy ke Vercel

```bash
npm run deploy
```

### 4. Set Telegram Webhook

Setelah deploy, set webhook bot ke URL Vercel:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://your-app.vercel.app/api/bot"
```

Verifikasi:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## 🔄 Cara Kerja Cron

Karena Vercel Hobby plan tidak mendukung cron lebih dari sekali per hari, gunakan layanan eksternal untuk memanggil `/api/cron` secara berkala.

**Rekomendasi (gratis):**
- **[cron-job.org](https://cron-job.org)** → buat job `GET https://your-app.vercel.app/api/cron` setiap 15 menit
- **[EasyCron](https://easycron.com)** → sama, gratis tier tersedia
- **GitHub Actions** → workflow dengan `schedule: '*/15 * * * *'`
- **UptimeRobot** → monitor HTTP setiap 5 menit (sekaligus keep-alive)

Pipeline yang dijalankan setiap kali endpoint dipanggil:

```
Fetch RSS → Normalize → Score → Dedup → Priority Select → Broadcast → Mark Dispatched
```

Pipeline:
1. **Fetch** — Ambil artikel dari 9 sumber (CORE/SUPPORT/NOISE tier)
2. **Normalize** — Standarisasi field, buat canonical title & hash
3. **Score** — Hitung impact score (topic + keyword + source weight + scope)
4. **Dedup** — Filter artikel yang sudah pernah dikirim (Redis TTL 7 hari)
5. **Priority** — Pilih max 5 HIGH atau 3 MED per siklus
6. **Broadcast** — Kirim ke semua subscriber aktif
7. **Mark** — Catat artikel sebagai sudah dikirim

---

## 📊 Impact Scoring

| Kategori | Skor | Contoh |
|----------|------|--------|
| HIGH (≥75) | 75-100 | BI Rate naik, krisis rupiah, IHSG -3% |
| MED (≥50) | 50-74 | Update sektor, data inflasi, obligasi |
| LOW (<50) | 0-49 | Berita emiten individual |

**Priority Rules:**
- Jika ada HIGH → hanya HIGH yang dikirim (max 5)
- Jika tidak ada HIGH → kirim MED (max 3)
- LOW tidak pernah dikirim
- Quiet hours (22:00–06:00 WIB): hanya berita dengan score ≥90

---

## 🤖 Bot Commands

| Command | Keterangan |
|---------|------------|
| `/start` | Sambutan & instruksi |
| `/subscribe` | Daftar notifikasi otomatis |
| `/unsubscribe` | Berhenti berlangganan |
| `/status` | Cek status subscription |
| `/news` | Ambil berita terbaru manual (top 5) |
| `/help` | Daftar semua perintah |
| `/admin stats` | Statistik sistem (admin) |
| `/admin subscribers` | List subscriber (admin) |
| `/admin export` | Download CSV subscriber (admin) |

---

## 🔐 Admin Dashboard

Buka `https://your-app.vercel.app/admin` di browser.

Masukkan nilai `ADMIN_SECRET` dari env variable untuk login.

---

## 🏥 Health Check

```bash
curl https://your-app.vercel.app/api/health
```

Response:
```json
{
  "status": "healthy",
  "last_successful_run": "2025-01-15T10:00:00.000Z",
  "minutes_since_last_run": 8,
  "current_time": "2025-01-15T10:08:00.000Z"
}
```

Status `degraded` jika cron tidak berjalan > 30 menit.

---

## 🛠️ Development Lokal

```bash
npm run dev   # Jalankan vercel dev
```

Trigger cron manual:
```bash
curl http://localhost:3000/api/cron
```

---

## 📦 Dependencies

- `grammy` — Telegram Bot framework
- `rss-parser` — RSS/Atom feed parser  
- `redis` — Redis client (kompatibel dengan Upstash)
