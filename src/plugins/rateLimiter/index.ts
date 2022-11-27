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

        // ℹ️ INFO: If we needed a per request custom logic
        // fastify.decorate(
        //     'isClientLimitExceeded',
        //     rateLimiter.isClientLimitExceeded
        // );
        // await fastify.ready()

        fastify.addHook('onRequest', async (request, reply) => {
            const clientIdentifier = request.ip;
            const { isLimitExceeded, retryAfter } =
                rateLimiter.isClientLimitExceeded(clientIdentifier);

            if (isLimitExceeded) {
                request.log.warn(
                    `Client ${clientIdentifier} exceeded rate limit`
                );
                reply.status(429);
                reply.header('Retry-After', retryAfter);
                reply.send(new RateLimitError(retryAfter));
            }
        });

        next();
    }
);

// ℹ️ INFO: If we needed a per request custom logic
// declare module 'fastify' {
//     export interface FastifyInstance {
//         isClientLimitExceeded(clientIdentifier: string): {
//             isLimitExceeded: boolean;
//             retryAfter?: number;
//         };
//     }
// }
