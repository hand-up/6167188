import fp from 'fastify-plugin';
import { FastifyError, FastifyInstance, FastifyPluginOptions } from 'fastify';
import { RateLimitError } from './error';
import { RateLimiter } from './service';

export const rateLimiterService = fp(
    async (
        fastify: FastifyInstance,
        options: FastifyPluginOptions,
        next: (error?: FastifyError) => void
    ): Promise<void> => {
        const rateLimiter = await RateLimiter.getInstance();

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
