'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@smileguard/shared-hooks';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { loading, error } = useAuth();
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const completeAuth = async () => {
      try {
        // Wait a moment for auth to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (error) {
          setMessage(`Authentication failed: ${error}`);
          setTimeout(() => router.push('/signup'), 2000);
        } else if (!loading) {
          setMessage('Authentication successful! Redirecting...');
          setTimeout(() => router.push('/dashboard'), 1500);
        }
      } catch (err) {
        console.error('Callback error:', err);
        setMessage('An error occurred. Redirecting...');
        setTimeout(() => router.push('/signup'), 2000);
      }
    };

    const timer = setTimeout(completeAuth, 500);
    return () => clearTimeout(timer);
  }, [loading, error, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-surface">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
        <p className="text-text-primary font-semibold">{message}</p>
      </div>
    </div>
  );
}
