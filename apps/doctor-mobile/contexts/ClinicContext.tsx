import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@smileguard/supabase-client';

export interface ClinicData {
  id: string;
  clinic_name: string;
  address: string;
  logo_url: string | null;
  gallery_images: string[];
  services: any[];
  schedule: any;
  updated_at: string;
}

interface ClinicContextType {
  clinic: ClinicData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('clinic_setup')
        .select('id, clinic_name, address, logo_url, gallery_images, services, schedule, updated_at')
        .limit(1);

      if (fetchError) {
        console.error('Error loading clinic data:', fetchError);
        setError(fetchError.message);
        return;
      }

      if (data && data.length > 0) {
        setClinic(data[0] as ClinicData);
      }
    } catch (err) {
      console.error('Clinic context load error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load clinic data on mount
    loadClinicData();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('clinic_setup_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'clinic_setup',
        },
        (payload) => {
          console.log('Clinic data updated:', payload);
          // Reload clinic data when changes occur
          loadClinicData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const refetch = async () => {
    await loadClinicData();
  };

  return (
    <ClinicContext.Provider value={{ clinic, loading, error, refetch }}>
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (!context) {
    throw new Error('useClinic must be used within ClinicProvider');
  }
  return context;
}
