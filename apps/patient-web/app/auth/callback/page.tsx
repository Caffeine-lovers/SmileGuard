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
          
          // Check if this is an OAuth signup flow (user clicked "Sign up with Google" on signup page)
          const isOAuthSignupFlow = localStorage.getItem('oauth_signup_flow') === 'true';
          
          if (isOAuthSignupFlow) {
            addDebug('OAuth signup flow detected - routing to registration');
            localStorage.removeItem('oauth_signup_flow');
            setMessage('Completing your registration...');
            await new Promise(resolve => setTimeout(resolve, 500));
            router.push('/signup/register?oauth=true');
            return;
          }
          
          // Ensure profile exists for OAuth users and check if complete
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileError || !profile) {
              addDebug('Creating patient profile for OAuth user...');
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Patient',
                  role: null,
                  created_at: new Date().toISOString(),
                });
              
              if (insertError) {
                addDebug(`Profile creation failed: ${insertError.message}`);
              } else {
                addDebug('✓ Patient profile created - redirecting to complete registration');
                setMessage('Profile created! Completing registration...');
                await new Promise(resolve => setTimeout(resolve, 500));
                router.push('/signup/register?oauth=true');
                return;
              }
            } else {
              addDebug(`✓ Profile exists. Checking if registration is complete...`);
              
              // Check if profile is complete (has all required fields)
              // Role must be set to indicate signup flow is complete
              const isComplete = profile.name && profile.name.trim() !== '' && profile.role;
              

              if (!isComplete) {
                addDebug('Profile incomplete - redirecting to complete registration');
                setMessage('Completing your profile...');
                await new Promise(resolve => setTimeout(resolve, 500));
                router.push('/signup/register?oauth=true');
                return;
              }
              
              addDebug('✓ Profile complete - proceeding to dashboard');
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            addDebug(`Profile check failed: ${msg}`);
          }
          
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
              
              // Check if this is an OAuth signup flow
              const isOAuthSignupFlow = localStorage.getItem('oauth_signup_flow') === 'true';
              
              if (isOAuthSignupFlow) {
                addDebug('OAuth signup flow detected - routing to registration');
                localStorage.removeItem('oauth_signup_flow');
                clearTimeout(timeout);
                completed = true;
                subscription?.unsubscribe();
                setMessage('Completing your registration...');
                setTimeout(() => {
                  router.push('/signup/register?oauth=true');
                }, 500);
                return;
              }
              
              // Ensure profile exists for OAuth users and check if complete
              try {
                const { data: profile, error: profileError } = await supabase
                  .from('profiles')
                  .select('*')
                  .eq('id', session.user.id)
                  .single();
                
                if (profileError || !profile) {
                  addDebug('Creating patient profile for OAuth user...');
                  const { error: insertError } = await supabase
                    .from('profiles')
                    .insert({
                      id: session.user.id,
                      email: session.user.email,
                      name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Patient',
                      role: null,
                      created_at: new Date().toISOString(),
                    });
                  
                  if (insertError) {
                    addDebug(`Profile creation failed: ${insertError.message}`);
                  } else {
                    addDebug('✓ Patient profile created - redirecting to complete registration');
                    clearTimeout(timeout);
                    completed = true;
                    subscription?.unsubscribe();
                    setMessage('Profile created! Completing registration...');
                    setTimeout(() => {
                      router.push('/signup/register?oauth=true');
                    }, 500);
                    return;
                  }
                } else {
                  addDebug(`✓ Profile exists. Checking if registration is complete...`);
                  
                  // Check if profile is complete (has all required fields)
                  const isComplete = profile.name && profile.name.trim() !== '' && profile.role;
                  
                  if (!isComplete) {
                    addDebug('Profile incomplete - redirecting to complete registration');
                    clearTimeout(timeout);
                    completed = true;
                    subscription?.unsubscribe();
                    setMessage('Completing your profile...');
                    setTimeout(() => {
                      router.push('/signup/register?oauth=true');
                    }, 500);
                    return;
                  }
                  
                  addDebug('✓ Profile complete - proceeding to dashboard');
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Unknown error';
                addDebug(`Profile check failed: ${msg}`);
              }
              
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
