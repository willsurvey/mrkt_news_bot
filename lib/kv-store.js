import { createClient } from 'redis';
import { TTL } from './config.js';

// ==================== REDIS CLIENT (Serverless-safe) ====================
// Vercel serverless: tiap invokasi bisa pakai connection baru.
// Kita cache di module-level tapi selalu cek isOpen sebelum pakai.

let _client = null;

async function getRedisClient() {
  if (_client && _client.isOpen) {
    return _client;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is not set');
  }

  _client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: false, // Jangan auto-reconnect di serverless
      connectTimeout: 5000
    }
  });

  _client.on('error', (err) => {
    console.error('Redis Client Error:', err.message);
    _client = null; // Reset supaya koneksi baru dibuat di request berikutnya
  });

  await _client.connect();
  console.log('✅ Redis connected');
  return _client;
}

// ==================== HELPER ====================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON dari Redis. Redis selalu return string.
 * Jika data bukan string valid JSON, return null.
 */
function safeParse(data) {
  if (!data) return null;
  if (typeof data === 'object') return data; // Sudah di-parse
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ==================== SUBSCRIBER MANAGEMENT ====================

export async function addUser(chatId, metadata = {}) {
  const redis = await getRedisClient();
  const key = `subscriber:user:${chatId}`;

  // FIX: redis.get() mengembalikan string, harus di-parse dulu
  const rawExisting = await redis.get(key);
  const existing = safeParse(rawExisting);

  const subscriber = {
    identifier: String(chatId),
    subscriber_type: 'user',
    status: 'active',
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preferences: {
      impact_filter: existing?.preferences?.impact_filter || ['HIGH', 'MED']
    },
    delivery_stats: {
      last_success: existing?.delivery_stats?.last_success || null,
      last_attempt: existing?.delivery_stats?.last_attempt || null,
      success_count_7d: existing?.delivery_stats?.success_count_7d || 0,
      fail_count_7d: existing?.delivery_stats?.fail_count_7d || 0
    },
    ...metadata
  };

  await redis.set(key, JSON.stringify(subscriber));
  await redis.sAdd('subscribers:users', String(chatId));
  return subscriber;
}

export async function addGroup(chatId, metadata = {}) {
  const redis = await getRedisClient();
  const key = `subscriber:group:${chatId}`;

  // FIX: redis.get() mengembalikan string, harus di-parse dulu
  const rawExisting = await redis.get(key);
  const existing = safeParse(rawExisting);

  const subscriber = {
    identifier: String(chatId),
    subscriber_type: 'group',
    status: 'active',
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preferences: {
      impact_filter: existing?.preferences?.impact_filter || ['HIGH', 'MED']
    },
    delivery_stats: {
      last_success: existing?.delivery_stats?.last_success || null,
      last_attempt: existing?.delivery_stats?.last_attempt || null,
      success_count_7d: existing?.delivery_stats?.success_count_7d || 0,
      fail_count_7d: existing?.delivery_stats?.fail_count_7d || 0
    },
    ...metadata
  };

  await redis.set(key, JSON.stringify(subscriber));
  await redis.sAdd('subscribers:groups', String(chatId));
  return subscriber;
}

export async function getSubscriber(type, chatId) {
  const redis = await getRedisClient();
  const key = `subscriber:${type}:${chatId}`;
  const data = await redis.get(key);
  return safeParse(data);
}

export async function updateSubscriberStatus(type, chatId, status) {
  const redis = await getRedisClient();
  const key = `subscriber:${type}:${chatId}`;
  const raw = await redis.get(key);
  const existing = safeParse(raw);
  if (!existing) return null;

  const updated = {
    ...existing,
    status,
    updated_at: new Date().toISOString()
  };

  await redis.set(key, JSON.stringify(updated));

  // Maintain active set: hanya user aktif yang ada di set
  const setKey = `subscribers:${type}s`;
  if (status === 'active') {
    await redis.sAdd(setKey, String(chatId));
  } else {
    await redis.sRem(setKey, String(chatId));
  }

  return updated;
}

/**
 * Ambil semua subscriber (aktif maupun tidak) berdasarkan type.
 * Untuk broadcast, gunakan getActiveSubscribers().
 */
async function getSubscribersByType(type) {
  const redis = await getRedisClient();
  const setKey = `subscribers:${type}s`;
  const ids = await redis.sMembers(setKey);
  if (!ids || ids.length === 0) return [];

  const subscribers = [];
  for (const id of ids) {
    const raw = await redis.get(`subscriber:${type}:${id}`);
    const parsed = safeParse(raw);
    if (parsed) {
      subscribers.push(parsed);
    } else {
      // Data hilang dari Redis (TTL expired) → bersihkan dari set
      await redis.sRem(setKey, id);
    }
  }
  return subscribers;
}

export async function getActiveSubscribers(type = null) {
  let subscribers = [];

  if (type === 'user' || type === null) {
    const users = await getSubscribersByType('user');
    subscribers.push(...users.filter(s => s.status === 'active'));
  }

  if (type === 'group' || type === null) {
    const groups = await getSubscribersByType('group');
    subscribers.push(...groups.filter(s => s.status === 'active'));
  }

  return subscribers;
}

export async function getAllSubscribers() {
  const users = await getSubscribersByType('user');
  const groups = await getSubscribersByType('group');
  return [...users, ...groups];
}

// ==================== DEDUPLICATION ====================

export async function isNewsDispatched(newsHash) {
  const redis = await getRedisClient();
  const key = `news:dispatched:${newsHash}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markNewsDispatched(newsHash, metadata = {}) {
  const redis = await getRedisClient();
  const key = `news:dispatched:${newsHash}`;
  const data = {
    sent_timestamp: new Date().toISOString(),
    impact_category: metadata.impact_category || 'HIGH',
    source_tier: metadata.source_tier || 'CORE',
    topic_tags: metadata.topic_tags || [],
    execution_id: metadata.execution_id || 'unknown'
  };
  await redis.set(key, JSON.stringify(data), { EX: TTL.NEWS_DISPATCHED });
}

export async function isNewsDelivered(newsHash, chatId) {
  const redis = await getRedisClient();
  const key = `news:delivered:${newsHash}:${chatId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markNewsDelivered(newsHash, chatId, metadata = {}) {
  const redis = await getRedisClient();
  const key = `news:delivered:${newsHash}:${chatId}`;
  const data = {
    sent_timestamp: new Date().toISOString(),
    execution_id: metadata.execution_id || 'unknown'
  };
  await redis.set(key, JSON.stringify(data), { EX: TTL.NEWS_DELIVERED });
}

// ==================== HEALTH CHECK ====================

export async function updateHealthCheck() {
  const redis = await getRedisClient();
  const data = {
    last_successful_run: new Date().toISOString(),
    status: 'healthy'
  };
  await redis.set('health:last_successful_run', JSON.stringify(data), { EX: 86400 });
}

export async function getHealthStatus() {
  const redis = await getRedisClient();
  const raw = await redis.get('health:last_successful_run');
  const data = safeParse(raw);
  return data || { last_successful_run: null, status: 'unknown' };
}

// ==================== CIRCUIT BREAKER ====================

export async function getCircuitBreaker(sourceDomain) {
  const redis = await getRedisClient();
  const key = `circuit:${sourceDomain}`;
  const raw = await redis.get(key);
  return safeParse(raw);
}

export async function setCircuitBreaker(sourceDomain, failedCount, skipUntil) {
  const redis = await getRedisClient();
  const key = `circuit:${sourceDomain}`;
  const data = {
    failed_count: failedCount,
    last_failure: new Date().toISOString(),
    skip_until: skipUntil
  };
  await redis.set(key, JSON.stringify(data), { EX: TTL.CIRCUIT_BREAKER });
}

export async function incrementSourceFailure(sourceDomain) {
  const redis = await getRedisClient();
  const key = `circuit:${sourceDomain}`;
  const raw = await redis.get(key);
  const existing = safeParse(raw);
  const failedCount = (existing?.failed_count || 0) + 1;
  const skipUntil = failedCount >= 3
    ? new Date(Date.now() + 3600000).toISOString()
    : null;
  const data = {
    failed_count: failedCount,
    last_failure: new Date().toISOString(),
    skip_until: skipUntil
  };
  await redis.set(key, JSON.stringify(data), { EX: TTL.CIRCUIT_BREAKER });
  return data;
}

// ==================== ADMIN ====================

export async function getAdminUserIds() {
  const adminIds = process.env.ADMIN_USER_IDS?.split(',') || [];
  return adminIds.map(id => id.trim()).filter(Boolean);
}

export async function isAdmin(userId) {
  const adminIds = await getAdminUserIds();
  return adminIds.includes(String(userId));
}
