import { FastifyPluginAsync } from 'fastify';
import { RateLimiter } from '../../plugins/rateLimiter/service';

const example: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
    fastify.patch('/', async function (request, reply) {
        const rateLimiter = RateLimiter.getInstance();
        rateLimiter.updateConfig({
            BUCKET_CAPACITY: 3,
        });

        return {
            message: `Rate limiter config update successfully!`,
            changes: {
                BUCKET_CAPACITY: 3,
            },
        };
    });
};

export default example;
