import postgres from "postgres";
import { requireEnv } from "@/config/env";

type SqlClient = ReturnType<typeof postgres>;

let sqlClient: SqlClient | null = null;

function getSqlClient() {
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

const sqlTag = (strings: TemplateStringsArray, ...values: any[]) => {
  const client = getSqlClient() as any;
  return client(strings, ...values);
};

export const sql = sqlTag as unknown as SqlClient;
