import { TimeUnitEnum } from './constants';
import { getSecondsELapsedTillNow } from '../../utils/time';
import { configType } from './config';
import {
    bootstrapRateLimiterConfigCache,
    updateRateLimiterConfigCache,
} from './cache';

class Bucket {
    readonly #capacity: number;
    readonly #fillPerSecond: number;
    #tokens: number;
    #lastFilled: number;

    /**
     * @rateLimiter requester [IP] will be able to do 5 [limit] requests per 1 [timeframe ]second [timeUnit]
     * @param limit - request number limit
     * @param timeFrame - timeframe duration where the limit is active
     * @param timeUnit - time unit applied to the timeframe duration
     */
    constructor(
        limit: number,
        timeFrame: number,
        timeUnit: TimeUnitEnum = TimeUnitEnum.second
    ) {
        this.#capacity = limit;
        this.#lastFilled = Date.now();
        this.#fillPerSecond = limit / timeFrame;
        this.#tokens = limit;
    }

    take(): {
        isLimitExceeded: boolean;
        retryAfter?: number;
    } {
        this.#refill();

        if (this.#tokens > 0) {
            this.#tokens = this.#tokens - 1;
            return {
                isLimitExceeded: false,
            };
        }

        return {
            isLimitExceeded: true,
            retryAfter: 1 / this.#fillPerSecond,
        };
    }

    #refill() {
        const secondsBetweenLastRefillAndNow = getSecondsELapsedTillNow(
            this.#lastFilled
        );

        this.#tokens = Math.min(
            this.#capacity,
            this.#tokens +
                Math.floor(secondsBetweenLastRefillAndNow * this.#fillPerSecond)
        );

        this.#lastFilled = Date.now();
    }
}

export class RateLimiter {
    static #instance: RateLimiter;
    #config: configType = {
        BLOCK_LIST: '',
        BUCKET_CAPACITY: 6,
        TIME_FRAME: 60,
    };
    #buckets: Record<string, any>;
    #blockList: Set<string>;

    private constructor(config: configType) {
        this.#buckets = new Map();
        this.#blockList = new Set(config.BLOCK_LIST.split(',') || []);
        this.#config = config;
    }

    static async getInstance(): Promise<RateLimiter> {
        if (!RateLimiter.#instance) {
            const config = await bootstrapRateLimiterConfigCache();
            RateLimiter.#instance = new RateLimiter(config);
        }

        return RateLimiter.#instance;
    }

    async updateConfig(newConfig: Partial<configType> = {}) {
        // TODO: use a "clean config" as source of truth here to improve consistency

        // Update cache
        await updateRateLimiterConfigCache(newConfig);

        // Update singleton instance
        const { BLOCK_LIST, BUCKET_CAPACITY, TIME_FRAME } =
            RateLimiter.#instance.#config;

        const updatedConfig = {
            BLOCK_LIST: newConfig.BLOCK_LIST || BLOCK_LIST,
            BUCKET_CAPACITY: newConfig.BUCKET_CAPACITY || BUCKET_CAPACITY,
            TIME_FRAME: newConfig.TIME_FRAME || TIME_FRAME,
        };

        RateLimiter.#instance.#config = updatedConfig;
        if (newConfig.BLOCK_LIST) {
            RateLimiter.#instance.#blockList = new Set(
                newConfig.BLOCK_LIST?.split(',')
            );
        }
        /**
         * Clear current buckets
         * This means that all active limits are reset at this point
         * There would be several alternatives depending on what was needed this in probably the simplest :)
         */
        // TODO: Caution this only works per machine
        this.#buckets = new Map();

        return updatedConfig;
    }

    #isClientUnderRateLimitRestrictions(clientIdentifier: string) {
        return this.#blockList.has(clientIdentifier);
    }

    #createOrUpdateClientBucket(clientIdentifier: string) {
        if (!this.#buckets.has(clientIdentifier)) {
            const { BUCKET_CAPACITY, TIME_FRAME } = this.#config;

            this.#buckets.set(
                clientIdentifier,
                new Bucket(BUCKET_CAPACITY, TIME_FRAME)
            ); // defaults 6 requests per minute (60s)
        }

        return this.#buckets.get(clientIdentifier);
    }

    isClientLimitExceeded(clientIdentifier: string) {
        if (!this.#isClientUnderRateLimitRestrictions(clientIdentifier)) {
            return {
                isLimitExceeded: false,
            };
        }

        const clientBucket = this.#createOrUpdateClientBucket(clientIdentifier);

        const { isLimitExceeded, retryAfter } = clientBucket.take();

        return {
            isLimitExceeded,
            retryAfter,
        };
    }
}
