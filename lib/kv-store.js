import { Redis } from '@upstash/redis';
import { TTL } from './config.js';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

// ==================== SUBSCRIBER MANAGEMENT ====================

export async function addUser(chatId, metadata = {}) {
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
  
  await redis.set(key, subscriber);
  
  // Add to index
  await redis.sadd('subscribers:active:users', String(chatId));
  
  return subscriber;
}

export async function addGroup(chatId, metadata = {}) {
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
  
  await redis.set(key, subscriber);
  await redis.sadd('subscribers:active:groups', String(chatId));
  
  return subscriber;
}

export async function getSubscriber(type, chatId) {
  const key = `subscriber:${type}:${chatId}`;
  return await redis.get(key);
}

export async function updateSubscriberStatus(type, chatId, status) {
  const key = `subscriber:${type}:${chatId}`;
  const existing = await redis.get(key);
  
  if (!existing) return null;
  
  const updated = {
    ...existing,
    status,
    updated_at: new Date().toISOString()
  };
  
  await redis.set(key, updated);
  
  // Update index
  if (status === 'active') {
    await redis.sadd(`subscribers:active:${type}s`, String(chatId));
  } else {
    await redis.srem(`subscribers:active:${type}s`, String(chatId));
  }
  
  return updated;
}

export async function getActiveSubscribers(type = null) {
  let subscribers = [];
  
  if (type === 'user' || type === null) {
    const userIds = await redis.smembers('subscribers:active:users') || [];
    for (const id of userIds) {
      const sub = await redis.get(`subscriber:user:${id}`);
      if (sub && sub.status === 'active') {
        subscribers.push(sub);
      }
    }
  }
  
  if (type === 'group' || type === null) {
    const groupIds = await redis.smembers('subscribers:active:groups') || [];
    for (const id of groupIds) {
      const sub = await redis.get(`subscriber:group:${id}`);
      if (sub && sub.status === 'active') {
        subscribers.push(sub);
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
  const key = `news:dispatched:${newsHash}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markNewsDispatched(newsHash, metadata = {}) {
  const key = `news:dispatched:${newsHash}`;
  const data = {
    sent_timestamp: new Date().toISOString(),
    impact_category: metadata.impact_category || 'HIGH',
    source_tier: metadata.source_tier || 'CORE',
    topic_tags: metadata.topic_tags || [],
    execution_id: metadata.execution_id || 'unknown'
  };
  
  await redis.setex(key, TTL.NEWS_DISPATCHED, data);
}

export async function isNewsDelivered(newsHash, chatId) {
  const key = `news:delivered:${newsHash}:${chatId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function markNewsDelivered(newsHash, chatId, metadata = {}) {
  const key = `news:delivered:${newsHash}:${chatId}`;
  const data = {
    sent_timestamp: new Date().toISOString(),
    execution_id: metadata.execution_id || 'unknown'
  };
  
  await redis.setex(key, TTL.NEWS_DELIVERED, data);
}

// ==================== HEALTH CHECK ====================

export async function updateHealthCheck() {
  const data = {
    last_successful_run: new Date().toISOString(),
    status: 'healthy'
  };
  
  await redis.set('health:last_successful_run', data);
}

export async function getHealthStatus() {
  const data = await redis.get('health:last_successful_run');
  return data || { last_successful_run: null, status: 'unknown' };
}

// ==================== CIRCUIT BREAKER ====================

export async function getCircuitBreaker(sourceDomain) {
  const key = `circuit:${sourceDomain}`;
  return await redis.get(key);
}

export async function setCircuitBreaker(sourceDomain, failedCount, skipUntil) {
  const key = `circuit:${sourceDomain}`;
  const data = {
    failed_count: failedCount,
    last_failure: new Date().toISOString(),
    skip_until: skipUntil
  };
  
  await redis.setex(key, TTL.CIRCUIT_BREAKER, data);
}

export async function incrementSourceFailure(sourceDomain) {
  const key = `circuit:${sourceDomain}`;
  const existing = await redis.get(key);
  
  const failedCount = (existing?.failed_count || 0) + 1;
  const skipUntil = failedCount >= 3 
    ? new Date(Date.now() + 3600000).toISOString() 
    : null;
  
  const data = {
    failed_count: failedCount,
    last_failure: new Date().toISOString(),
    skip_until: skipUntil
  };
  
  await redis.setex(key, TTL.CIRCUIT_BREAKER, data);
  
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