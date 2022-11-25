import fp from 'fastify-plugin';
import { TimeUnitEnum } from './constants';
import { FastifyError, FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getSecondsELapsedTillNow } from '../utils/time';
import { configType, RateLimiterEnumConfig } from './config';
import { RateLimitError } from './error';
import { bootstrapRateLimiterCache } from './cache';

class Bucket {
    readonly #capacity: number;
    readonly #fillPerSecond: number;
    #tokens: number;
    #lastFilled: number;

    /**
     * @example requester [IP] will be able to do 5 [limit] requests per 1 [timeframe ]second [timeUnit]
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

class RateLimiter {
    readonly #config: configType;
    #buckets: Record<string, any>;
    readonly #blockList: Set<string>;

    constructor(config: configType) {
        this.#buckets = new Map();
        this.#blockList = new Set(config.BLOCK_LIST.split(','));
        this.#config = config;
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

export const rateLimiterService = fp(
    async (
        fastify: FastifyInstance,
        options: FastifyPluginOptions,
        next: (error?: FastifyError) => void
    ): Promise<void> => {
        const rateLimiterRedis = await bootstrapRateLimiterCache();
        const [BLOCK_LIST, BUCKET_CAPACITY, TIME_FRAME] = await Promise.all([
            rateLimiterRedis.get(RateLimiterEnumConfig.BLOCK_LIST),
            rateLimiterRedis.get(RateLimiterEnumConfig.BUCKET_CAPACITY),
            rateLimiterRedis.get(RateLimiterEnumConfig.TIME_FRAME),
        ]);

        const rateLimiter = new RateLimiter({
            BLOCK_LIST,
            BUCKET_CAPACITY,
            TIME_FRAME,
        });

        fastify.addHook('onRequest', async (request, reply) => {
            const rateLimiterClientIdentifier = request.ip;
            const {
                isClientUnderRateLimitRestrictions,
                createOrUpdateClientBucket,
            } = rateLimiter;
            if (
                isClientUnderRateLimitRestrictions(rateLimiterClientIdentifier)
            ) {
                next();
            }

            const bucket = createOrUpdateClientBucket(
                rateLimiterClientIdentifier
            );
            const { isLimitExceeded, retryAfter } = bucket.take();

            if (isLimitExceeded) {
                request.log.warn(
                    `Client ${rateLimiterClientIdentifier} exceeded rate limit`
                );
                reply.status(429);
                reply.header('Retry-After', retryAfter);
                reply.send(new RateLimitError(retryAfter));
            }
        });

        next();
    }
);
