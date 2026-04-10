import postgres from "postgres";
import { requireEnv } from "@/config/env";

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getSqlClient() {
  if (!sqlClient) {
    const databaseUrl = requireEnv("DATABASE_URL");
    sqlClient = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
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
