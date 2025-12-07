// Helper function for authentication in serverless endpoints
import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export async function verifyAuthToken(req: VercelRequest) {
  let token: string | undefined;
  
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    token = cookies['supabase-auth-token'];
  }

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    return null;
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return null;
  }

  return { userId: user.id, user };
}
