/**
 * Cache Layer - Redis-backed caching for performance optimization
 * 
 * Provides:
 * - Dashboard stats caching (60s TTL)
 * - Contact lookup caching (5min TTL)
 * - Generic cache with configurable TTL
 * - Cache invalidation helpers
 * 
 * Falls back to no-op cache if Redis is not configured.
 */

// Redis cache implementation
// Note: redis package is optional - install with: npm install redis

// TODO: Install redis package to enable caching
// import { createClient, type RedisClientType } from "redis";

// Temporary type stub until redis is installed
type RedisClientType = any;
const createClient = (_opts: any) => null;

// ========================================
// CONFIGURATION
// ========================================

const REDIS_URL = process.env.REDIS_URL;
const CACHE_ENABLED = REDIS_URL && REDIS_URL !== "redis://placeholder:6379";

// TTL Constants
export const TTL = {
  DASHBOARD_STATS: 60,           // 1 minute
  CONTACT_LOOKUP: 300,           // 5 minutes
  CONTACT_LIST: 120,             // 2 minutes
  JOB_LIST: 120,                 // 2 minutes
  SETTINGS: 300,                 // 5 minutes
  GENERIC: 300,                  // 5 minutes
} as const;

// ========================================
// REDIS CLIENT
// ========================================

let redisClient: RedisClientType | null = null;
let connectionPromise: Promise<void> | null = null;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (!CACHE_ENABLED) {
    return null;
  }

  if (redisClient?.isReady) {
    return redisClient;
  }

  if (connectionPromise) {
    await connectionPromise;
    return redisClient;
  }

  connectionPromise = (async () => {
    try {
      redisClient = createClient({
        url: REDIS_URL,
      });

      redisClient.on("error", (err: Error) => {
        console.error("[Cache] Redis error:", err.message);
      });

      redisClient.on("connect", () => {
        console.log("[Cache] Redis connected");
      });

      redisClient.on("reconnecting", () => {
        console.log("[Cache] Redis reconnecting...");
      });

      await redisClient.connect();
    } catch (error) {
      console.error("[Cache] Failed to connect to Redis:", error);
      redisClient = null;
    } finally {
      connectionPromise = null;
    }
  })();

  await connectionPromise;
  return redisClient;
}

// ========================================
// CACHE OPERATIONS
// ========================================

/**
 * Get value from cache
 * Returns null if key doesn't exist or Redis is not configured
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await client.get(key);
    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[Cache] GET ${key} failed:`, error);
    return null;
  }
}

/**
 * Set value in cache with TTL
 * Returns true if successful
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number = TTL.GENERIC
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const serialized = JSON.stringify(value);
    await client.setEx(key, ttlSeconds, serialized);
    return true;
  } catch (error) {
    console.error(`[Cache] SET ${key} failed:`, error);
    return false;
  }
}

/**
 * Delete key from cache
 * Returns true if key was deleted
 */
export async function cacheDelete(key: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const result = await client.del(key);
    return result > 0;
  } catch (error) {
    console.error(`[Cache] DELETE ${key} failed:`, error);
    return false;
  }
}

/**
 * Delete multiple keys matching pattern
 * WARNING: Use carefully in production
 */
export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const keys = await client.keys(pattern);
    if (keys.length === 0) return false;

    await client.del(keys);
    console.log(`[Cache] Deleted ${keys.length} keys matching ${pattern}`);
    return true;
  } catch (error) {
    console.error(`[Cache] DELETE PATTERN ${pattern} failed:`, error);
    return false;
  }
}

/**
 * Check if key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    return (await client.exists(key)) > 0;
  } catch (error) {
    console.error(`[Cache] EXISTS ${key} failed:`, error);
    return false;
  }
}

/**
 * Get or set cache with fallback function
 * If cache miss, calls fn() and caches the result
 */
export async function cacheGetOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = TTL.GENERIC
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - compute value
  const value = await fn();
  
  // Cache it
  await cacheSet(key, value, ttlSeconds);
  
  return value;
}

// ========================================
// CACHE KEY HELPERS
// ========================================

