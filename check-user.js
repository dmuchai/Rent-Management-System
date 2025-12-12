import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function checkUser() {
  console.log('Checking for user...');
  const users = await sql`SELECT * FROM public.users`;
  console.log('All users:', users);
  await sql.end();
}

checkUser();
