'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@smileguard/supabase-client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Processing authentication...');
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    console.log('[AUTH CALLBACK]', msg);
    setDebug(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        addDebug('Callback page loaded');
        addDebug(`URL: ${window.location.href}`);
        addDebug(`Hash present: ${!!window.location.hash}`);
        
        // Check for error in URL search params
        const params = new URLSearchParams(window.location.search);
        const errorCode = params.get('error');
        const errorDescription = params.get('error_description');
        
        if (errorCode) {
          addDebug(`OAuth error detected: ${errorCode}`);
          setError(`Authentication failed: ${errorDescription || errorCode}`);
          setMessage('Authentication failed. Redirecting...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          router.push('/signup');
          return;
        }
        
        // Wait a bit for Supabase to process the callback from the URL hash
        addDebug('Waiting for Supabase to process OAuth callback...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Get the current session
        addDebug('Checking for session...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          addDebug(`Session error: ${sessionError.message}`);
        }
        
        if (session) {
          addDebug(`✓ Session found for user: ${session.user.email}`);
          
          // Check if user has completed registration by checking medical_intake record
          // medical_intake exists = user has completed the full registration flow
          try {
            const { data: medicalIntake, error: intakeError } = await supabase
              .from('medical_intake')
              .select('id')
              .eq('patient_id', session.user.id)
              .single();
            
            if (intakeError && intakeError.code !== 'PGRST116') {
              // PGRST116 = no rows found (expected for new users)
              addDebug(`Medical intake query error: ${intakeError.message}`);
            }
            
            if (!medicalIntake) {
              // User has no medical_intake record - check if profile exists
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .single();
              
              if (profileError && profileError.code !== 'PGRST116') {
                addDebug(`Profile query error: ${profileError.message}`);
              }
              
              if (profile) {
                // Profile exists but no medical_intake - skip register, go to medical
                addDebug('Profile exists but no medical intake - routing to medical intake');
                localStorage.removeItem('oauth_signup_flow');
                setMessage('Completing your medical information...');
                await new Promise(resolve => setTimeout(resolve, 500));
                router.push('/signup/medical?oauth=true');
                return;
              } else {
                // No profile exists - go to register
                addDebug('No profile found - user needs to register');
                setMessage('Completing your profile...');
                await new Promise(resolve => setTimeout(resolve, 500));
                router.push('/signup/register?oauth=true');
                return;
              }
            } else {
              // User has medical_intake record - registration complete
              addDebug('✓ Medical intake found - registration complete');
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            addDebug(`Medical intake check failed: ${msg}`);
          }
          
          // Clear flag after all checks
          localStorage.removeItem('oauth_signup_flow');
          
          setMessage('✓ Authentication successful! Redirecting to dashboard...');
          await new Promise(resolve => setTimeout(resolve, 500));
          router.push('/dashboard');
          return;
        }
        
        // If no session, listen for auth state change
        addDebug('No session yet, waiting for auth state to update...');
        
        let completed = false;
        const timeout = setTimeout(() => {
          if (!completed) {
            addDebug('Auth state change timeout - redirecting to login');
            completed = true;
            setError('Session not established. Please try again.');
            setMessage('Redirecting to login...');
            router.push('/login');
          }
        }, 5000);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            addDebug(`Auth state change event: ${event}`);
            
            if (completed) return;
            
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
              addDebug(`✓ User authenticated: ${session.user.email}`);
              
              // Check if user has completed registration by checking medical_intake record
              try {
                const { data: medicalIntake, error: intakeError } = await supabase
                  .from('medical_intake')
                  .select('id')
                  .eq('patient_id', session.user.id)
                  .single();
                
                if (intakeError && intakeError.code !== 'PGRST116') {
                  // PGRST116 = no rows found (expected for new users)
                  addDebug(`Medical intake query error: ${intakeError.message}`);
                }
                
                if (!medicalIntake) {
                  // User has no medical_intake record - check if profile exists
                  const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', session.user.id)
                    .single();
                  
                  if (profileError && profileError.code !== 'PGRST116') {
                    addDebug(`Profile query error: ${profileError.message}`);
                  }
                  
                  if (profile) {
                    // Profile exists but no medical_intake - skip register, go to medical
                    addDebug('Profile exists but no medical intake - routing to medical intake');
                    localStorage.removeItem('oauth_signup_flow');
                    clearTimeout(timeout);
                    completed = true;
                    subscription?.unsubscribe();
                    setMessage('Completing your medical information...');
                    setTimeout(() => {
                      router.push('/signup/medical?oauth=true');
                    }, 500);
                    return;
                  } else {
                    // No profile exists - go to register
                    addDebug('No profile found - user needs to register');
                    clearTimeout(timeout);
                    completed = true;
                    subscription?.unsubscribe();
                    setMessage('Completing your profile...');
                    setTimeout(() => {
                      router.push('/signup/register?oauth=true');
                    }, 500);
                    return;
                  }
                } else {
                  // User has medical_intake record - registration complete
                  addDebug('✓ Medical intake found - registration complete');
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                addDebug(`Medical intake check failed: ${msg}`);
              }
              
              // Clear flag after all checks
              localStorage.removeItem('oauth_signup_flow');
              
              clearTimeout(timeout);
              completed = true;
              subscription?.unsubscribe();
              setMessage('✓ Authentication successful! Redirecting to dashboard...');
              setTimeout(() => {
                router.push('/dashboard');
              }, 500);
            }
          }
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
        addDebug(`Callback error: ${errorMsg}`);
        console.error('[AUTH CALLBACK] Error:', err);
        setError(errorMsg);
        setMessage('An error occurred. Redirecting...');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        router.push('/login');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-surface p-4">
      <div className="text-center max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-text-primary font-semibold mb-2">{message}</p>
        {error && (
          <p className="text-sm text-brand-danger mt-4 mb-6">{error}</p>
        )}
        
        {/* Debug log display */}
        {debug.length > 0 && (
          <div className="mt-6 text-left bg-bg-secondary rounded p-2 max-h-48 overflow-y-auto">
            <p className="text-xs text-text-secondary font-mono mb-2">Debug Log:</p>
            {debug.map((msg, i) => (
              <p key={i} className="text-xs text-text-tertiary font-mono">
                {msg}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
