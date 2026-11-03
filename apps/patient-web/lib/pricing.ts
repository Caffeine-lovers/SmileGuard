/**
 * Pure pricing helpers shared by the billing UI, the PayMongo API routes and the test suite.
 * Keep this file free of Supabase / browser imports so it can run anywhere.
 */
import { calculateDiscount } from '@smileguard/shared-types';

export const SERVICE_PRICES: Record<string, number> = {
  Cleaning: 1500,
  Whitening: 5000,
  Fillings: 2000,
  Filling: 2000,
  'Root Canal': 8000,
  'Root Canals': 8000,
  Extraction: 1500,
  Aligners: 25000,
  'Braces Consultation': 35000,
  Braces: 35000,
  'Implants Consultation': 45000,
  Implants: 45000,
  'X-Ray': 500,
  'Check-up': 300,
  Checkup: 300,
  Consultation: 500,
  'Initial Consultation': 500,
  General: 500,
  'General Checkup': 500,
};

export const FALLBACK_PRICE = 1500;

export type ClinicService = { id?: string; name?: string; price?: number; description?: string };

/** Catalog price for a service name (exact match first, then partial match). */
export function getServicePrice(serviceName?: string | null): number {
  if (!serviceName) return FALLBACK_PRICE;
  if (SERVICE_PRICES[serviceName] && SERVICE_PRICES[serviceName] > 0) {
    return SERVICE_PRICES[serviceName];
  }
  const normalized = serviceName.trim().toLowerCase();
  for (const [key, price] of Object.entries(SERVICE_PRICES)) {
    if (key.toLowerCase() === normalized) return price;
  }
  if (serviceName.includes(',')) {
    const parts = serviceName.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.reduce((sum, part) => sum + getServicePrice(part), 0);
    }
  }
  for (const [key, price] of Object.entries(SERVICE_PRICES)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return price;
    }
  }
  return FALLBACK_PRICE;
}

/** Clinic-specific price if the clinic lists the service, otherwise the catalog price. */
export function getServicePriceForClinic(serviceName?: string | null, clinicServices?: ClinicService[]): number {
  if (!serviceName) return FALLBACK_PRICE;
  const norm = serviceName.trim().toLowerCase();
  if (Array.isArray(clinicServices) && clinicServices.length > 0) {
    const exact = clinicServices.find((s) => s.name?.trim().toLowerCase() === norm);
    if (exact && typeof exact.price === 'number' && exact.price > 0) return exact.price;
  }
  if (serviceName.includes(',')) {
    const parts = serviceName.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.reduce((sum, part) => sum + getServicePriceForClinic(part, clinicServices), 0);
    }
  }
  if (Array.isArray(clinicServices) && clinicServices.length > 0) {
    const partial = clinicServices.find(
      (s) => s.name && (s.name.trim().toLowerCase().includes(norm) || norm.includes(s.name.trim().toLowerCase()))
    );
    if (partial && typeof partial.price === 'number' && partial.price > 0) return partial.price;
  }
  return getServicePrice(serviceName);
}

type BillingAmounts = { amount?: number | string | null; final_amount?: number | string | null } | null | undefined;

/**
 * The amount owed for an appointment BEFORE any statutory discount.
 * Mirrors the billing page: the appointment's billing row wins, then the clinic/catalog price.
 */
export function resolveBaseAmount(
  billing: BillingAmounts,
  serviceName?: string | null,
  clinicServices?: ClinicService[]
): number {
  const fromBilling = Number(billing?.final_amount ?? billing?.amount);
  if (Number.isFinite(fromBilling) && fromBilling > 0) return fromBilling;
  return getServicePriceForClinic(serviceName, clinicServices);
}

export type DiscountRequest = 'none' | 'pwd' | 'senior' | string | null | undefined;

/**
 * Server-side checkout total. The 20% statutory discount (RA 9994 / RA 10754) is only
 * granted when the doctor has approved the patient's PWD/Senior ID.
 */
export function computeCheckoutTotal(
  baseAmount: number,
  requested: DiscountRequest,
  pwdStatus?: string | null
): { baseAmount: number; discountType: 'none' | 'pwd' | 'senior'; discountAmount: number; finalAmount: number } {
  const wantsDiscount = requested === 'pwd' || requested === 'senior';
  const approved = pwdStatus === 'approved';
  const discountType = wantsDiscount && approved ? (requested as 'pwd' | 'senior') : 'none';
  const { discountAmount, finalAmount } = calculateDiscount(baseAmount, discountType);
  return {
    baseAmount,
    discountType,
    discountAmount: round2(discountAmount),
    finalAmount: round2(finalAmount),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
