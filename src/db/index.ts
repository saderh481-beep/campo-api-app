import postgres from "postgres";

// Sanitize DATABASE_URL same way as Redis (Railway common issue)
function sanitizePgUrl(url: string): string {
  if (!url) throw new Error('DATABASE_URL missing');
  
  let clean = url.trim().replace(/\/+$/, '');
  
  // Fix Railway duplicated postgres://postgres://...
  let dupeMatch;
  while ((dupeMatch = clean.match(/postgres:\/\/[^?#]+?(?=postgres:\/\/)/i))) {
    clean = clean.substring(0, dupeMatch.index!).replace(/\/+$/, '');
    console.warn(`[PG] Fixed multi-dupe at pos ${dupeMatch.index}`);
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
