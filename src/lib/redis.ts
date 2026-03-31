import { Redis } from "ioredis";

// 🛡️ BULLETPROOF SANITIZER + DEBUGGER (Anti-Crash 2026)

// DEBUG todas vars Redis al startup (solo 1x)
function debugRedisEnvVars() {
  const redisVars = Object.keys(process.env).filter(k => 
    k.toLowerCase().includes('redis') || k.includes('RLWY')
  );
  
  if (redisVars.length > 0) {
    console.table(redisVars.map(k => ({
      variable: k,
      length: process.env[k]?.length || 0,
      startsWithRedis: process.env[k]?.startsWith('redis://') ? '✅' : '❌',
      hasDuplicate: process.env[k]?.match(/redis:\/\/.{40,}redis:\/\//) ? '🚨 DUPE!' : 'OK'
    })));
    
    if (redisVars.length > 1) {
      console.warn(`🚨 [Redis] ${redisVars.length} vars detectadas! Railway clean needed!`);
    }
  } else {
    console.warn('🚨 [Redis] NO REDIS_URL found!');
  }
}

debugRedisEnvVars();

// 🚀 BULLETPROOF SANITIZER v2 - Handles Railway double-URL + port
function sanitizeRedisUrl(url: string): string {
  if (!url) throw new Error('REDIS_URL missing - check Railway vars');
  
  let clean = url.trim().replace(/\/+$/, '');
  
  // 🔧 Aggressive Railway dup fix: repeatedly remove "redis://host:port" suffixes
  while (true) {
    const dupPattern = /redis:\/\/[^?#:@]+?(@[^?#:]+)?:\\d+(?=redis:)/gi;
    const newClean = clean.replace(dupPattern, '');
    if (newClean === clean) break;
    clean = newClean;
    console.warn('[Redis 🧹] Stripped Railway duplicate');
  }
  
  // 🛡️ Fallback: Parse with node:url and rebuild valid URL
  try {
    const urlObj = new URL(clean.startsWith('redis://') ? clean : 'redis://' + clean);
    const rebuilt = `redis://${urlObj.username}${urlObj.password ? ':' + urlObj.password : ''}@${urlObj.host}${urlObj.pathname || ''}`;
    
    // Length safety (Railway dups >200 chars)
    if (rebuilt.length > 150) {
      throw new Error(`Sanitized URL too long: ${rebuilt.length} chars`);
    }
    
    if (!rebuilt.match(/^redis:\/\/[^\/]+:\d+/)) {
      throw new Error('Rebuilt URL invalid format');
    }
    
    console.log('[Redis 🔧] URL rebuilt successfully');
    return rebuilt;
  } catch (parseErr) {
    console.error('[Redis ⚠️] URL parse failed:', parseErr.message);
    throw new Error(`Cannot sanitize REDIS_URL: ${clean.substring(0, 100)}...`);
  }
}

const rawRedisUrl = process.env.REDIS_URL;
if (!rawRedisUrl) {
  console.error('🚨 FATAL: REDIS_URL not set in Railway!');
  throw new Error('REDIS_URL required');
}
const cleanRedisUrl = sanitizeRedisUrl(rawRedisUrl);
console.log(`[Redis ✅] Final URL (${cleanRedisUrl.length} chars):`, 
  cleanRedisUrl.replace(/:(?=.*:)[^:]+(?=($|@))/g, ':***')
);

export const redis = new Redis(cleanRedisUrl, {
  // 🚑 ANTI-CRASH Railway optimized v2
  tls: false,  // Railway.internal NO TLS
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 5000,
  enableOfflineQueue: true,
  db: 0,  // Explicit DB prevents NaN errors
  
  // Type safety wrappers
  commandTimeout: 5000,
  keepAlive: 30000,
  
  // Parse NaN prevention
  parseInt: (str) => {
    const num = Number(str);
    return isNaN(num) ? 0 : Math.floor(num);
  }
});

// 🔔 COMPLETE EVENT HANDLING (No crashes)
redis.on('connect', () => console.log('[Redis 🔌] Connected'));
redis.on('ready', () => console.log('[Redis 🚀] Ready'));
redis.on('error', (err) => {
  if (err.message.includes('ECONNREFUSED')) {
    console.error('[Redis ⚠️] Connection refused - check Railway networking');
  } else {
    console.error('[Redis ❌]', err.message);
  }
});
redis.on('close', () => console.log('[Redis 🔌] Closed'));
redis.on('reconnecting', (data) => 
  console.log(`[Redis 🔄] Reconnecting...`, typeof data === 'number' ? data + 'ms' : 'soon')
);

// 🧪 Health check
export async function redisHealth() {
  try {
    await redis.ping();
    return { status: 'healthy' as const, ts: Date.now() };
  } catch {
    return { status: 'unhealthy' as const, ts: Date.now() };
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await redis?.disconnect();
});
