'use client';

import { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { HeroUIProvider } from '@heroui/react';

interface AuthContextType {
  initialized: boolean;
}

const AuthContext = createContext<AuthContextType>({ initialized: true });

export function Providers({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(true);

  useEffect(() => {
    // Shared useAuth hook manages the authentication state and session lifecycle
    setInitialized(true);
  }, []);

  return (
    <HeroUIProvider>
      <AuthContext.Provider value={{ initialized }}>
        {children}
      </AuthContext.Provider>
    </HeroUIProvider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
