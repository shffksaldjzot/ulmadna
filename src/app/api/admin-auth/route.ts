import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { password } = await req.json();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }

  const token = process.env.NEXTAUTH_SECRET || 'fallback-token';
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin-auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24시간
    path: '/',
  });

  return response;
}