export const cacheKeys = {
  // Dashboard
  dashboardStats: (userId: string) => `dashboard:stats:${userId}`,
  dashboardMetrics: (dateRange: string) => `dashboard:metrics:${dateRange}`,
  
  // Contacts
  contactById: (id: string) => `contact:id:${id}`,
  contactByEmail: (email: string) => `contact:email:${email}`,
  contactByPhone: (phone: string) => `contact:phone:${phone}`,
  contactList: (page: number, limit: number) => `contacts:list:${page}:${limit}`,
  
  // Jobs
  jobById: (id: string) => `job:id:${id}`,
  jobList: (status?: string) => `jobs:list${status ? `:${status}` : ""}`,
  
  // Settings
  appSettings: () => `settings:app`,
  aiSettings: () => `settings:ai`,
  
  // Proposals
  proposalById: (id: string) => `proposal:id:${id}`,
  proposalList: (status: string) => `proposals:list:${status}`,
  
  // Ledger
  ledgerEntries: (filters: string) => `ledger:entries:${filters}`,
};

// ========================================
// CACHE INVALIDATION HELPERS
// ========================================

/**
 * Invalidate all contact-related caches
 * Call after creating/updating/deleting contacts
 */
export async function invalidateContacts(): Promise<void> {
  await cacheDeletePattern("contact:*");
  await cacheDeletePattern("contacts:*");
}

/**
 * Invalidate all job-related caches
 * Call after creating/updating jobs
 */
export async function invalidateJobs(): Promise<void> {
  await cacheDeletePattern("job:*");
  await cacheDeletePattern("jobs:*");
}

/**
 * Invalidate all dashboard caches
 * Call after significant data changes
 */
export async function invalidateDashboard(): Promise<void> {
  await cacheDeletePattern("dashboard:*");
}

/**
 * Invalidate all caches (emergency use only)
 */
export async function invalidateAll(): Promise<void> {
  if (!CACHE_ENABLED) return;
  
  try {
    const client = await getRedisClient();
    if (!client) return;

    await client.flushDb();
    console.log("[Cache] All caches invalidated");
  } catch (error) {
    console.error("[Cache] FLUSHDB failed:", error);
  }
}

// ========================================
// CACHE STATISTICS
// ========================================

export async function getCacheStats(): Promise<{
  enabled: boolean;
  connected: boolean;
  keysCount?: number;
  memoryUsage?: string;
}> {
  if (!CACHE_ENABLED) {
    return { enabled: false, connected: false };
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return { enabled: true, connected: false };
    }

    const keysCount = await client.dbSize();
    const info = await client.info("memory");
    const memoryMatch = info.match(/used_memory_human:(.+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1].trim() : "unknown";

    return {
      enabled: true,
      connected: true,
      keysCount,
      memoryUsage,
    };
  } catch (error) {
    console.error("[Cache] Failed to get stats:", error);
    return { enabled: true, connected: false };
  }
}

// ========================================
// MIDDLEWARE: Cache Response
// ========================================

/**
 * Express middleware to cache GET responses
 * 
 * Usage:
 * app.get("/api/dashboard/stats", cacheResponse(60), handler);
 */
export function cacheResponse(ttlSeconds: number) {
  return async (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const key = `http:${req.originalUrl || req.url}`;

    try {
      const cached = await cacheGet(key);
      if (cached) {
        return res.json(cached);
      }

      // Intercept res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode === 200) {
          cacheSet(key, body, ttlSeconds).catch(console.error);
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error("[Cache Middleware] Error:", error);
      next();
    }
  };
}

// ========================================
// INITIALIZATION
// ========================================

/**
 * Initialize cache connection
 * Call during server startup
 */
export async function initCache(): Promise<void> {
  if (!CACHE_ENABLED) {
    console.log("[Cache] Disabled (REDIS_URL not configured)");
    return;
  }

  await getRedisClient();
}

/**
 * Gracefully close cache connection
 * Call during server shutdown
 */
export async function closeCache(): Promise<void> {
  if (redisClient?.isReady) {
    await redisClient.quit();
    console.log("[Cache] Connection closed");
  }
}
