import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceRoleKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceRoleKey);
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && supabaseUrl) {
    return createClient(supabaseUrl, anonKey);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      // If notifications table does not exist or has an issue, return empty array gracefully
      console.warn('[Notifications GET] Error fetching:', error.message);
      return NextResponse.json({ notifications: [] });
    }

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('[Notifications GET] Exception:', error);
    return NextResponse.json({ notifications: [] });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const body = await request.json();
    const { userId, notificationId, markAll = false } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    if (markAll) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
    } else if (notificationId) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications PATCH] Exception:', error);
    return NextResponse.json({ error: 'Failed to update notification status' }, { status: 500 });
  }
}

