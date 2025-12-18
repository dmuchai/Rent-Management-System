// POST /api/register - Register new user with email/password
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['landlord', 'tenant', 'property_manager']).default('landlord'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userData = registerSchema.parse(req.body);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role,
        }
      }
    });

    if (error) {
      console.error('Registration error:', error);
      
      // Check for specific error types
      if (error.message.includes('already registered')) {
        return res.status(409).json({ 
          error: 'Email already registered',
          message: 'An account with this email already exists. Please sign in instead.' 
        });
      }
      
      return res.status(400).json({ 
        error: 'Registration failed',
        message: error.message 
      });
    }

    if (!data.user) {
      return res.status(500).json({ error: 'User creation failed' });
    }

    return res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
      user: {
        id: data.user.id,
        email: data.user.email,
        role: userData.role,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: error.errors[0].message,
        details: error.errors 
      });
    }
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
