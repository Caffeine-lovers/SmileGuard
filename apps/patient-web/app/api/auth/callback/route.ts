import { NextRequest, NextResponse } from 'next/server';

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  
  console.log('[API Auth Callback] Request received');
  console.log('[API Auth Callback] Hash:', searchParams.toString());
  
  // Check for error in the callback
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  if (error) {
    console.error('[API Auth Callback] OAuth error:', error, errorDescription);
    // Redirect to signup with error
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }
  
  // Handle OAuth success - Supabase will set the session automatically
  // Redirect to the page-based callback which will check the session
  console.log('[API Auth Callback] OAuth appears successful, redirecting to callback page');
  return NextResponse.redirect(new URL('/auth/callback', request.url));
};

export const POST = async (request: NextRequest) => {
  // Handle POST requests in case Supabase sends data this way
  const body = await request.json().catch(() => null);
  
  console.log('[API Auth Callback POST] Request received');
  if (body?.error) {
    console.error('[API Auth Callback POST] Error:', body.error);
    return NextResponse.redirect(
      new URL(`/signup?error=${encodeURIComponent(body.error)}`, request.url)
    );
  }
  
  return NextResponse.redirect(new URL('/auth/callback', request.url));
};
