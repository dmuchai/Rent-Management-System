#!/usr/bin/env node

// Quick test to verify JWT secret is working
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'i0RmCWrtbAVks+IuA5hEhXbbzKE3buLay4uqj8VGWUJjHtdT5MrcCHj28Gl7LFZVdvYJSRAzoxCdD6MmVk1IXg==';

console.log('Testing JWT Secret...');
console.log('JWT Secret length:', JWT_SECRET.length);
console.log('JWT Secret (first 20 chars):', JWT_SECRET.substring(0, 20) + '...');

// Test token creation and verification
try {
    const testPayload = { sub: 'test-user', email: 'test@example.com' };
    const testToken = jwt.sign(testPayload, JWT_SECRET);
    console.log('✅ Test token created successfully');
    
    const verified = jwt.verify(testToken, JWT_SECRET);
    console.log('✅ Test token verified successfully');
    console.log('Verified payload:', verified);
} catch (error) {
    console.log('❌ JWT test failed:', error.message);
}