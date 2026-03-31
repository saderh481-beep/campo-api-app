import postgres from "postgres";

// Helper function to fix duplicated PostgreSQL URLs (similar to Redis)
function sanitizePgUrl(url: string): string {
  if (!url) throw new Error('DATABASE_URL missing');
  
  let clean = url.trim().replace(/\/+$/, '');
  
  // Check if the URL is duplicated (e.g., "postgresql://...postgresql://...")
  const pgProtocolPattern = /postgresql:\/\//g;
  const matches = clean.match(pgProtocolPattern);
  
  if (matches && matches.length > 1) {
    // Find the second occurrence and truncate
    const firstEnd = clean.indexOf("postgresql://");
    const secondStart = clean.indexOf("postgresql://", firstEnd + 1);
    if (secondStart > -1) {
      console.warn("[PG 🧹] URL duplicada detectada, usando solo la primera parte");
      clean = clean.substring(0, secondStart).replace(/\/+$/, "");
    }
  }
  
  // Alternative check for postgres:// protocol
  const postgresProtocolPattern = /postgres:\/\//g;
  const postgresMatches = clean.match(postgresProtocolPattern);
  
  if (postgresMatches && postgresMatches.length > 1) {
    const firstEnd = clean.indexOf("postgres://");
    const secondStart = clean.indexOf("postgres://", firstEnd + 1);
    if (secondStart > -1) {
      console.warn("[PG 🧹] URL duplicada detectada, usando solo la primera parte");
      clean = clean.substring(0, secondStart).replace(/\/+$/, "");
    }
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
