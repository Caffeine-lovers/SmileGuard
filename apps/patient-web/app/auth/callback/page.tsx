'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Processing authentication...');
  const [error, setError] = useState<string | null>(null);

  const addDebug = (msg: string) => {
    console.log('[AUTH CALLBACK]', msg);
  };

  useEffect(() => {
    let isHandled = false;

    const checkRegistrationAndRoute = async (userId: string, _userEmail?: string) => {
      if (isHandled) return;

      try {
        addDebug(`Checking registration status for user: ${userId}`);

        // 1. Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, name, role')
          .eq('id', userId)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
          addDebug(`Profile fetch error: ${profileError.message}`);
        }

        // 2. Fetch medical_intake
        const { data: intake, error: intakeError } = await supabase
          .from('medical_intake')
          .select('id, date_of_birth, gender, phone')
          .eq('patient_id', userId)
          .maybeSingle();

        if (intakeError && intakeError.code !== 'PGRST116') {
          addDebug(`Medical intake fetch error: ${intakeError.message}`);
        }

        // A user has completed registration IF:
        // - Profile exists with a valid name and role === 'patient'
        // - Medical intake exists and has actual data (date_of_birth or gender or phone filled in)
        const hasValidProfile = Boolean(
          profile && 
          profile.name && 
          profile.name.trim() !== '' && 
          profile.name.toLowerCase() !== 'patient' && 
          profile.name.toLowerCase() !== 'user' &&
          profile.role === 'patient'
        );

        const hasValidIntake = Boolean(
          intake && (
            (intake.date_of_birth && intake.date_of_birth.trim() !== '') ||
            (intake.gender && intake.gender.trim() !== '') ||
            (intake.phone && intake.phone.trim() !== '')
          )
        );

        const isFullyRegistered = hasValidProfile && hasValidIntake;

        addDebug(`Registration check: hasValidProfile=${hasValidProfile}, hasValidIntake=${hasValidIntake}, isFullyRegistered=${isFullyRegistered}`);

        if (!isFullyRegistered) {
          // User MUST be prompted to complete registration flow
          addDebug('Registration incomplete: routing to /signup/register?oauth=true');
          isHandled = true;
          localStorage.setItem('oauth_signup_flow', 'true');
          setMessage('Welcome! Prompting to registration details...');
          await new Promise(resolve => setTimeout(resolve, 400));
          router.replace('/signup/register?oauth=true');
          return;
        }

        // Registration is complete -> proceed to dashboard
        addDebug('Registration complete: routing to dashboard');
        isHandled = true;
        localStorage.removeItem('oauth_signup_flow');
        setMessage('Authentication successful! Loading dashboard...');
        await new Promise(resolve => setTimeout(resolve, 400));
        router.replace('/dashboard');
      } catch (err) {
        addDebug(`Registration check exception: ${err instanceof Error ? err.message : String(err)}`);
        // Fallback: prompt user to registration for OAuth flow
        isHandled = true;
        localStorage.setItem('oauth_signup_flow', 'true');
        router.replace('/signup/register?oauth=true');
      }
    };

    const handleCallback = async () => {
      try {
        addDebug('Callback page loaded');
        addDebug(`URL: ${window.location.href}`);

        // Check for error in URL search params
        const params = new URLSearchParams(window.location.search);
        const errorCode = params.get('error');
        const errorDescription = params.get('error_description');

        if (errorCode) {
          addDebug(`OAuth error detected: ${errorCode}`);
          setError(`Authentication failed: ${errorDescription || errorCode}`);
          setMessage('Authentication failed. Redirecting to login...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          router.push('/login');
          return;
        }

        // Wait a short delay for Supabase client to parse URL hash session
        await new Promise(resolve => setTimeout(resolve, 800));

        // Check current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          addDebug(`Session error: ${sessionError.message}`);
        }

        if (session?.user) {
          addDebug(`Session detected for: ${session.user.email}`);
          await checkRegistrationAndRoute(session.user.id, session.user.email);
          return;
        }

        // If no session yet, wait with onAuthStateChange listener
        addDebug('Waiting for onAuthStateChange event...');
        const timeout = setTimeout(() => {
          if (!isHandled) {
            addDebug('Session establishment timed out');
            isHandled = true;
            setError('Session could not be established. Please try again.');
            setMessage('Redirecting to login...');
            router.push('/login');
          }
        }, 6000);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            addDebug(`Auth state change: ${event}`);
            if (isHandled) return;

            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentSession?.user) {
              clearTimeout(timeout);
              subscription?.unsubscribe();
              await checkRegistrationAndRoute(currentSession.user.id, currentSession.user.email);
            }
          }
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
        addDebug(`Callback error: ${errorMsg}`);
        console.error('[AUTH CALLBACK] Error:', err);
        setError(errorMsg);
        setMessage('An error occurred. Redirecting to login...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      <div className="skeuo-panel p-8 text-center max-w-md w-full border-2 border-slate-300">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-b-emerald-600 mx-auto mb-4"></div>
        <span className="skeuo-badge skeuo-badge-mint mb-2">Clinic Security Gateway</span>
        <p className="text-slate-800 font-bold text-sm tracking-wide mt-2">{message}</p>
        {error && (
          <p className="text-xs font-semibold text-red-600 mt-4 bg-red-50 p-2 border border-red-300 rounded-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
