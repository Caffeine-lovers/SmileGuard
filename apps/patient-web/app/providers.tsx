'use client';

import { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@smileguard/supabase-client';

interface AuthContextType {
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({ initialized: false });

export function Providers({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // On mount, restore persisted session from localStorage
    // This ensures the Supabase client has the session loaded before any pages render
    const initAuth = async () => {
      console.log('[Providers] Initializing auth on app load');
      
      // Retrieve the persisted session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        console.log('[Providers] ✅ Session restored from storage:', session.user.email);
      } else {
        console.log('[Providers] No session found in storage');
      }
      
      setInitialized(true);
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
