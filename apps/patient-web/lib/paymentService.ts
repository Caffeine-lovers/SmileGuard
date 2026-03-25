// Placeholder payment service for patient-web
// Full implementation to be added during development

import { supabase } from '@smileguard/supabase-client';
import type { Billing } from './database';

export async function processPayment(
  billingId: string,
  _amount: number,
  paymentMethod: string
): Promise<{ success: boolean; message: string }> {
  try {
    // TODO: Integrate with actual payment processor (Stripe, GCash, etc.)
    const { error } = await supabase
      .from('billings')
      .update({
        payment_status: 'paid',
        payment_method: paymentMethod,
        payment_date: new Date().toISOString(),
      })
      .eq('id', billingId);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Payment processed successfully' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment failed';
    return { success: false, message };
  }
}

export async function getBillings(patientId: string): Promise<Billing[]> {
  try {
    const { data, error } = await supabase
      .from('billings')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching billings:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error:', err);
    return [];
  }
}

export async function getBalance(patientId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('billings')
      .select('final_amount')
      .eq('patient_id', patientId)
      .eq('payment_status', 'pending');

    if (error) {
      console.error('Error calculating balance:', error);
      return 0;
    }

    return (data || []).reduce((sum, bill) => sum + bill.final_amount, 0);
  } catch (err) {
    console.error('Error:', err);
    return 0;
  }
}
