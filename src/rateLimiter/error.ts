export class RateLimitError extends Error {
    constructor(retryAfter: number) {
        super(`Rate limit exceeded. Try again in ${retryAfter} seconds`);

        this.name = this.constructor.name;

        // capturing the stack trace keeps the reference to your error class
        Error.captureStackTrace(this, this.constructor);
    }
}
