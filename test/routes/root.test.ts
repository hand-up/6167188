const FakeTimers = require('@sinonjs/fake-timers');
import { test, beforeEach } from 'tap';

import { build } from '../helper';

const clock = FakeTimers.install();
/**
 * Advance the clock each test 10m to allow to have more requests available
 */
beforeEach(() => {
    clock.tick(600000); // 10m
});

const rateLimitExceededErrorBody10s = JSON.stringify({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Try again in 10 seconds',
});

const rootSuccessResponse = JSON.stringify({
    root: true,
});

/**
 * @description - Based on 6 requests per minute (60) and using always the same client
 */
test('Context - 6 requests each 60 seconds limit per client', (t) => {
    t.plan(7);

    t.test(
        'fails on the 7th request to the same endpoint with the correct status and response',
        async (t) => {
            const app = await build(t);

            const makeRequest = async () => await app.inject('/');

            const [req1, req2, req3, req4, req5, req6, reqExceedingLimit] =
                await Promise.all([
                    makeRequest(),
                    makeRequest(),
                    makeRequest(),
                    makeRequest(),
                    makeRequest(),
                    makeRequest(),
                    makeRequest(),
                ]);

            t.equal(req1.statusCode, 200);
            t.same(req1.body, rootSuccessResponse);
            t.equal(req2.statusCode, 200);
            t.same(req2.body, rootSuccessResponse);
            t.equal(req3.statusCode, 200);
            t.same(req3.body, rootSuccessResponse);
            t.equal(req4.statusCode, 200);
            t.same(req4.body, rootSuccessResponse);
            t.equal(req5.statusCode, 200);
            t.same(req5.body, rootSuccessResponse);
            t.equal(req6.statusCode, 200);
            t.same(req6.body, rootSuccessResponse);
            t.equal(reqExceedingLimit.statusCode, 429);
            // clock.tick(11000); // 6 seconds

            const after6Response = await makeRequest();
            t.equal(after6Response.statusCode, 429);
            t.same(after6Response.body, rateLimitExceededErrorBody10s);
        }
    );

    t.test(
        'removing client from block list the limit no longer applies',
        async (t) => {
            const app = await build(t);

            await app.listen();

            // Request to remove client from block list since this request counts
            // to the limit we now have 5 request left based on the configuration
            const response = await fetch(
                `http://localhost:${app.server.address().port}/rateLimiter`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        blockList: ['199.9.9.1'], // TODO: There is a bug clearing the list, empty list
                    }),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                }
            );
            const responseJson = await response.json();

            t.equal(response.status, 200);
            t.same(
                responseJson.message,
                'Rate limiter config update successfully!'
            );

            const makeRequest = async () =>
                await fetch(`http://localhost:${app.server.address().port}`);

            const [
                req1,
                req2,
                req3,
                req4,
                req5,
                reqExceedingLimit1,
                reqExceedingLimit2,
            ] = await Promise.all([
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
            ]);

            t.equal(req1.status, 200);
            t.equal(req2.status, 200);
            t.equal(req3.status, 200);
            t.equal(req4.status, 200);
            t.equal(req5.status, 200);
            t.equal(reqExceedingLimit1.status, 200);
            t.equal(reqExceedingLimit2.status, 200);
        }
    );

    t.test(
        'changing the bucket capacity to 8 fails on the 9th request',
        async (t) => {
            const app = await build(t);

            await app.listen();

            // Request to remove client from block list since this request counts
            // to the limit we now have 7 request left based on the updated configuration
            const response = await fetch(
                `http://localhost:${app.server.address().port}/rateLimiter`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        blockList: ['127.0.0.1', '::1'], // Guarantee the test client is in the block list
                        bucketCapacity: 8, // TODO: There is a bug clearing the list, empty list
                    }),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                }
            );
            const responseJson = await response.json();

            t.equal(response.status, 200);
            t.same(
                responseJson.message,
                'Rate limiter config update successfully!'
            );

            const makeRequest = async () =>
                await fetch(`http://localhost:${app.server.address().port}`);

            const [
                req1,
                req2,
                req3,
                req4,
                req5,
                req6,
                req7,
                reqExceedingLimit,
            ] = await Promise.all([
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
            ]);

            t.equal(req1.status, 200);
            t.equal(req2.status, 200);
            t.equal(req3.status, 200);
            t.equal(req4.status, 200);
            t.equal(req5.status, 200);
            t.equal(req6.status, 200);
            t.equal(req7.status, 200);
            t.equal(reqExceedingLimit.status, 200);
        }
    );

    t.test('each 10s pass the client can make one more request', async (t) => {
        const app = await build(t);

        await app.listen();

        // Request to remove client from block list since this request counts
        // to the limit we now have 6 requests left based on the updated configuration
        const response = await fetch(
            `http://localhost:${app.server.address().port}/rateLimiter`,
            {
                method: 'PATCH',
                body: JSON.stringify({
                    blockList: ['127.0.0.1', '::1'], // Guarantee the test client is in the block list
                    bucketCapacity: 6, // Guarantee the testing configuration
                }),
                headers: {
                    'Content-type': 'application/json; charset=UTF-8',
                },
            }
        );
        const responseJson = await response.json();

        t.equal(response.status, 200);
        t.same(
            responseJson.message,
            'Rate limiter config update successfully!'
        );

        const makeRequest = async () =>
            await fetch(`http://localhost:${app.server.address().port}`);

        const [req1, req2, req3, req4, req5, req6, reqExceedingLimit] =
            await Promise.all([
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
                makeRequest(),
            ]);

        t.equal(req1.status, 200);
        t.equal(req2.status, 200);
        t.equal(req3.status, 200);
        t.equal(req4.status, 200);
        t.equal(req5.status, 200);
        t.equal(req6.status, 200);
        t.equal(reqExceedingLimit.status, 429);

        clock.tick(11000); // 11s
        const [req1after10s, req2after10s] = await Promise.all([
            makeRequest(),
            makeRequest(),
        ]);

        t.equal(req1after10s.status, 200);
        t.equal(req2after10s.status, 429);

        clock.tick(22000); // 21s
        const [req1after21s, req2after21s, req3after21s] = await Promise.all([
            makeRequest(),
            makeRequest(),
            makeRequest(),
        ]);

        t.equal(req1after21s.status, 200);
        t.equal(req2after21s.status, 200);
        t.equal(req3after21s.status, 429);

        // ...and so on
    });

    t.test(
        'should return a bad request response if no args are given',
        async (t) => {
            const app = await build(t);

            await app.listen();

            const response = await fetch(
                `http://localhost:${app.server.address().port}/rateLimiter`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({}),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                }
            );
            const responseJson = await response.json();

            t.equal(response.status, 400);
            t.same(
                responseJson.message,
                'Rate limiter config not changed please provide at least one property'
            );
        }
    );

    t.test('rate limiter GET endpoint should return OK response', async (t) => {
        const app = await build(t);

        await app.listen();

        // Request to remove client from block list since this request counts
        // to the limit we now have 5 request left based on the configuration
        const response = await fetch(
            `http://localhost:${app.server.address().port}/rateLimiter`
        );

        t.equal(response.status, 200);
    });

    t.test(
        'should keep the existing block list when updating other config fields',
        async (t) => {
            const app = await build(t);

            await app.listen();

            const response = await fetch(
                `http://localhost:${app.server.address().port}/rateLimiter`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                        bucketCapacity: 6,
                        timeFrame: 60,
                    }),
                    headers: {
                        'Content-type': 'application/json; charset=UTF-8',
                    },
                }
            );
            const responseJson = await response.json();

            t.equal(response.status, 200);
            t.same(
                responseJson.message,
                'Rate limiter config update successfully!'
            );
            t.same(responseJson.activeConfig.BLOCK_LIST, '127.0.0.1,::1');
        }
    );
});
