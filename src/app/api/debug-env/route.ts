import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.KAKAO_CLIENT_ID || '';
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || '';
  const trimmedId = clientId.trim();
  const trimmedSecret = clientSecret.trim();

  return NextResponse.json({
    clientId: {
      length: clientId.length,
      trimmedLength: trimmedId.length,
      value: trimmedId,
      hasWhitespace: clientId !== trimmedId,
      charCodes: [...clientId].map((c) => c.charCodeAt(0)),
    },
    clientSecret: {
      length: clientSecret.length,
      trimmedLength: trimmedSecret.length,
      first4: trimmedSecret.slice(0, 4),
      last4: trimmedSecret.slice(-4),
      hasWhitespace: clientSecret !== trimmedSecret,
      charCodes: [...clientSecret].map((c) => c.charCodeAt(0)),
    },
  });
}
