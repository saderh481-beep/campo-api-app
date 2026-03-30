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

// SUPER SANITIZER - Maneja N duplicaciones
function sanitizeRedisUrl(url: string): string {
  if (!url) throw new Error('REDIS_URL missing - check Railway vars');
  
  let clean = url.trim().replace(/\/+$/, '');
  
  // Fix MÚLTIPLES duplicaciones regex
  let dupeMatch;
  while ((dupeMatch = clean.match(/redis:\/\/[^?#]+?(?=redis:\/\/)/i))) {
    clean = clean.substring(0, dupeMatch.index!).replace(/\/+$/, '');
    console.warn(`[Redis] Fixed multi-dupe at pos ${dupeMatch.index}`);
  }
  
  // Validar formato final
  if (!clean.match(/^redis(s)?:\/\/[^\/]+:\d+/)) {
    throw new Error(`Invalid Redis URL after sanitize: ${clean.substring(0, 100)}...`);
  }
  
  return clean;
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
  // 🚑 ANTI-CRASH Railway optimized
  tls: false,  // Railway.internal NO TLS
  maxRetriesPerRequest: null,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 5000,
  enableOfflineQueue: true,  // Queue ops during reconnect
  db: 0,
  
  // Bun performance
  keepAlive: 30000
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
