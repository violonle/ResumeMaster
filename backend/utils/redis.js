const Redis = require('ioredis');
const logger = require('./logger');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  db: process.env.REDIS_DB || 0,
  maxRetriesPerRequest: null,
};

const redis = new Redis(redisConfig);

redis.on('error', (err) => {
  logger.error('[Redis] Connection error:', err);
});

redis.on('connect', () => {
  logger.info('[Redis] Connected successfully');
});

/**
 * 获取分布式锁
 * @param {string} key 锁的键名
 * @param {number} ttl 锁的过期时间（毫秒）
 * @returns {Promise<boolean>} 是否成功获取锁
 */
async function acquireLock(key, ttl = 30000) {
  const result = await redis.set(key, 'locked', 'PX', ttl, 'NX');
  return result === 'OK';
}

/**
 * 释放分布式锁
 * @param {string} key 锁的键名
 */
async function releaseLock(key) {
  await redis.del(key);
}

module.exports = {
  redis,
  acquireLock,
  releaseLock
};
