export type configType = {
    BLOCK_LIST: string;
    BUCKET_CAPACITY: number;
    TIME_FRAME: number;
};

export enum RateLimiterEnumConfig {
    BLOCK_LIST = 'BLOCK_LIST',
    BUCKET_CAPACITY = 'BUCKET_CAPACITY',
    TIME_FRAME = 'TIME_FRAME',
}
