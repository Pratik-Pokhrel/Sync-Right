import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "./redis.js";

// wraps the shared ioredis client so that the express-rate-limit reads/writes its counters through Redis instead of in-memory Map
// this means that counters survive server restarts

const makeStore = (prefix) =>
  new RedisStore({
    sendCommand: (...args) => redis.call(...args),
    prefix: `rl:${prefix}:`, // keeps auth counters and api counters in separate key spaces
  });

// Auth routes (like login, register, refresh) are the targets for brute force so this needs a bit restriction
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many attempts, please try again after 15 minutes......",
  },
  store: makeStore("auth"),
});

// Everything else (like rooms, messages, calls, admin) is treated in less strict manner
export const apiLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many requests, please try again after 2 minutes......",
  },
  store: makeStore("api"),
});

// "store" is the key here, it tells express-rate-limit to use Redis for storing the counters instead of the default in-memory store.
