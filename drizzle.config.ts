import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Convert pooler URL to direct connection for drizzle-kit
const directUrl = process.env.DATABASE_URL.replace(':6543/', ':5432/');

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
});
