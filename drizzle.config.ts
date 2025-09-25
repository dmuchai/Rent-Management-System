import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Convert pooler URL to direct connection for drizzle-kit
// Also handle the case where we need to use the direct connection URL
let directUrl = process.env.DATABASE_URL;
if (directUrl.includes(':6543/')) {
  // Replace pooler port with direct connection port
  directUrl = directUrl.replace(':6543/', ':5432/');
}

console.log('Using database URL for Drizzle operations...');

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
});
