const IORedis = require("ioredis");

// Load environment variables
const redisConfig = {
    host: process.env.REDIS_HOST || "10.1.1.61",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 100, 3000),
};

const redis = new IORedis(redisConfig);

redis.on("connecting", () => console.log(" Redis connecting..."));
redis.on("ready", () => console.log(" Redis connected and ready"));
redis.on("error", (err) => console.error(" Redis error:", err.message));
redis.on("close", () => console.warn(" Redis connection closed"));
redis.on("reconnecting", (delay) =>
    console.log(` Redis reconnecting in ${delay}ms...`)
);

(async () => {
    try {
        const pong = await redis.ping();
        console.log(" Redis ping response:", pong);
    } catch (err) {
        console.error(" Redis ping failed:", err.message);
    }
})();

process.on("SIGINT", async () => {
    console.log(" Closing Redis connection (SIGINT)...");
    await redis.quit();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log(" Closing Redis connection (SIGTERM)...");
    await redis.quit();
    process.exit(0);
});

module.exports = redis;