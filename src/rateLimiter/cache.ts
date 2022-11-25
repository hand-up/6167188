const Redis = require('ioredis'); // TODO: Fix this
import { RateLimiterEnumConfig } from './config';

const redis = new Redis();

export async function bootstrapRateLimiterCache() {
    // Get configuration from database or fill cache with defaults
    const blockList = ['127.0.0.1', '::1'];
    redis.set(RateLimiterEnumConfig.BLOCK_LIST, '');
    redis.set(RateLimiterEnumConfig.BLOCK_LIST, blockList.toString());
    redis.set(RateLimiterEnumConfig.BUCKET_CAPACITY, 6);
    redis.set(RateLimiterEnumConfig.TIME_FRAME, 60);

    return redis;
}
