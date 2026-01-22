import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Robustly parse and encode the password in the DATABASE_URL
let directUrl = process.env.DATABASE_URL || "";
if (directUrl.includes('@')) {
  try {
    // Find the LAST '@' before the hostname part
    const lastAtIndex = directUrl.lastIndexOf('@');
    const userInfoPart = directUrl.substring(0, lastAtIndex); // postgresql://user:password
    const hostPart = directUrl.substring(lastAtIndex + 1); // host:port/db

    const protocolIndex = userInfoPart.indexOf('://');
    const protocol = userInfoPart.substring(0, protocolIndex + 3);
    const credentials = userInfoPart.substring(protocolIndex + 3);

    const lastColonIndex = credentials.lastIndexOf(':');
    const user = credentials.substring(0, lastColonIndex);
    const pass = credentials.substring(lastColonIndex + 1);

    // URL-encode the user and password
    const encodedUser = encodeURIComponent(decodeURIComponent(user));
    const encodedPass = encodeURIComponent(decodeURIComponent(pass));

    directUrl = `${protocol}${encodedUser}:${encodedPass}@${hostPart}`;

    // Ensure sslmode=no-verify to bypass certificate validation issues
    if (!directUrl.includes('sslmode=')) {
      directUrl += (directUrl.includes('?') ? '&' : '?') + 'sslmode=no-verify';
    } else {
      directUrl = directUrl.replace('sslmode=require', 'sslmode=no-verify');
    }
  } catch (e) {
    console.warn('Manual DATABASE_URL parsing failed, using as-is.');
  }
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
