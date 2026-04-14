import postgres from "postgres";
import { requireEnv } from "@/config/env";

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getSqlClient() {
  if (!sqlClient) {
    const databaseUrl = requireEnv("DATABASE_URL");
    sqlClient = postgres(databaseUrl, {
      max: 20,
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      prepare: false,
    });
  }

  return sqlClient;
}

function sqlTag(strings: TemplateStringsArray, ...values: any[]) {
  return getSqlClient()(strings, ...values);
}

sqlTag.unsafe = (query: string, params?: any[]) => getSqlClient().unsafe(query, params);

export const sql = sqlTag;
