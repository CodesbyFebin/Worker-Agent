import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "../../drizzle/schema";
import * as relations from "../../drizzle/relations";
import { env } from "./env";

const pool = mysql.createPool({
  uri: env.DATABASE_URL,
  connectionLimit: 10,
});

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: "default" });
