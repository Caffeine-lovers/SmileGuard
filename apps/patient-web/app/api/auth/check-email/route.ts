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

    // 1. Try RPC check_email_context
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_email_context', {
      p_email: normalizedEmail,
    });

    if (!rpcError && rpcData) {
      return NextResponse.json(rpcData);
    }

    // 2. Direct fallback query if RPC is not installed yet
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    let hasIntake = false;
    if (profile?.id) {
      const { data: intake } = await supabase
        .from('medical_intake')
        .select('id, date_of_birth, gender, phone')
        .eq('patient_id', profile.id)
        .maybeSingle();

      hasIntake = Boolean(
        intake &&
        ((intake.date_of_birth && intake.date_of_birth.trim() !== '') ||
         (intake.gender && intake.gender.trim() !== '') ||
         (intake.phone && intake.phone.trim() !== ''))
      );
    }

    return NextResponse.json({
      exists: Boolean(profile?.id),
      has_profile: Boolean(profile?.id),
      is_registered: Boolean(profile?.id && profile?.role === 'patient'),
      has_medical_intake: hasIntake,
      role: profile?.role || 'none',
      name: profile?.name || '',
    });
  } catch (error: any) {
    console.error('Error in check-email API route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to check email context' },
      { status: 500 }
    );
  }
}

