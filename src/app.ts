import { join } from 'path';
import AutoLoad, { AutoloadPluginOptions } from '@fastify/autoload';
import { FastifyPluginAsync } from 'fastify';
import { rateLimiterService } from './rateLimiter/service';
import fastifyEnv from '@fastify/env';
import { config } from './rateLimiter/config';

declare module 'fastify' {
    interface FastifyInstance {
        rateLimiterConfig?: {};
    }
}

export type AppOptions = {} & Partial<AutoloadPluginOptions>;

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const app: FastifyPluginAsync<AppOptions> = async (
    fastify,
    opts
): Promise<void> => {
    // Place here your custom code!
    fastify.register(fastifyEnv, config);
    await fastify.after();

    fastify.register(rateLimiterService, {
        config: fastify.rateLimiterConfig,
    });
    // Do not touch the following lines

    // This loads all plugins defined in plugins
    // those should be support plugins that are reused
    // through your application
    fastify.register(AutoLoad, {
        dir: join(__dirname, 'plugins'),
        options: opts,
    });

    // This loads all plugins defined in routes
    // define your routes in one of these
    fastify.register(AutoLoad, {
        dir: join(__dirname, 'routes'),
        options: opts,
    });
};

export default app;
export { app, options };
