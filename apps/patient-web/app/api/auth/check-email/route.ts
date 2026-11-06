import { NextResponse } from 'next/server';
import { supabase } from '@smileguard/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json({
        exists: false,
        has_profile: false,
        is_registered: false,
        has_medical_intake: false,
        role: 'none',
        name: '',
      });
    }

    const normalizedEmail = rawEmail.trim().toLowerCase();

    const { data: rpcData, error: rpcError } = await supabase.rpc('check_email_context', {
      p_email: normalizedEmail,
    });

    if (rpcError || !rpcData) {
      console.error('check_email_context failed:', rpcError?.message);
      return NextResponse.json({ error: 'Could not check this email' }, { status: 503 });
    }

    return NextResponse.json(rpcData);
  } catch (error: any) {
    console.error('Error in check-email API route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check email context' },
      { status: 500 }
    );
  }
}

