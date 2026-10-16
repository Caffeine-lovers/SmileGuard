import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolvePublicBaseUrl(request: NextRequest): string {
  // 1. Explicitly configured public app URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }
  // 2. Vercel deployment URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  // 3. Proxy headers forwarded from Vercel / edge proxy
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    return `${proto}://${host}`;
  }
  // 4. Fallback for local development
  if (host) {
    return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const sensitiveParams = new Set(['code', 'state', 'access_token', 'refresh_token', 'token', 'id_token']);
  const safeParamNames = Array.from(searchParams.keys()).filter(
    (key, index, keys) => !sensitiveParams.has(key) && keys.indexOf(key) === index
  );
  
  console.log('[API Auth Callback] Request received');
  if (process.env.NODE_ENV !== 'production' && safeParamNames.length > 0) {
    console.log('[API Auth Callback] Query params:', safeParamNames.join(', '));
  }
  
  const baseUrl = resolvePublicBaseUrl(request);
  const search = request.nextUrl.search;

  // Check for error in the callback
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  if (error) {
    console.error('[API Auth Callback] OAuth error:', error, errorDescription);
    // Redirect to signup with error
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(errorDescription || error)}`, baseUrl)
    );
  }
  
  // Handle OAuth success - forward to page-based callback while preserving all params (e.g. ?code=...)
  const redirectUrl = new URL(`/auth/callback${search}`, baseUrl);
  console.log('[API Auth Callback] OAuth redirecting to:', redirectUrl.toString());
  return NextResponse.redirect(redirectUrl);
};

export const POST = async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  const baseUrl = resolvePublicBaseUrl(request);
  const search = request.nextUrl.search;
  
  console.log('[API Auth Callback POST] Request received');
  if (body?.error) {
    console.error('[API Auth Callback POST] Error:', body.error);
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(body.error)}`, baseUrl)
    );
  }
  
  return NextResponse.redirect(new URL(`/auth/callback${search}`, baseUrl));
};
