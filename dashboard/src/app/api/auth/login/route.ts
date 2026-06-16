import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Call FastAPI backend to verify credentials
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const data = await response.json();

      // Create Next.js response and set HTTP-only cookie
      const nextResponse = NextResponse.json({
        success: true,
        access_token: data.access_token,
        role: data.role ?? "admin",
      });
      const cookieOpts = {
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      };
      nextResponse.cookies.set({ name: 'harshwal_token', value: data.access_token, ...cookieOpts });
      nextResponse.cookies.set({ name: 'user_role', value: data.role ?? 'admin', ...cookieOpts });

      return nextResponse;
    } else {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
