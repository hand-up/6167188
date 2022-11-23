const schema = {
    type: 'object',
    required: [],
    properties: {
        BLOCK_LIST: {
            type: 'string',
            default: '',
        },
        BUCKET_CAPACITY: {
            type: 'number',
            default: 6, // Max 6 requests
        },
        TIME_FRAME: {
            type: 'number',
            default: 60, // max requests counts in this time frame duration
        },
    },
};

export type configType = {
    BLOCK_LIST: string;
    BUCKET_CAPACITY: number;
    TIME_FRAME: number;
};

export const config = {
    dotenv: true,
    confKey: 'rateLimiterConfig',
    schema: schema,
};
