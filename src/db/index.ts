import postgres from "postgres";

// Sanitize DATABASE_URL same way as Redis (Railway common issue)
function sanitizePgUrl(url: string): string {
  if (!url) throw new Error('DATABASE_URL missing');
  
  let clean = url.trim().replace(/\/+$/, '');
  
  // 🚀 BULLETPROOF PG SANITIZER v2 - Same as Redis
  while (true) {
    const dupPattern = /postgres:\/\/[^?#:@]+?(@[^?#:]+?:\\d+(?=postgres:)|\/[^?#]+(?=postgres:))/gi;
    const newClean = clean.replace(dupPattern, '');
    if (newClean === clean) break;
    clean = newClean;
    console.warn('[PG 🧹] Stripped Railway duplicate');
  }
  
  // Fallback URL rebuild
  try {
    const urlObj = new URL(clean);
    const rebuilt = `postgres://${urlObj.username}${urlObj.password ? ':' + urlObj.password : ''}@${urlObj.host}${urlObj.pathname}`;
    if (rebuilt.length < 200 && urlObj.protocol === 'postgres:') {
      clean = rebuilt;
      console.log('[PG 🔧] URL rebuilt successfully');
    }
  } catch {
    // Keep original clean if parse fails
  }
  
  console.log(`[PG ✅] DATABASE_URL (${clean.length} chars):`, 
    clean.replace(/:\/\/[^:]+:[^@]+@/, '://***:')
  );
  
  return clean;
}

const rawDbUrl = process.env.DATABASE_URL;
if (!rawDbUrl) throw new Error('DATABASE_URL required');

export const sql = postgres(sanitizePgUrl(rawDbUrl), {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
