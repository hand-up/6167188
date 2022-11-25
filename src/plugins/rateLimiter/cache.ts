const Redis = require('ioredis'); // TODO: Fix this
import { configType, RateLimiterEnumConfig } from './config';

const redis = new Redis();

export function bootstrapRateLimiterCache() {
    // Get configuration from database or fill cache with defaults
    const blockList = ['127.0.0.1', '::1'];
    redis.set(RateLimiterEnumConfig.BLOCK_LIST, '');
    redis.set(RateLimiterEnumConfig.BLOCK_LIST, blockList.toString());
    redis.set(RateLimiterEnumConfig.BUCKET_CAPACITY, 6);
    redis.set(RateLimiterEnumConfig.TIME_FRAME, 60);

    return redis;
}

export function updateConfigCache(config: Partial<configType> = {}) {
    const { BUCKET_CAPACITY, TIME_FRAME } = config;
    // Bucket cache
    BUCKET_CAPACITY &&
        redis.set(RateLimiterEnumConfig.BUCKET_CAPACITY, BUCKET_CAPACITY);
    TIME_FRAME && redis.set(RateLimiterEnumConfig.TIME_FRAME, TIME_FRAME);
    // BlockList cache
}
