/**
 * Dummy Accounts Service
 * 
 * This service manages dummy/test accounts for internal testing and development.
 * These accounts are restricted and not accessible from the patient web application.
 */

import { supabase } from './supabase';

export interface DummyAccount {
  id?: string;
  username: string;
  email: string;
  account_type: 'doctor' | 'patient' | 'admin' | 'receptionist' | 'staff' | 'other';
  status: 'active' | 'inactive' | 'suspended' | 'deleted';
  password_hint?: string;
  full_name?: string;
  phone?: string;
  clinic_name?: string;
  specialization?: string;
  notes?: string;
  test_purpose?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string;
}

/**
 * Add a new dummy account
 */
export async function addDummyAccount(data: Omit<DummyAccount, 'id' | 'created_at' | 'updated_at'>): Promise<DummyAccount | null> {
  try {
    const { data: result, error } = await supabase
      .from('dummy_accounts')
      .insert([data])
      .select()
      .single();

    if (error) {
      console.error('Error adding dummy account:', error);
      return null;
    }

    return result;
  } catch (error) {
    console.error('Error in addDummyAccount:', error);
    return null;
  }
}

/**
 * Get all dummy accounts
 */
export async function getAllDummyAccounts(): Promise<DummyAccount[]> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching dummy accounts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAllDummyAccounts:', error);
    return [];
  }
}

/**
 * Get dummy accounts by type
 */
export async function getDummyAccountsByType(accountType: DummyAccount['account_type']): Promise<DummyAccount[]> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .select('*')
      .eq('account_type', accountType)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching dummy accounts by type:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getDummyAccountsByType:', error);
    return [];
  }
}

/**
 * Get dummy account by username
 */
export async function getDummyAccountByUsername(username: string): Promise<DummyAccount | null> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .select('*')
      .eq('username', username)
      .single();

    if (error) {
      console.error('Error fetching dummy account by username:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getDummyAccountByUsername:', error);
    return null;
  }
}

/**
 * Get dummy account by email
 */
export async function getDummyAccountByEmail(email: string): Promise<DummyAccount | null> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('Error fetching dummy account by email:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getDummyAccountByEmail:', error);
    return null;
  }
}

/**
 * Update dummy account status
 */
export async function updateDummyAccountStatus(
  id: string,
  status: DummyAccount['status']
): Promise<DummyAccount | null> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating dummy account status:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateDummyAccountStatus:', error);
    return null;
  }
}

/**
 * Update dummy account
 */
export async function updateDummyAccount(
  id: string,
  updates: Partial<Omit<DummyAccount, 'id' | 'created_at'>>
): Promise<DummyAccount | null> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating dummy account:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateDummyAccount:', error);
    return null;
  }
}

/**
 * Update last used timestamp
 */
export async function updateDummyAccountLastUsed(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('dummy_accounts')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating last_used_at:', error);
    }
  } catch (error) {
    console.error('Error in updateDummyAccountLastUsed:', error);
  }
}

/**
 * Delete dummy account (soft delete by setting status to 'deleted')
 */
export async function deleteDummyAccount(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('dummy_accounts')
      .update({ status: 'deleted' })
      .eq('id', id);

    if (error) {
      console.error('Error deleting dummy account:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteDummyAccount:', error);
    return false;
  }
}

/**
 * Search dummy accounts
 */
export async function searchDummyAccounts(query: string): Promise<DummyAccount[]> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .select('*')
      .or(
        `username.ilike.%${query}%,email.ilike.%${query}%,full_name.ilike.%${query}%`
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching dummy accounts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in searchDummyAccounts:', error);
    return [];
  }
}

/**
 * Get active dummy accounts
 */
export async function getActiveDummyAccounts(): Promise<DummyAccount[]> {
  try {
    const { data, error } = await supabase
      .from('dummy_accounts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active dummy accounts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getActiveDummyAccounts:', error);
    return [];
  }
}
