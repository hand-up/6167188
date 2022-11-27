import { FastifyPluginAsync } from 'fastify';
import { RateLimiter } from '../../plugins/rateLimiter/service';

const rateLimiterPatchSchema = {
    body: {
        type: 'object',
        properties: {
            blockList: {
                description: 'Client Ips Block list',
                type: 'array',
                items: {
                    type: 'string',
                },
                minItems: 1,
                uniqueItems: true,
            },
            bucketCapacity: { type: 'number', minimum: 6 },
            timeFrame: { type: 'number', minimum: 60 },
        },
    },
};

type patchBodyType = {
    blockList?: string[];
    bucketCapacity?: number;
    timeFrame?: number;
};

const rateLimiterController: FastifyPluginAsync = async (
    fastify
): Promise<void> => {
    fastify.get('/', async function () {
        return 'Rate Limiter is alive!';
    });

    fastify.patch(
        '/',
        { schema: rateLimiterPatchSchema },
        async function (request, reply) {
            const { blockList, bucketCapacity, timeFrame } =
                request.body as patchBodyType;

            // TODO: Improve schema, proper validation and typings
            if (!blockList && !bucketCapacity && !timeFrame) {
                reply.status(400);
                reply.send({
                    message: `Rate limiter config not changed please provide at least one property`,
                });
                return reply;
            }

            const rateLimiter = await RateLimiter.getInstance();
            const updatedConfig = await rateLimiter.updateConfig({
                BLOCK_LIST: blockList
                    ? blockList.map((e) => e.trim()).join(',')
                    : undefined,
                BUCKET_CAPACITY: bucketCapacity,
                TIME_FRAME: timeFrame,
            });

            reply.send({
                message: `Rate limiter config update successfully!`,
                activeConfig: updatedConfig,
            });

            return reply;
        }
    );
};

export default rateLimiterController;
