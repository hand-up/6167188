import { TimeUnitEnum } from './constants';
import { getSecondsELapsedTillNow } from '../../utils/time';
import { configType } from './config';
import { updateConfigCache } from './cache';

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
    readonly #blockList: Set<string>;

    private constructor(config?: configType) {
        this.#buckets = new Map();
        this.#blockList = new Set(config?.BLOCK_LIST.split(',') || []);
        this.#config = { ...this.#config, ...config };
    }

    static getInstance(config?: configType): RateLimiter {
        if (!RateLimiter.#instance) {
            RateLimiter.#instance = new RateLimiter(config);
        }

        return RateLimiter.#instance;
    }

    updateConfig(config: Partial<configType> = {}) {
        updateConfigCache(config);
        RateLimiter.#instance.#config = {
            ...RateLimiter.#instance.#config,
            ...config,
        };
        // Reset buckets
        this.#buckets = new Map();
    }

    isClientUnderRateLimitRestrictions(clientIdentifier: string) {
        return !this.#blockList.has(clientIdentifier);
    }

    createOrUpdateClientBucket(clientIdentifier: string) {
        if (!this.#buckets.has(clientIdentifier)) {
            const { BUCKET_CAPACITY, TIME_FRAME } = this.#config;

            this.#buckets.set(
                clientIdentifier,
                new Bucket(BUCKET_CAPACITY, TIME_FRAME)
            ); // defaults 6 requests per minute (60s)
        }

        return this.#buckets.get(clientIdentifier);
    }
}
