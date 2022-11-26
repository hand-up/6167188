const Redis = require('ioredis'); // TODO: Fix this
import { configType, RateLimiterEnumConfig } from './config';

const redis = new Redis();

/**
 * @description - Bootstrap rate limiter config cache, caches ENV defaults if no cached values exist
 * @return - The Redis client instance
 */
export async function bootstrapRateLimiterConfigCache(): Promise<configType> {
    const { BLOCK_LIST, BUCKET_CAPACITY, TIME_FRAME } = RateLimiterEnumConfig;

    const rateLimiterConfigCachedPromises = await Promise.allSettled([
        redis.get(BLOCK_LIST),
        redis.get(BUCKET_CAPACITY),
        redis.get(TIME_FRAME),
    ]);

    const [cachedBlockList, cachedBucketCapacity, cachedTimeFrame] =
        rateLimiterConfigCachedPromises.map((p) =>
            p.status === 'fulfilled' ? p.value : undefined
        );

    if (!cachedBlockList) {
        redis.set(BLOCK_LIST, process.env.BLOCK_LIST);
    }

    if (!cachedBucketCapacity) {
        redis.set(BUCKET_CAPACITY, process.env.BUCKET_CAPACITY);
    }

    if (!cachedTimeFrame) {
        // TODO: Think if it's really needed to wait this 3
        await redis.set(TIME_FRAME, process.env.TIME_FRAME);
    }

    return {
        BLOCK_LIST: cachedBlockList || BLOCK_LIST,
        BUCKET_CAPACITY: cachedBucketCapacity || BUCKET_CAPACITY,
        TIME_FRAME: cachedTimeFrame || TIME_FRAME,
    };
}

export async function updateRateLimiterConfigCache(
    newConfig: Partial<configType> = {}
) {
    const { BLOCK_LIST, BUCKET_CAPACITY, TIME_FRAME } = RateLimiterEnumConfig;

    if (newConfig.BLOCK_LIST) {
        redis.set(BLOCK_LIST, newConfig.BLOCK_LIST);
    }

    if (newConfig.BUCKET_CAPACITY) {
        redis.set(BUCKET_CAPACITY, newConfig.BUCKET_CAPACITY);
    }

    if (newConfig.TIME_FRAME) {
        redis.set(TIME_FRAME, newConfig.TIME_FRAME);
    }
}
