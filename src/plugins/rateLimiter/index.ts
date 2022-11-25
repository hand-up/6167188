import fp from 'fastify-plugin';
import { FastifyError, FastifyInstance, FastifyPluginOptions } from 'fastify';
import { RateLimiterEnumConfig } from './config';
import { RateLimitError } from './error';
import { bootstrapRateLimiterCache } from './cache';
import { RateLimiter } from './service';

export const rateLimiterService = fp(
    async (
        fastify: FastifyInstance,
        options: FastifyPluginOptions,
        next: (error?: FastifyError) => void
    ): Promise<void> => {
        const rateLimiterRedis = bootstrapRateLimiterCache();
        const [BLOCK_LIST, BUCKET_CAPACITY, TIME_FRAME] = await Promise.all([
            rateLimiterRedis.get(RateLimiterEnumConfig.BLOCK_LIST),
            rateLimiterRedis.get(RateLimiterEnumConfig.BUCKET_CAPACITY),
            rateLimiterRedis.get(RateLimiterEnumConfig.TIME_FRAME),
        ]);

        const rateLimiter = RateLimiter.getInstance({
            BLOCK_LIST,
            BUCKET_CAPACITY,
            TIME_FRAME,
        });

        fastify.addHook('onRequest', async (request, reply) => {
            const rateLimiterClientIdentifier = request.ip;

            if (
                rateLimiter.isClientUnderRateLimitRestrictions(
                    rateLimiterClientIdentifier
                )
            ) {
                next();
            }

            const bucket = rateLimiter.createOrUpdateClientBucket(
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
