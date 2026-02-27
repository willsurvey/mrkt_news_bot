import { createClient } from 'redis';
import { TTL } from './config.js';

// Initialize Redis client dengan URL dari environment
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect on first use
let connected = false;
async function ensureConnected() {
  if (!connected) {
    try {
      await redis.connect();
      connected = true;
      console.log('✅ Redis connected');
    } catch (error) {
      console.error('❌ Redis connection error:', error.message);
      throw error;
    }
  }
}

// ==================== SUBSCRIBER MANAGEMENT ====================
export async function addUser(chatId, metadata = {}) {
  await ensureConnected();
  const key = `subscriber:user:${chatId}`;
  const existing = await redis.get(key);
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
  await redis.set(key, JSON.stringify(subscriber), { EX: TTL.NEWS_DISPATCHED });
  await redis.sAdd('subscribers:active:users', String(chatId));
  return subscriber;
}

export async function addGroup(chatId, metadata = {}) {
  await ensureConnected();
  const key = `subscriber:group:${chatId}`;
  const existing = await redis.get(key);
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
  await redis.set(key, JSON.stringify(subscriber), { EX: TTL.NEWS_DISPATCHED });
  await redis.sAdd('subscribers:active:groups', String(chatId));
  return subscriber;
}

export async function getSubscriber(type, chatId) {
  await ensureConnected();
  const key = `subscriber:${type}:${chatId}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function updateSubscriberStatus(type, chatId, status) {
  await ensureConnected();
  const key = `subscriber:${type}:${chatId}`;
  const existing = await redis.get(key);
  if (!existing) return null;
  const parsed = JSON.parse(existing);
  const updated = {
    ...parsed,
    status,
    updated_at: new Date().toISOString()
  };
  await redis.set(key, JSON.stringify(updated), { EX: TTL.NEWS_DISPATCHED });
  if (status === 'active') {
    await redis.sAdd(`subscribers:active:${type}s`, String(chatId));
  } else {
    await redis.sRem(`subscribers:active:${type}s`, String(chatId));
  }
  return updated;
}

export async function getActiveSubscribers(type = null) {
  await ensureConnected();
  let subscribers = [];
  
  if (type === 'user' || type === null) {
    const userIds = await redis.sMembers('subscribers:active:users') || [];
    for (const id of userIds) {
      const sub = await redis.get(`subscriber:user:${id}`);
      if (sub) {
        const parsed = JSON.parse(sub);
        if (parsed.status === 'active') {
          subscribers.push(parsed);
        }
      }
    }
  }
  
  if (type === 'group' || type === null) {
    const groupIds = await redis.sMembers('subscribers:active:groups') || [];
    for (const id of groupIds) {
      const sub = await redis.get(`subscriber:group:${id}`);
      if (sub) {
        const parsed = JSON.parse(sub);
        if (parsed.status === 'active') {
          subscribers.push(parsed);
        }
      }
    }
  }
  
  return subscribers;
}

export async function getAllSubscribers() {
  const users = await getActiveSubscribers('user');
  const groups = await getActiveSubscribers('group');
  return [...users, ...groups];
}

// ==================== DEDUPLICATION ====================
export async function isNewsDispatched(newsHash) {
  await ensureConnected();
  const key = `news:dispatched:${newsHash}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markNewsDispatched(newsHash, metadata = {}) {
  await ensureConnected();
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
  await ensureConnected();
  const key = `news:delivered:${newsHash}:${chatId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markNewsDelivered(newsHash, chatId, metadata = {}) {
  await ensureConnected();
  const key = `news:delivered:${newsHash}:${chatId}`;
  const data = {
    sent_timestamp: new Date().toISOString(),
    execution_id: metadata.execution_id || 'unknown'
  };
  await redis.set(key, JSON.stringify(data), { EX: TTL.NEWS_DELIVERED });
}

// ==================== HEALTH CHECK ====================
export async function updateHealthCheck() {
  await ensureConnected();
  const data = {
    last_successful_run: new Date().toISOString(),
    status: 'healthy'
  };
  await redis.set('health:last_successful_run', JSON.stringify(data), { EX: 86400 });
}

export async function getHealthStatus() {
  await ensureConnected();
  const data = await redis.get('health:last_successful_run');
  return data ? JSON.parse(data) : { last_successful_run: null, status: 'unknown' };
}

// ==================== CIRCUIT BREAKER ====================
export async function getCircuitBreaker(sourceDomain) {
  await ensureConnected();
  const key = `circuit:${sourceDomain}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setCircuitBreaker(sourceDomain, failedCount, skipUntil) {
  await ensureConnected();
  const key = `circuit:${sourceDomain}`;
  const data = {
    failed_count: failedCount,
    last_failure: new Date().toISOString(),
    skip_until: skipUntil
  };
  await redis.set(key, JSON.stringify(data), { EX: TTL.CIRCUIT_BREAKER });
}

export async function incrementSourceFailure(sourceDomain) {
  await ensureConnected();
  const key = `circuit:${sourceDomain}`;
  const existing = await redis.get(key);
  const parsed = existing ? JSON.parse(existing) : null;
  const failedCount = (parsed?.failed_count || 0) + 1;
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
  return adminIds.map(id => id.trim()).filter(id => id);
}

export async function isAdmin(userId) {
  const adminIds = await getAdminUserIds();
  return adminIds.includes(String(userId));
}