import postgres from "postgres";
import { getDatabaseUrl } from "@/config/env";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

let sqlClient: ReturnType<typeof postgres> | null = null;
let connectionError: Error | null = null;

function createSqlClient(): ReturnType<typeof postgres> {
  const databaseUrl = getDatabaseUrl();
  
  return postgres(databaseUrl, {
    max: 20,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: false,
    onnotice: () => {},
  });
}

export function getSqlClient() {
  if (!sqlClient) {
    try {
      sqlClient = createSqlClient();
    } catch (error) {
      connectionError = error instanceof Error ? error : new Error("Error desconocido al crear cliente SQL");
      throw connectionError;
    }
  }
  return sqlClient;
}

export async function testConnection(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const client = getSqlClient();
    await client.unsafe("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : "Error de conexión desconocido"
    };
  }
}

export async function reconnect(): Promise<boolean> {
  if (sqlClient) {
    try {
      await sqlClient.end({ timeout: 5 });
    } catch {}
  }
  sqlClient = null;
  
  try {
    sqlClient = createSqlClient();
    await sqlClient.unsafe("SELECT 1");
    connectionError = null;
    console.log("[db] Reconexión exitosa");
    return true;
  } catch (error) {
    connectionError = error instanceof Error ? error : new Error("Error de reconexión");
    return false;
  }
}

function sqlTag(strings: TemplateStringsArray, ...values: any[]) {
  return getSqlClient()(strings, ...values);
}

(sqlTag as any).unsafe = (query: string, params?: any[]) => {
  const client = getSqlClient();
  return client.unsafe(query, params);
};

export const sql = sqlTag;
